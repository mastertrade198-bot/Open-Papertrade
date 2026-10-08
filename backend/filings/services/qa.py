"""
Grounded question-answering pipeline for SEC filings.

This module is the "leaf" that the ReAct agent's `search_filing` tool calls
into. It is also usable directly (via the `POST /api/filings/ask/` endpoint
when `agent=false`) for single-shot QA against the ingested corpus.

Behaviour (in one sentence):
    Retrieve → filter by relevance threshold → refuse if nothing clears →
    otherwise call the LLM with the surviving chunks and a strict grounded
    system prompt, and parse the LLM's JSON reply into an answer + citations.

The refusal-first contract lives in `_is_relevant()`. Every retrieval score
type (dense cosine, RRF-fused, cross-encoder logit) has a different scale,
so the gate branches on which score was produced rather than applying a
single numeric threshold across the whole pipeline.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from .llm import LLMMessage, get_provider
from .prompts import GROUNDED_QA_SYSTEM, build_qa_user_message
from .retrieval import RetrievalFilters, RetrievedChunk, search

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# The exact string the pipeline returns when nothing clears the relevance
# gate. Kept as a module constant so the agent's tool can detect it and
# the frontend can style refusals distinctly from answers.
REFUSAL_TEXT = "I don't have enough information in the provided filings to answer that."

# Retrieval defaults. These match the values used by the ReAct agent's
# search_filing tool; direct callers can override per-call.
DEFAULT_TOP_K = 6
DEFAULT_CANDIDATE_MULTIPLIER = 4          # candidate_k = max(top_k * this, 20)
DEFAULT_CANDIDATE_MIN = 20

# Relevance gate thresholds. Calibrated on a labeled dev set of 60 positive
# + 40 trap questions to maximise correct answers subject to refusal
# accuracy ≥ 95% on the traps.
#
# `min_dense`: cosine similarity of a chunk that only came from dense
# search (no rerank ran). Below 0.15, chunks are just topically similar,
# not answer-carrying.
#
# `min_rerank`: cross-encoder logit. Unbounded, but empirically anything
# below -5.0 is the model saying "unrelated." Positive logits are strong.
DEFAULT_MIN_DENSE_SCORE = 0.15
DEFAULT_MIN_RERANK_SCORE = -5.0

# LLM call knobs. `max_tokens` is deliberately tight — the grounded QA
# response is small (a citation-heavy paragraph, JSON envelope). Temperature
# is zero because we want reproducible, deterministic grounded output.
LLM_TEMPERATURE = 0.0
LLM_MAX_TOKENS = 800

# Snippet display length in citations. Frontend clamps further with CSS.
CITATION_SNIPPET_MAX_CHARS = 320

# When the LLM produces an answer but forgets to include the JSON
# `citations` array, we fall back to attaching the top-N retrieved chunks
# as citations so the user still gets clickable sources.
FALLBACK_CITATION_COUNT = 3


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass
class Citation:
    """One source in the answer. Corresponds to an [S<index>] marker."""
    index: int
    chunk_id: int
    company_ticker: str
    filing_form: str
    filing_date: str
    section_name: str
    snippet: str
    source_url: str
    score: float


@dataclass
class QAResult:
    """Return value of `answer_question`. Serialisable via `.to_dict()`."""
    question: str
    answer: str
    declined: bool
    confidence: str
    citations: list[Citation]
    retrieved: list[RetrievedChunk] = field(default_factory=list)
    provider: str = ''
    model: str = ''
    input_tokens: int = 0
    output_tokens: int = 0

    def to_dict(self) -> dict:
        return {
            'question': self.question,
            'answer': self.answer,
            'declined': self.declined,
            'confidence': self.confidence,
            'citations': [c.__dict__ for c in self.citations],
            'usage': {
                'provider': self.provider,
                'model': self.model,
                'input_tokens': self.input_tokens,
                'output_tokens': self.output_tokens,
            },
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


_JSON_BLOCK_RE = re.compile(r'\{.*\}', re.DOTALL)


def _extract_json(text: str) -> Optional[dict]:
    """Extract the first JSON object from a possibly-messy LLM response.

    The grounded QA system prompt asks for a strict JSON envelope, but some
    providers wrap it in markdown fences, leading whitespace, or a preamble.
    We greedily match the outermost `{...}` block and try to parse it.

    Returns:
        The parsed dict, or None if no JSON object was found or it was
        malformed. Callers should fall back to using the raw text as the
        answer when this returns None.
    """
    match = _JSON_BLOCK_RE.search(text)
    if not match:
        logger.debug("qa: LLM returned no JSON block (length=%d)", len(text))
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        logger.warning("qa: JSON parse failed: %s (first 200 chars=%r)", e, text[:200])
        return None


def _snippet(text: str, max_len: int = CITATION_SNIPPET_MAX_CHARS) -> str:
    """Truncate at the last word boundary before `max_len`."""
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(' ', 1)[0] + '…'


def _is_relevant(r: RetrievedChunk, min_dense: float, min_rerank: float) -> bool:
    """Score-type-aware relevance gate.

    Different retrieval layers produce scores on incompatible scales:
        - dense cosine similarity ∈ [-1, 1], mostly [0, 1] for text
        - RRF-fused rank scores ∈ [0, ~0.05] (reciprocal of ranks)
        - cross-encoder logits ∈ ~[-10, +10], unbounded

    A single numeric threshold cannot separate relevant from irrelevant
    across all three. So we check whichever score is populated on this
    chunk, in the order the pipeline produced them:

        rerank present  →  use min_rerank (most trustworthy signal)
        else fused > 0  →  chunk survived hybrid fusion, keep it
        else dense      →  compare against min_dense

    Returns:
        True if the chunk clears the relevance threshold for whichever
        signal is on it. False otherwise.
    """
    if r.rerank_score != 0.0:
        return r.rerank_score >= min_rerank
    if r.fused_score > 0.0:
        return True
    return r.dense_score >= min_dense


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def answer_question(
    question: str,
    *,
    filters: Optional[RetrievalFilters] = None,
    top_k: int = DEFAULT_TOP_K,
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    use_hybrid: bool = False,
    use_rerank: bool = False,
    min_score: float = DEFAULT_MIN_DENSE_SCORE,
    min_rerank_score: float = DEFAULT_MIN_RERANK_SCORE,
) -> QAResult:
    """Answer a natural-language question over the ingested filing corpus.

    Pipeline:
        1. Retrieve `candidate_k` chunks (dense-only or hybrid+rerank).
        2. Filter by the score-aware relevance gate.
        3. If nothing survives → return REFUSAL_TEXT.
        4. Otherwise → call the LLM with the survivors + grounded prompt.
        5. Parse the LLM's JSON envelope for answer + citations.

    Args:
        question: The user's question.
        filters: Optional retrieval filters (ticker, form_type, section, year).
        top_k: How many chunks to keep as final grounded context.
        provider_name: Override `LLM_PROVIDER` env var.
        model: Override the provider-specific model.
        use_hybrid: Enable BM25 + RRF alongside dense.
        use_rerank: Enable cross-encoder reranking.
        min_score: Dense-cosine threshold for the refusal gate.
        min_rerank_score: Cross-encoder logit threshold for the refusal gate.

    Returns:
        A QAResult. Check `.declined` to distinguish refusals from answers.
    """
    logger.info(
        "qa: answer_question q=%r top_k=%d hybrid=%s rerank=%s",
        question[:120], top_k, use_hybrid, use_rerank,
    )

    candidate_k = max(top_k * DEFAULT_CANDIDATE_MULTIPLIER, DEFAULT_CANDIDATE_MIN)
    retrieved = search(
        question,
        top_k=top_k,
        filters=filters,
        use_hybrid=use_hybrid,
        use_rerank=use_rerank,
        candidate_k=candidate_k,
    )
    logger.debug("qa: retrieval returned %d chunks (candidate_k=%d)", len(retrieved), candidate_k)

    strong = [r for r in retrieved if _is_relevant(r, min_score, min_rerank_score)]
    logger.info(
        "qa: relevance gate kept %d/%d chunks (min_dense=%.3f min_rerank=%.2f)",
        len(strong), len(retrieved), min_score, min_rerank_score,
    )

    if not strong:
        logger.info("qa: refusing — no chunks cleared the relevance gate")
        return QAResult(
            question=question,
            answer=REFUSAL_TEXT,
            declined=True,
            confidence='low',
            citations=[],
            retrieved=retrieved,
        )

    provider = get_provider(provider_name, model=model)
    user_msg = build_qa_user_message(question, strong)
    logger.debug("qa: calling provider=%s model=%s", provider.name, provider.model)

    resp = provider.complete(
        [LLMMessage(role='user', content=user_msg)],
        system=GROUNDED_QA_SYSTEM,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
    )
    logger.debug(
        "qa: provider returned tokens_in=%d tokens_out=%d",
        resp.input_tokens, resp.output_tokens,
    )

    parsed = _extract_json(resp.text) or {}
    answer = str(parsed.get('answer') or resp.text).strip()
    declined = bool(parsed.get('declined')) or answer.startswith(REFUSAL_TEXT[:20])
    confidence = str(parsed.get('confidence') or ('low' if declined else 'medium'))

    citations = _build_citations_from_llm_response(parsed.get('citations'), strong)
    if not citations and not declined:
        logger.debug(
            "qa: LLM emitted no citation indices — attaching top %d chunks as fallback",
            FALLBACK_CITATION_COUNT,
        )
        citations = _fallback_citations(strong)

    logger.info(
        "qa: complete declined=%s citations=%d confidence=%s",
        declined, len(citations), confidence,
    )
    return QAResult(
        question=question,
        answer=answer,
        declined=declined,
        confidence=confidence,
        citations=citations,
        retrieved=strong,
        provider=resp.provider,
        model=resp.model,
        input_tokens=resp.input_tokens,
        output_tokens=resp.output_tokens,
    )


def _build_citations_from_llm_response(
    cited_idx: object,
    strong: list[RetrievedChunk],
) -> list[Citation]:
    """Turn the LLM's `citations: [1, 3, 5]` array into Citation objects.

    Silently drops out-of-range or non-integer entries — the LLM sometimes
    hallucinates citation indices, and we'd rather show a partial answer
    than error out on a bad number.
    """
    if not isinstance(cited_idx, list):
        return []
    citations: list[Citation] = []
    for idx in cited_idx:
        try:
            n = int(idx)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= len(strong):
            citations.append(_chunk_to_citation(n, strong[n - 1]))
    return citations


def _fallback_citations(strong: list[RetrievedChunk]) -> list[Citation]:
    """Attach the top-N chunks as citations when the LLM forgot to."""
    return [
        _chunk_to_citation(i, r)
        for i, r in enumerate(strong[:FALLBACK_CITATION_COUNT], start=1)
    ]


def _chunk_to_citation(index: int, r: RetrievedChunk) -> Citation:
    """Materialise a Citation from a RetrievedChunk at position `index`."""
    return Citation(
        index=index,
        chunk_id=r.chunk_id,
        company_ticker=r.company_ticker,
        filing_form=r.filing_form,
        filing_date=r.filing_date,
        section_name=r.section_name,
        snippet=_snippet(r.text),
        source_url=r.source_url,
        score=r.final_score,
    )
