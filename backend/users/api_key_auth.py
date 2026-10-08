"""
API-key authentication for programmatic (agent) access.

The platform's normal browser flow uses HttpOnly-cookie JWT
authentication (see `authentication.CookieJWTAuthentication`). External
AI agents can't use cookies, so this class implements a second, parallel
auth path: an opaque API key sent in the Authorization header.

Wire format
-----------
Request header:
    Authorization: Bearer opt_<40-hex-chars>

We hash the raw key with SHA-256 and look it up against `APIKey.key_hash`.
On a hit we return the associated `UserProfile` as the request user, and
update `last_used_at` for observability.

Which endpoints use this
------------------------
Only the agent + benchmark endpoints (see `agent_views.py`). The rest of
the API stays cookie-JWT-only so existing frontend behaviour is unchanged.

Rate limiting is handled at the view layer via DRF's built-in throttles,
scoped by API key id — not shared across keys.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Optional, Tuple

from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import APIKey, UserProfile

logger = logging.getLogger(__name__)


class APIKeyAuthentication(authentication.BaseAuthentication):
    """DRF authentication backend for `Authorization: Bearer opt_<key>`.

    Behaviour:
        - Missing / non-Bearer header → returns None (unauthenticated,
          let another auth class try). Does NOT raise, so the class is
          composable behind CookieJWTAuthentication.
        - Malformed key prefix (not `opt_`) → 401 with clear message.
        - Unknown or revoked key → 401.
        - Valid key → returns (UserProfile, APIKey). `request.auth` gives
          view code the APIKey object for per-key rate limiting or
          revocation.
    """

    keyword = 'Bearer'
    prefix = 'opt_'

    def authenticate(self, request) -> Optional[Tuple[UserProfile, APIKey]]:
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.lower().encode():
            return None
        if len(header) != 2:
            return None                     # malformed → let other backends try
        raw_key = header[1].decode('latin-1', errors='replace')
        if not raw_key.startswith(self.prefix):
            return None                     # not our key format

        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

        try:
            api_key = (
                APIKey.objects
                .select_related('user')
                .get(key_hash=key_hash, is_active=True)
            )
        except APIKey.DoesNotExist:
            logger.info("api_key_auth: unknown or revoked key (prefix=%s…)", raw_key[:8])
            raise exceptions.AuthenticationFailed(
                'Invalid or revoked API key. Regenerate at /api/users/api-keys/.'
            )

        # Best-effort observability. Use update() to avoid triggering signals.
        APIKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())

        logger.debug(
            "api_key_auth: authenticated user_id=%s key_id=%s",
            api_key.user_id, api_key.id,
        )
        return (api_key.user, api_key)

    def authenticate_header(self, request) -> str:
        """Header returned in 401 responses so clients know how to authenticate."""
        return f'{self.keyword} realm="Open-Papertrade agents"'
