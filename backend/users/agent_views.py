"""
HTTP views for the AI-agent MCP integration + benchmarking system.

These endpoints are what the `mcp-server/` package (and any other
programmatic client) call into. All authenticated views use the
`APIKeyAuthentication` backend and expect
`Authorization: Bearer opt_<key>`.

Endpoint map
------------

    POST   /api/agents/register/
        Create an isolated sandbox account for an AI agent. Public
        (unauthenticated) — the response includes a freshly-minted API
        key which the developer configures into their MCP client.

    GET    /api/agents/me/
        Return the authenticated agent's profile + portfolio summary.
        Handy first call for the MCP to verify auth is working.

    GET    /api/benchmarks/
    GET    /api/benchmarks/<key>/
        List / read benchmark definitions. Public.

    POST   /api/benchmarks/<key>/runs/
        Start a new benchmark run for the authenticated agent. Resets
        the agent's virtual portfolio to `starting_cash` and stamps
        an `ends_at` deadline. Cannot be started while another run is
        already in-flight for this agent.

    GET    /api/agents/me/runs/
        List this agent's benchmark runs (newest first).

    GET    /api/benchmark-runs/<uuid>/
        Read one run. If status is 'complete' and score fields are unset,
        this call triggers scoring lazily.

    POST   /api/benchmark-runs/<uuid>/finalize/
        Force-close the run now (before deadline). Computes final score.

    POST   /api/benchmark-runs/<uuid>/notes/
        Append an AgentActionLog entry (agent reasoning journal).

    GET    /api/benchmarks/<key>/leaderboard/
        Top N completed runs for a benchmark, ranked by final_score.

Design notes
------------
Every endpoint returns a `{data, error}`-style JSON body via DRF's
`Response`, matching the rest of the platform. Errors carry an
`error_code` string (agent-parseable) plus a `message` string
(human-readable). This is worth the extra structure because MCP clients
will consume these programmatically — a stringly-typed error is easy to
mishandle in the model's reasoning loop.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from stocks.services import get_stock_service

from .api_key_auth import APIKeyAuthentication
from .benchmarks import BENCHMARKS, get_benchmark, score_run
from .models import APIKey, AgentActionLog, BenchmarkRun, Holding, Trade, UserProfile

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


def _error(code: str, message: str, http_status: int = 400, **extra) -> Response:
    """Standardised error payload for MCP-consumable responses."""
    body = {'error_code': code, 'message': message}
    body.update(extra)
    return Response(body, status=http_status)


def _price_lookup_factory():
    """Build a symbol → price callable that reuses the singleton stock service.

    Returns a callable so scoring functions can call it many times without
    knowing about the underlying service. Prices are cached inside
    `StockService` for STOCK_CACHE_TTL seconds.
    """
    svc = get_stock_service()

    def lookup(symbol: str) -> Optional[float]:
        try:
            result = svc.get_quote(symbol)
            if not result.success or result.data is None:
                return None
            return float(result.data.price)
        except Exception:
            logger.exception("price_lookup: failed for %s", symbol)
            return None

    return lookup


# ---------------------------------------------------------------------------
# Agent registration + identity
# ---------------------------------------------------------------------------


class RegisterAgentView(APIView):
    """POST /api/agents/register/ — public.

    Body:
        {
          "agent_model": "gpt-4o",             # required, free-text label
          "display_name": "GPT-4o benchmark",  # optional
          "starting_cash": 100000              # optional, default 100k
        }

    Response 201:
        {
          "agent": { profile fields },
          "api_key": "opt_abcdef...",     # SHOWN ONCE — store it now
          "api_key_id": "<uuid>"
        }
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        agent_model = (request.data.get('agent_model') or '').strip()
        display_name = (request.data.get('display_name') or agent_model).strip()
        starting_cash = Decimal(str(request.data.get('starting_cash') or 100_000))

        if not agent_model:
            return _error(
                'missing_field',
                "agent_model is required (e.g. 'gpt-4o', 'claude-3-5-sonnet').",
            )
        if not display_name:
            display_name = agent_model
        if starting_cash <= 0 or starting_cash > 10_000_000:
            return _error(
                'invalid_starting_cash',
                'starting_cash must be between 0 and 10,000,000.',
            )

        # Generate a URL-safe username unique per agent instance. The `-agent-`
        # infix makes agent sandboxes trivially filterable in admin queries.
        rand = secrets.token_hex(4)
        username = f'agent-{agent_model.lower().replace(" ", "-")[:20]}-{rand}'[:30]
        email = f'{username}@sandbox.open-papertrade.local'

        with transaction.atomic():
            profile = UserProfile.objects.create(
                id=uuid.uuid4(),
                name=display_name[:100],
                username=username,
                email=email,
                # Empty password — this account can never log in via the
                # normal auth path. API key is the only way in.
                password='',
                is_email_verified=True,
                is_agent=True,
                agent_model=agent_model[:100],
                buying_power=starting_cash,
                initial_balance=starting_cash,
            )
            raw_key = f'opt_{secrets.token_hex(20)}'
            key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
            api_key = APIKey.objects.create(
                user=profile,
                name=f'MCP · {agent_model}',
                key_prefix=raw_key[:8],
                key_hash=key_hash,
            )

        logger.info(
            "register_agent: created username=%s agent_model=%s api_key_id=%s",
            username, agent_model, api_key.id,
        )

        return Response(
            {
                'agent': {
                    'id': str(profile.id),
                    'username': profile.username,
                    'display_name': profile.name,
                    'agent_model': profile.agent_model,
                    'starting_cash': float(profile.initial_balance),
                    'buying_power': float(profile.buying_power),
                },
                'api_key': raw_key,
                'api_key_id': str(api_key.id),
                'note': (
                    'Save the api_key now — it is only shown once. Configure '
                    'it as PAPERTRADE_API_KEY in your MCP client env.'
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class AgentMeView(APIView):
    """GET /api/agents/me/ — auth verification + portfolio summary."""
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        agent: UserProfile = request.user
        holdings_count = Holding.objects.filter(user=agent, quantity__gt=0).count()
        trades_count = Trade.objects.filter(user=agent).count()
        active_run = BenchmarkRun.objects.filter(agent=agent, status='running').first()

        return Response({
            'agent': {
                'id': str(agent.id),
                'username': agent.username,
                'display_name': agent.name,
                'agent_model': agent.agent_model,
                'is_agent': agent.is_agent,
                'buying_power': float(agent.buying_power),
                'initial_balance': float(agent.initial_balance),
                'holdings_count': holdings_count,
                'trades_count': trades_count,
            },
            'active_run': active_run.to_dict() if active_run else None,
        })


# ---------------------------------------------------------------------------
# Benchmark catalog (public reads)
# ---------------------------------------------------------------------------


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_benchmarks(request):
    """GET /api/benchmarks/ — list all benchmark definitions."""
    return Response({
        'benchmarks': [
            {'key': key, **spec}
            for key, spec in BENCHMARKS.items()
        ],
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_benchmark_detail(request, key: str):
    """GET /api/benchmarks/<key>/ — one benchmark spec."""
    try:
        spec = get_benchmark(key)
    except KeyError as e:
        return _error('unknown_benchmark', str(e), http_status=404)
    return Response({'key': key, **spec})


# ---------------------------------------------------------------------------
# Benchmark run lifecycle (API-key auth)
# ---------------------------------------------------------------------------


class StartBenchmarkRunView(APIView):
    """POST /api/benchmarks/<key>/runs/ — start a run.

    Effects:
        - Resets the caller's `buying_power` to the benchmark's starting_cash.
        - Deletes existing holdings (they belong to a prior run).
        - Creates a BenchmarkRun row with status='running'.
        - Refuses if the caller already has a run in status 'running'.
    """
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, key: str):
        agent: UserProfile = request.user
        try:
            spec = get_benchmark(key)
        except KeyError as e:
            return _error('unknown_benchmark', str(e), http_status=404)

        existing = BenchmarkRun.objects.filter(
            agent=agent, status__in=['pending', 'running']
        ).first()
        if existing:
            return _error(
                'run_in_flight',
                'You already have an active run. Finalize it before starting another.',
                run_id=str(existing.id),
                http_status=409,
            )

        starting_cash = Decimal(str(spec['starting_cash']))
        duration_days = int(spec['duration_days'])
        ends_at = timezone.now() + timedelta(days=duration_days)

        with transaction.atomic():
            # Reset the sandbox — the previous run's state is preserved
            # in Trade + BenchmarkRun rows for post-hoc analysis, but the
            # live portfolio starts fresh.
            Holding.objects.filter(user=agent).delete()
            agent.buying_power = starting_cash
            agent.initial_balance = starting_cash
            agent.save(update_fields=['buying_power', 'initial_balance'])

            run = BenchmarkRun.objects.create(
                agent=agent,
                benchmark_key=key,
                benchmark_snapshot={'key': key, **spec},
                status='running',
                starting_cash=starting_cash,
                ends_at=ends_at,
            )

        logger.info(
            "start_benchmark_run: agent=%s benchmark=%s run=%s ends_at=%s",
            agent.username, key, run.id, ends_at.isoformat(),
        )
        return Response(run.to_dict(), status=status.HTTP_201_CREATED)


class MyRunsView(APIView):
    """GET /api/agents/me/runs/ — list this agent's runs, newest first."""
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = min(int(request.query_params.get('limit', 20)), 100)
        runs = BenchmarkRun.objects.filter(agent=request.user)[:limit]
        return Response({'runs': [r.to_dict() for r in runs]})


class RunDetailView(APIView):
    """GET /api/benchmark-runs/<uuid>/ — read one run.

    Lazy scoring: if the run's `ends_at` has passed and score fields
    are still null, score it now before returning.
    """
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id):
        try:
            run = BenchmarkRun.objects.get(pk=run_id, agent=request.user)
        except BenchmarkRun.DoesNotExist:
            return _error('not_found', 'No such run for this agent.', http_status=404)

        if run.status == 'running' and timezone.now() >= run.ends_at:
            _finalize(run)
        return Response(run.to_dict())


class FinalizeRunView(APIView):
    """POST /api/benchmark-runs/<uuid>/finalize/ — close a run early."""
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, run_id):
        try:
            run = BenchmarkRun.objects.get(pk=run_id, agent=request.user)
        except BenchmarkRun.DoesNotExist:
            return _error('not_found', 'No such run for this agent.', http_status=404)
        if run.status in ('complete', 'failed'):
            return Response(run.to_dict())        # already finalized — idempotent
        _finalize(run)
        return Response(run.to_dict())


class RunNotesView(APIView):
    """POST /api/benchmark-runs/<uuid>/notes/ — append reasoning journal entry."""
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, run_id):
        try:
            run = BenchmarkRun.objects.get(pk=run_id, agent=request.user)
        except BenchmarkRun.DoesNotExist:
            return _error('not_found', 'No such run for this agent.', http_status=404)

        content = (request.data.get('content') or '').strip()
        kind = (request.data.get('kind') or 'note').strip()[:32]
        if not content:
            return _error('missing_field', 'content is required.')
        if len(content) > 20_000:
            return _error('too_long', 'content must be <= 20,000 chars.')

        note = AgentActionLog.objects.create(run=run, kind=kind, content=content)
        return Response(note.to_dict(), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Leaderboard (public)
# ---------------------------------------------------------------------------


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def benchmark_leaderboard(request, key: str):
    """GET /api/benchmarks/<key>/leaderboard/ — top N completed runs."""
    limit = min(int(request.query_params.get('limit', 25)), 100)
    runs = (
        BenchmarkRun.objects
        .filter(benchmark_key=key, status='complete', final_score__isnull=False)
        .order_by('-final_score')[:limit]
    )
    return Response({
        'benchmark': key,
        'leaderboard': [
            {
                'rank': i + 1,
                'agent_model': r.agent.agent_model,
                'agent_username': r.agent.username,
                'final_score': r.final_score,
                'final_pnl': float(r.final_pnl) if r.final_pnl is not None else None,
                'final_pnl_pct': r.final_pnl_pct,
                'finalized_at': r.finalized_at.isoformat() if r.finalized_at else None,
                'run_id': str(r.id),
            }
            for i, r in enumerate(runs)
        ],
    })


# ---------------------------------------------------------------------------
# Internal — scoring dispatch
# ---------------------------------------------------------------------------


def _finalize(run: BenchmarkRun) -> None:
    """Score a run and persist the results.

    Called by:
      - the explicit /finalize/ endpoint (agent chose to stop early)
      - lazy path in RunDetailView when ends_at has passed

    Any exception during scoring flips the run to status='failed' with
    the traceback captured in `error`, rather than propagating a 500.
    """
    logger.info("finalize: run=%s", run.id)
    price_lookup = _price_lookup_factory()

    try:
        result = score_run(run, price_lookup)
    except Exception as exc:
        logger.exception("finalize: scoring raised for run=%s", run.id)
        run.status = 'failed'
        run.error = str(exc)[:2000]
        run.finalized_at = timezone.now()
        run.save(update_fields=['status', 'error', 'finalized_at'])
        return

    run.status = 'complete'
    run.finalized_at = timezone.now()
    run.final_portfolio_value = result.portfolio_value
    run.final_pnl = result.pnl
    run.final_pnl_pct = result.pnl_pct
    run.final_score = result.score
    run.scoring_details = result.details
    run.save(update_fields=[
        'status', 'finalized_at', 'final_portfolio_value',
        'final_pnl', 'final_pnl_pct', 'final_score', 'scoring_details',
    ])
