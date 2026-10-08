"""
Tool definitions for the LangGraph ReAct agent.

Each `@tool`-decorated function is a capability the LLM can invoke during
its ReAct loop. The model decides which tool to call and what arguments to
pass based on the docstring, so docstrings here are prompts as much as they
are documentation.

Tool contract
-------------
1. Return a JSON-serialisable string. LangGraph wraps this in a ToolMessage.
2. On error, return `{"error": "..."}` rather than raising. The model
   handles recovery — a raised exception aborts the whole graph run.
3. When returning citable data, include a top-level `"sources"` array. The
   agent's citation extractor scans for this key across the message trace.
4. Keep the tool small and focused. Compose behaviour by chaining tool
   calls, not by adding parameters.

Available tools
---------------
    search_filing         Grounded QA against ingested filings (refusal-first).
    list_filings          Enumerate filings for a company.
    get_filing_metadata   Read the metadata for one filing.

Adding a new tool
-----------------
1. Write the function with a clear docstring — the docstring is the tool's
   "system prompt" from the model's perspective.
2. Decorate with `@tool`.
3. Add the function to `ALL_TOOLS`.
4. If the tool returns citable data, make sure it emits a `sources` array
   with `chunk_id`, `filing_id`, and `sec_url` keys so the agent can
   dedupe and renumber citations across the trace.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from langchain_core.tools import tool

from ..models import Filing
from .qa import REFUSAL_TEXT, answer_question
from .retrieval import RetrievalFilters

logger = logging.getLogger(__name__)


def _dumps(obj) -> str:
    """JSON encode with safe defaults. Non-serialisable values become strings."""
    return json.dumps(obj, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@tool
def search_filing(
    query: str,
    ticker: Optional[str] = None,
    form_type: Optional[str] = None,
) -> str:
    """Search ingested SEC filings for passages that answer a query.

    Use this whenever the user's question needs data from a company's
    filing (10-K, 10-Q, 8-K). This is your primary way to retrieve grounded
    facts. Do not answer from memory — always search first.

    The search runs the full hybrid retrieval pipeline (dense + BM25 +
    reciprocal rank fusion + cross-encoder rerank) and includes a refusal
    gate. If the corpus doesn't have a good answer, the tool returns
    `refused=true` with a hint. Reformulate the query and call again with
    different phrasing before giving up.

    Args:
        query: Natural-language search query. Be specific about the fact
            you're looking for.
        ticker: Ticker to restrict search to (e.g. "AAPL"). Optional.
        form_type: Form type filter, e.g. "10-K" or "10-Q". Optional.

    Returns:
        JSON with:
          - refused: bool
          - answer: string (only when refused=false) — cited paragraph
          - sources: list of {chunk_id, filing_id, sec_url, snippet,
                              company_ticker, filing_form, filing_date}
          - message: string (only when refused=true) — human-readable hint
    """
    logger.debug(
        "search_filing: query=%r ticker=%r form_type=%r",
        query, ticker, form_type,
    )

    filters = RetrievalFilters(
        tickers=[ticker.upper()] if ticker else None,
        form_types=[form_type] if form_type else None,
    )

    try:
        result = answer_question(
            query,
            filters=filters,
            use_hybrid=True,
            use_rerank=True,
        )
    except Exception as exc:
        logger.exception("search_filing failed for query=%r", query)
        return _dumps({'error': f'search failed: {exc}', 'sources': []})

    if result.declined or result.answer == REFUSAL_TEXT:
        logger.info("search_filing declined for query=%r", query)
        return _dumps({
            'refused': True,
            'message': (
                'No passages in the corpus clear the relevance threshold. '
                'Try rephrasing with different terminology, or narrow the '
                'ticker/form_type filter.'
            ),
            'sources': [],
        })

    sources = [
        {
            'chunk_id': c.chunk_id,
            'company_ticker': c.company_ticker,
            'filing_form': c.filing_form,
            'filing_date': c.filing_date,
            'section_name': c.section_name,
            'snippet': c.snippet,
            'sec_url': c.source_url,
            'score': round(c.score, 3),
        }
        for c in result.citations
    ]
    logger.info(
        "search_filing found %d cited sources for query=%r",
        len(sources), query,
    )
    return _dumps({
        'refused': False,
        'answer': result.answer,
        'sources': sources,
    })


@tool
def list_filings(ticker: str, limit: int = 10) -> str:
    """List filings we have ingested for a company.

    Use this when the user asks about a company but hasn't specified which
    filing, or when you need to compare across filings and need their ids.

    Args:
        ticker: Company ticker (e.g. "AAPL", "MSFT"). Case-insensitive.
        limit: Max number of filings to return. Default 10.

    Returns:
        JSON with `filings`: list of {filing_id, form_type, filed_date,
        fiscal_year, source_url}. Newest first. Empty list if the company
        or its filings haven't been ingested yet.
    """
    logger.debug("list_filings: ticker=%r limit=%d", ticker, limit)

    filings = (
        Filing.objects
        .select_related('company')
        .filter(company__ticker__iexact=ticker)
        .order_by('-filed_date')[:max(1, min(limit, 50))]
    )

    return _dumps({
        'filings': [
            {
                'filing_id': f.id,
                'form_type': f.form_type,
                'filed_date': f.filed_date.isoformat() if f.filed_date else None,
                'fiscal_year': getattr(f, 'fiscal_year', None),
                'source_url': f.source_url,
            }
            for f in filings
        ],
    })


@tool
def get_filing_metadata(filing_id: int) -> str:
    """Get metadata for a specific filing by id.

    Use this to look up a filing's period, form type, or source URL when
    you have the id from a prior `list_filings` call and need details.

    Args:
        filing_id: Numeric filing id returned by `list_filings`.

    Returns:
        JSON with the filing's metadata, or `{"error": "not found"}` if
        the id doesn't exist.
    """
    logger.debug("get_filing_metadata: filing_id=%d", filing_id)

    try:
        f = Filing.objects.select_related('company').get(pk=filing_id)
    except Filing.DoesNotExist:
        return _dumps({'error': f'filing {filing_id} not found'})

    return _dumps({
        'filing_id': f.id,
        'ticker': f.company.ticker,
        'company_name': f.company.name,
        'form_type': f.form_type,
        'filed_date': f.filed_date.isoformat() if f.filed_date else None,
        'fiscal_year': getattr(f, 'fiscal_year', None),
        'source_url': f.source_url,
    })


# Tools the agent is allowed to call. Order matters only for the model's
# reading order in the tool schema — put the most commonly-used first.
ALL_TOOLS = [search_filing, list_filings, get_filing_metadata]
