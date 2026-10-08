"""
LangGraph ReAct agent for filings research.

Replaces the previous static planner + agent modules with a stateful graph
that lets the LLM decide its own sequence of tool calls. Every decision
point in the graph is explicit and inspectable:

    START ─▶ reason ──(has tool_calls?)──▶ tools ──▶ reason ──▶ …
                          │
                          └──(no tool_calls)──▶ END

Nodes
-----
    reason  Runs one LLM call with the tools bound. The LLM either emits
            tool_calls (loop back through the tools node) or a plain
            AIMessage with the final answer (route to END).
    tools   LangGraph's prebuilt ToolNode. Executes every tool_call the
            LLM produced this turn, appending a ToolMessage per call.

State
-----
    messages          Full conversation, ReAct-style. Grows every turn.
    iteration_count   Number of `reason` invocations. Enforces a hard cap
                      via `FILINGS_AGENT_MAX_ITERATIONS` to prevent
                      runaway loops from misbehaving models.

Refusal handling
----------------
The `search_filing` tool already enforces the refusal gate — if retrieval
scores don't clear the calibrated threshold, the tool returns
`{"refused": true, "message": "..."}`. The model sees this and can either
reformulate the query (corrective retrieval, one round) or return a
final answer explaining the corpus doesn't cover the question. Refusal
propagates as data, not as an exception.

Tracing
-------
When `LANGSMITH_API_KEY` is set in settings, LangChain automatically
pushes every LLM call, tool invocation, and state transition to
smith.langchain.com. Leave the key unset for fully-offline deployments.

Public entry point
------------------
    run_agent(question, ...) → AgentResult
        Runs the graph once and returns the final answer plus the full
        trace and extracted citations.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Annotated, Any, Optional, TypedDict

from django.conf import settings
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from .llm.langchain_adapter import build_chat_model
from .tools import ALL_TOOLS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class AgentState(TypedDict):
    """LangGraph state schema.

    - `messages`: full ReAct conversation — SystemMessage, HumanMessage,
      AIMessage (may contain tool_calls), ToolMessage (tool results),
      terminal AIMessage (final answer). Uses the `add_messages` reducer,
      so a node returning `{"messages": [x]}` APPENDS `x` to the list
      (rather than replacing the whole list).
    - `iteration_count`: number of `reason` node executions this run.
      Default TypedDict reducer replaces it — a node returning
      `{"iteration_count": n}` overwrites the old value. Nodes are
      expected to compute the incremented value themselves.
    """
    messages: Annotated[list[BaseMessage], add_messages]
    iteration_count: int


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------


SYSTEM_PROMPT = """You are an expert research analyst specialising in SEC filings.

Your job is to answer questions using ONLY facts retrieved from filings via
your tools. You never answer from memory or general knowledge. Every factual
sentence you produce must be supported by a passage returned from a tool
call, and every such sentence must carry an inline citation [S1], [S2], …
that matches the numbered sources you have retrieved.

Available tools:
  - search_filing(query, ticker?, form_type?): Grounded query over the
      ingested corpus. Returns cited passages, or `refused=true` if
      nothing clears the relevance threshold. On refusal, try ONE more
      time with a rephrased query before conceding.
  - list_filings(ticker, limit?): List filings we have for a company.
  - get_filing_metadata(filing_id): Look up a specific filing's metadata.

Discipline:
  1. Break complex questions into focused searches. One search per fact.
  2. When comparing across filings or companies, call search_filing once
     per side before synthesising.
  3. If tools consistently return `refused=true` for a question, respond
     with "I don't have enough information in the ingested filings to
     answer that." Do not fabricate. Do not answer from memory.
  4. When you have all the facts you need, STOP calling tools and produce
     the final answer with inline [S<n>] citations.
  5. Cite conservatively. Only include claims you can attribute to a
     specific returned source.
