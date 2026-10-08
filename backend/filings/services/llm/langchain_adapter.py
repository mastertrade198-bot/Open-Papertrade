"""
LangChain chat-model builder that honours our six-provider LLM_PROVIDER config.

Purpose
-------
The LangGraph agent needs a `BaseChatModel` with native tool-calling support.
Rather than reimplementing each provider's tool-call wire format ourselves,
this module maps our `LLM_PROVIDER` env var to the matching langchain-<provider>
chat model, which already handles the translation correctly.

Result: our six-provider selection story is preserved end-to-end, and every
provider gets battle-tested tool-call plumbing for free.

Providers supported
-------------------
    anthropic       → ChatAnthropic
    openai          → ChatOpenAI
    openrouter      → ChatOpenAI(base_url=openrouter.ai)  (OpenAI-compatible)
    mistral         → ChatMistralAI
    ollama          → ChatOllama                          (local, no key required)
    local           → ChatOpenAI(base_url=custom)         (generic OpenAI-compatible)

Environment variables
---------------------
The provider is selected by `LLM_PROVIDER`. Each provider also reads its own
model override (`ANTHROPIC_MODEL`, `OPENAI_MODEL`, …). A universal fallback
`LLM_MODEL` applies to all providers when the provider-specific override is
absent.

Non-goals
---------
This module does NOT replace the `BaseLLMProvider` abstraction. That still
powers the grounded-QA path in `qa.py` for direct prompt→completion calls
where tool-calling is not needed. The two coexist by design — LangChain
handles agent orchestration; our providers handle deterministic QA.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from django.conf import settings
from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)


# Default models are conservative picks that reliably support tool calling.
# Users override with the *_MODEL env var (or the universal LLM_MODEL).
_DEFAULT_MODELS = {
    'anthropic': 'claude-3-5-sonnet-20241022',
    'openai': 'gpt-4o',
    'openrouter': 'anthropic/claude-3.5-sonnet',
    'mistral': 'mistral-large-latest',
    'ollama': 'llama3.1',           # Llama 3.1+ supports tool calling
    'local': 'local-model',
}


def _resolve_model(provider: str, override: Optional[str] = None) -> str:
    """Pick the model name in precedence order:

    1. Explicit `override` argument (from the API caller)
    2. `<PROVIDER>_MODEL` env var       (e.g. ANTHROPIC_MODEL=claude-4)
    3. Universal `LLM_MODEL` env var
    4. Provider-specific default from `_DEFAULT_MODELS`
    """
    if override:
        return override
    provider_specific = os.getenv(f'{provider.upper()}_MODEL')
    if provider_specific:
        return provider_specific
    universal = os.getenv('LLM_MODEL')
    if universal:
        return universal
    return _DEFAULT_MODELS[provider]


def build_chat_model(
    temperature: float = 0.0,
    max_tokens: int = 2048,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> BaseChatModel:
    """Build a LangChain BaseChatModel matching our LLM_PROVIDER setting.

    Args:
        temperature: Sampling temperature. Default 0.0 for deterministic
            planning; nondeterminism belongs in the tools, not the planner.
        max_tokens: Max tokens per LLM response.
        provider_override: Force a specific provider ("anthropic", "openai"
            etc.). If None, reads `settings.LLM_PROVIDER`.
        model_override: Force a specific model name for this call.

    Returns:
        A ready-to-use LangChain chat model. Supports `.bind_tools([...])`
        for tool calling and works as a node in a LangGraph StateGraph.

    Raises:
        ValueError: The provider name isn't one of the six supported.
        ImportError: The corresponding `langchain-<provider>` package isn't
            installed. Install it with `pip install langchain-<provider>`.
    """
    provider = (provider_override or getattr(settings, 'LLM_PROVIDER', 'anthropic')).lower()
    model = _resolve_model(provider, model_override)
    logger.debug(
        "build_chat_model: provider=%s model=%s temp=%.2f max_tokens=%d",
        provider, model, temperature, max_tokens,
    )

    if provider == 'anthropic':
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=60,
            api_key=os.getenv('ANTHROPIC_API_KEY'),
        )

    if provider == 'openai':
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=60,
            api_key=os.getenv('OPENAI_API_KEY'),
        )

    if provider == 'openrouter':
        # OpenRouter speaks the OpenAI wire format at a different base URL.
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=60,
            base_url='https://openrouter.ai/api/v1',
            api_key=os.getenv('OPENROUTER_API_KEY'),
        )

    if provider == 'mistral':
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=60,
            api_key=os.getenv('MISTRAL_API_KEY'),
        )

    if provider == 'ollama':
        from langchain_ollama import ChatOllama
        # Ollama uses `num_predict` instead of `max_tokens` in its native API.
        # Env var precedence matches the pre-existing project convention:
        # OLLAMA_BASE_URL (existing) → OLLAMA_HOST (Ollama's own default name).
        return ChatOllama(
            model=model,
            temperature=temperature,
            num_predict=max_tokens,
            base_url=(
                os.getenv('OLLAMA_BASE_URL')
                or os.getenv('OLLAMA_HOST')
                or 'http://localhost:11434'
            ),
        )

    if provider in ('local', 'openai-compatible'):
        # Generic OpenAI-compatible endpoint (llama.cpp, vLLM, LM Studio, …).
        # Env var precedence: LOCAL_LLM_BASE_URL (existing project convention)
        # → LOCAL_API_BASE → OPENAI_API_BASE. First non-empty wins.
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=60,
            base_url=(
                os.getenv('LOCAL_LLM_BASE_URL')
                or os.getenv('LOCAL_API_BASE')
                or os.getenv('OPENAI_API_BASE')
                or 'http://localhost:8080/v1'
            ),
            api_key=os.getenv('LOCAL_API_KEY') or 'not-needed',
        )

    raise ValueError(
        f"Unknown LLM provider: {provider!r}. "
        "Set LLM_PROVIDER to one of: anthropic, openai, openrouter, mistral, ollama, local."
    )
