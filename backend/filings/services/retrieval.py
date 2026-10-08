"""
Retrieval over ingested filing chunks.

Two public entry points:

    dense_search(query, top_k, filters)
        Pure vector search. `np.matmul` over every eligible chunk's
        embedding, argsort by score, return the top_k. Fast (~50ms at
        100k chunks) because embeddings live in Postgres as raw bytes,
        not in a separate vector DB.

    search(query, top_k, filters, use_hybrid=True, use_rerank=True)
        The composed pipeline. Runs dense retrieval to get a large
        candidate set, optionally fuses with BM25 via reciprocal rank
        fusion, optionally reranks with a cross-encoder, and returns the
        final top_k. This is what `qa.answer_question` and the ReAct
        agent's `search_filing` tool use.

Filtering
---------
Both entry points accept a `RetrievalFilters` object that scopes the
search to specific tickers, form types, sections, or fiscal years. All
filters are ANDed. Filters are applied at the ORM level before the
matmul so we never materialise embeddings for chunks we'll discard.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from django.db.models import Q

from ..models import Chunk
from . import embeddings as emb

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# `search()` runs dense retrieval to build a candidate pool that the fusion
# and rerank stages narrow down. Bigger pool = better recall, slower rerank.
# 40 is a good balance at our current scale — the cross-encoder handles it
# in ~200ms on CPU.
DEFAULT_CANDIDATE_K = 40


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------


@dataclass
class RetrievedChunk:
    """One chunk returned by retrieval, carrying every score produced.

    Different pipeline stages populate different fields. `_is_relevant()`
    in `qa.py` uses `final_score`-like logic to decide which one to trust.
    """
    chunk_id: int
    text: str
    company_ticker: str
    filing_id: int
    filing_form: str
    filing_date: str
    section_name: str
    order: int
    dense_score: float = 0.0
    sparse_score: float = 0.0
    rerank_score: float = 0.0
    fused_score: float = 0.0
    source_url: str = ''
    scores: dict = field(default_factory=dict)

    @property
    def final_score(self) -> float:
        """The score most representative of this chunk's rank.

        Prefer rerank (most accurate) > fusion > dense (raw).
        """
        if self.rerank_score:
            return self.rerank_score
        if self.fused_score:
            return self.fused_score
        return self.dense_score


@dataclass
class RetrievalFilters:
    """Scope filters, AND-ed at query time. All optional."""
    tickers: Optional[list[str]] = None
    form_types: Optional[list[str]] = None
    section_names: Optional[list[str]] = None
    fiscal_years: Optional[list[int]] = None


# ---------------------------------------------------------------------------
# ORM filter application
# ---------------------------------------------------------------------------


def _apply_filters(qs, f: RetrievalFilters):
    """Apply RetrievalFilters to a Chunk queryset. Log which filters fired."""
    applied = []
    if f.tickers:
        qs = qs.filter(company__ticker__in=[t.upper() for t in f.tickers])
        applied.append(f'tickers={f.tickers}')
    if f.form_types:
        qs = qs.filter(filing__form_type__in=f.form_types)
        applied.append(f'form_types={f.form_types}')
    if f.section_names:
        qs = qs.filter(section__name__in=f.section_names)
        applied.append(f'section_names={f.section_names}')
    if f.fiscal_years:
        qs = qs.filter(filing__fiscal_year__in=f.fiscal_years)
        applied.append(f'fiscal_years={f.fiscal_years}')
    if applied:
        logger.debug("retrieval: filters applied — %s", '; '.join(applied))
    return qs


# ---------------------------------------------------------------------------
# Dense (vector) retrieval
# ---------------------------------------------------------------------------


def dense_search(
    query: str,
    top_k: int = 20,
    filters: Optional[RetrievalFilters] = None,
) -> list[RetrievedChunk]:
    """Cosine-similarity search over the entire eligible chunk pool.

    The chunks are stored with embeddings as `BinaryField` bytes. We
    load every non-empty embedding into a numpy matrix, embed the query,
    and compute similarities via `matrix @ q_vec`. At ~100k chunks this
    is ~50ms end to end.

    Args:
        query: Natural-language query.
        top_k: How many top chunks to return.
        filters: Optional scoping (ticker, form, section, year).

    Returns:
        Up to top_k RetrievedChunk objects sorted by cosine similarity
        descending. Empty list if no eligible chunks or the corpus is
        empty.

    Raises:
        ValueError: The query and stored embeddings have mismatched
            dimensions (usually caused by changing the embedding model
            after ingestion — see settings.FILINGS_EMBEDDING_MODEL).
    """
    filters = filters or RetrievalFilters()
    qs = Chunk.objects.select_related('company', 'filing', 'section').filter(
        ~Q(embedding=None) & ~Q(embedding=b'')
    )
    qs = _apply_filters(qs, filters)

    rows = list(qs)
    if not rows:
        logger.info("dense_search: no eligible chunks in corpus for filters")
        return []

    dim = rows[0].embedding_dim
    matrix = np.stack([
        np.frombuffer(bytes(r.embedding), dtype=np.float32).reshape(dim)
        for r in rows
    ])

    q_vec = emb.embed_query(query)
    if q_vec.shape[0] != dim:
        raise ValueError(
            f'Query embedding dim {q_vec.shape[0]} != stored dim {dim}. '
            f'The embedding model changed since ingestion. Re-embed the corpus.'
        )

    sims = matrix @ q_vec
    top_idx = np.argsort(-sims)[:top_k]
    logger.debug(
        "dense_search: %d rows scored → top_k=%d (max_sim=%.3f)",
        len(rows), top_k, float(sims[top_idx[0]]) if len(top_idx) else 0.0,
    )

    out: list[RetrievedChunk] = []
    for idx in top_idx:
        r = rows[int(idx)]
        out.append(RetrievedChunk(
            chunk_id=r.id,
            text=r.text,
            company_ticker=r.company.ticker,
            filing_id=r.filing_id,
            filing_form=r.filing.form_type,
            filing_date=r.filing.filed_date.isoformat(),
            section_name=r.section.name,
            order=r.order,
            dense_score=float(sims[int(idx)]),
            source_url=r.filing.source_url,
        ))
    return out


# ---------------------------------------------------------------------------
# Composed pipeline (dense → fusion → rerank)
# ---------------------------------------------------------------------------


def search(
    query: str,
    top_k: int = 10,
    filters: Optional[RetrievalFilters] = None,
    *,
    use_hybrid: bool = False,
    use_rerank: bool = False,
    candidate_k: int = DEFAULT_CANDIDATE_K,
) -> list[RetrievedChunk]:
    """The composed retrieval pipeline used by QA and the agent.

    Path selection:
        - use_hybrid=False, use_rerank=False → just `dense_search`.
        - use_hybrid=True, use_rerank=False → dense + BM25 fused via RRF.
        - use_hybrid=False, use_rerank=True → dense candidates reranked.
        - use_hybrid=True, use_rerank=True → the full pipeline (default
          for the agent's search_filing tool).

    Args:
        query: Natural-language query.
        top_k: Final result count after all stages.
        filters: Scoping filters.
        use_hybrid: Fuse dense retrieval with BM25 via reciprocal rank fusion.
        use_rerank: Cross-encoder rerank the final candidate set.
        candidate_k: How many chunks to pass into fusion/rerank stages.
            Bigger = better recall, slower. Default 40.

    Returns:
        Up to top_k RetrievedChunk objects. Score fields populated
        according to which stages ran.
    """
    if not use_hybrid and not use_rerank:
        logger.debug("search: path=dense-only top_k=%d", top_k)
        return dense_search(query, top_k=top_k, filters=filters)

    logger.debug(
        "search: path=composed hybrid=%s rerank=%s candidate_k=%d top_k=%d",
        use_hybrid, use_rerank, candidate_k, top_k,
    )
    candidates = dense_search(query, top_k=candidate_k, filters=filters)
    logger.debug("search: dense candidates=%d", len(candidates))

    if use_hybrid:
        # Local imports keep the dense-only path free of these deps at
        # startup — matters for cold-start latency in serverless.
        from .bm25 import bm25_search
        from .fusion import rrf_fuse
        sparse = bm25_search(query, top_k=candidate_k, filters=filters)
        candidates = rrf_fuse(candidates, sparse, top_k=candidate_k)
        logger.debug("search: post-RRF candidates=%d", len(candidates))

    if use_rerank and candidates:
        from .rerank import cross_encoder_rerank
        candidates = cross_encoder_rerank(query, candidates, top_k=top_k)
        logger.debug("search: post-rerank candidates=%d (returning)", len(candidates))
    else:
        candidates = candidates[:top_k]

    return candidates