"""


# ---------------------------------------------------------------------------
# Result shape
# ---------------------------------------------------------------------------


@dataclass
class AgentResult:
    """Public result returned by `run_agent`.

    Fields mirror the old QAResult shape for API compatibility, with two
    additions (`trace`, `iterations`) that give the frontend and the eval
    harness observability into the ReAct loop.
    """
    question: str
    answer: str
    declined: bool
    confidence: str
    citations: list[dict] = field(default_factory=list)
    trace: list[dict] = field(default_factory=list)
    iterations: int = 0
    provider: str = ''
    model: str = ''

    def to_dict(self) -> dict:
        return {
            'question': self.question,
            'answer': self.answer,
            'declined': self.declined,
            'confidence': self.confidence,
            'citations': self.citations,
            'trace': self.trace,
            'iterations': self.iterations,
            'usage': {
                'provider': self.provider,
                'model': self.model,
            },
        }


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def _max_iterations() -> int:
    """Read the iteration cap from settings at call time (not import time)
    so tests and env-var changes take effect without a module reload."""
    return int(getattr(settings, 'FILINGS_AGENT_MAX_ITERATIONS', 12))


def _should_continue(state: AgentState) -> str:
    """Conditional edge: choose the next node after `reason`.

    Returns:
        "tools" if the LLM's last message requested tool calls and we're
        still under the iteration budget.
        "end" otherwise (final answer produced, or budget exhausted).
    """
    if state['iteration_count'] >= _max_iterations():
        logger.warning(
            "agent hit iteration cap (%d) — forcing terminal state",
            _max_iterations(),
        )
        return 'end'

    last = state['messages'][-1]
    has_tool_calls = isinstance(last, AIMessage) and bool(getattr(last, 'tool_calls', None))
    logger.debug(
        "conditional_edge: iter=%d/%d has_tool_calls=%s → %s",
        state['iteration_count'], _max_iterations(),
        has_tool_calls, 'tools' if has_tool_calls else 'end',
    )
    return 'tools' if has_tool_calls else 'end'


def _reason(state: AgentState) -> dict:
    """The `reason` node. One LLM call with tools bound.

    Reads the full message history, calls the LLM (with the tool schemas
    attached), appends the response to messages. The LLM's response is
    either an AIMessage with tool_calls (loop back through tools) or a
    plain AIMessage with the final answer (route to END).
    """
    chat = build_chat_model()
    chat_with_tools = chat.bind_tools(ALL_TOOLS)

    logger.debug(
        "reason node: iter=%d messages=%d",
        state['iteration_count'], len(state['messages']),
    )
    response = chat_with_tools.invoke(state['messages'])

    tool_call_count = len(getattr(response, 'tool_calls', []) or [])
    logger.debug(
        "reason node: LLM returned tool_calls=%d content_len=%d",
        tool_call_count, len(str(response.content) if response.content else ''),
    )

    return {
        'messages': [response],   # LangGraph reducers append to `messages`
        'iteration_count': state['iteration_count'] + 1,
    }


def _build_graph() -> Any:
    """Compile the LangGraph state graph. Called once at module import.

    Layout:
        START ─▶ reason ─(has tool_calls)─▶ tools ─▶ reason ─▶ …
                       └─(no tool_calls)──▶ END
    """
    graph = StateGraph(AgentState)
    graph.add_node('reason', _reason)
    graph.add_node('tools', ToolNode(ALL_TOOLS))

    graph.add_edge(START, 'reason')
    graph.add_conditional_edges(
        'reason',
        _should_continue,
        {'tools': 'tools', 'end': END},
    )
    graph.add_edge('tools', 'reason')

    return graph.compile()


# Compiled at import so the graph structure error-checks are frontloaded.
_GRAPH = _build_graph()


# ---------------------------------------------------------------------------
# Citation extraction + trace serialisation
# ---------------------------------------------------------------------------


def _extract_citations(messages: list[BaseMessage]) -> list[dict]:
    """Scan the ReAct trace for citable sources returned by tools.

    Every `search_filing` tool response includes a `sources` array. We
    walk the message history, collect all sources, dedupe by
    (chunk_id, filing_id), and renumber them into a single [S1..Sn]
    namespace matching how the model will have cited them (roughly —
    the model's citation numbering is based on tool-message order too).
    """
    seen: set[tuple] = set()
    citations: list[dict] = []
    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        try:
            payload = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(payload, dict):
            continue
        for src in payload.get('sources') or []:
            key = (src.get('chunk_id'), src.get('filing_id') or src.get('sec_url'))
            if key in seen:
                continue
            seen.add(key)
            src_with_idx = dict(src)
            src_with_idx['index'] = len(citations) + 1
            citations.append(src_with_idx)
    return citations


def _serialise_trace(messages: list[BaseMessage]) -> list[dict]:
    """Render the message history as JSON-safe dicts for API responses.

    Useful for frontend debugging panels and eval-harness replay. Only
    fields that carry information for a human reader are included.
    """
    out: list[dict] = []
    for msg in messages:
        entry = {
            'type': msg.__class__.__name__,
            'content': str(msg.content) if msg.content is not None else '',
        }
        if isinstance(msg, AIMessage):
            tool_calls = getattr(msg, 'tool_calls', None) or []
            if tool_calls:
                entry['tool_calls'] = [
                    {'name': tc.get('name'), 'args': tc.get('args')}
                    for tc in tool_calls
                ]
        elif isinstance(msg, ToolMessage):
            entry['tool_name'] = getattr(msg, 'name', None)
        out.append(entry)
    return out


def _detect_refusal(final_content: str, citations: list[dict]) -> bool:
    """Cheap heuristic to flag when the agent conceded.

    If the model produced no citations AND its terminal message contains
    a refusal phrase, mark the result as declined. This gates the
    frontend into showing the "insufficient information" UI instead of
    the answer card.
    """
    if citations:
        return False
    lowered = final_content.lower()
    return any(
        phrase in lowered
        for phrase in (
            "i don't have enough",
            'i do not have enough',
            'not enough information',
            "don't have enough information",
        )
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def run_agent(
    question: str,
    *,
    provider_name: Optional[str] = None,   # accepted for API compatibility
    model: Optional[str] = None,           # accepted for API compatibility
    use_hybrid: bool = True,               # kept for API compatibility (always on)
    use_rerank: bool = True,               # kept for API compatibility (always on)
) -> AgentResult:
    """Run the ReAct agent to answer a filings-research question.

    The agent will call `search_filing` as many times as it decides the
    question needs, subject to `FILINGS_AGENT_MAX_ITERATIONS`. It may
    also list filings or read metadata as intermediate steps.

    Args:
        question: The user's question in natural language.
        provider_name, model: Kept in the signature for backward
            compatibility with the previous static agent. Provider
            selection is now driven by `settings.LLM_PROVIDER` (or the
            per-provider `<PROVIDER>_MODEL` env var). These arguments
            are ignored — override via env vars instead.
        use_hybrid, use_rerank: Also kept for compat. Retrieval is
            always run with hybrid+rerank inside `search_filing`.

    Returns:
        AgentResult with the final answer, deduped citations, the full
        message trace, and iteration count.
    """
    logger.info("agent: run start question=%r", question[:200])

    initial_state: AgentState = {
        'messages': [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=question),
        ],
        'iteration_count': 0,
    }

    try:
        final_state = _GRAPH.invoke(initial_state)
    except Exception:
        logger.exception("agent: graph execution failed")
        raise

    final_messages: list[BaseMessage] = list(final_state['messages'])
    iterations: int = int(final_state.get('iteration_count', 0))

    # Terminal answer is the last AIMessage without tool_calls; find it.
    answer_text = ''
    for msg in reversed(final_messages):
        if isinstance(msg, AIMessage) and not getattr(msg, 'tool_calls', None):
            answer_text = str(msg.content or '').strip()
            break

    citations = _extract_citations(final_messages)
    declined = _detect_refusal(answer_text, citations)
    confidence = 'low' if declined else ('high' if len(citations) >= 3 else 'medium')

    logger.info(
        "agent: run done iterations=%d citations=%d declined=%s",
        iterations, len(citations), declined,
    )

    provider_used = (provider_name or getattr(settings, 'LLM_PROVIDER', '')).lower()

    return AgentResult(
        question=question,
        answer=answer_text or "I couldn't produce an answer.",
        declined=declined,
        confidence=confidence,
        citations=citations,
        trace=_serialise_trace(final_messages),
        iterations=iterations,
        provider=provider_used,
        model=model or '',
    )
