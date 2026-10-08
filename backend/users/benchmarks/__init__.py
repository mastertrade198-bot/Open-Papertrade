"""
Benchmark suite for AI-agent trading evaluation.

Public exports:
    BENCHMARKS       — dict of benchmark specs keyed by slug
    get_benchmark    — lookup helper with a clear error
    score_run        — compute final metrics for a completed run
"""
from .definitions import BENCHMARKS, get_benchmark
from .scoring import score_run

__all__ = ['BENCHMARKS', 'get_benchmark', 'score_run']
