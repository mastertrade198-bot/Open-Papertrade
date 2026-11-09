"""
URL configuration for paper-trading backend.
"""

from django.contrib import admin
from django.contrib.admin.models import LogEntry
from django.db.models import Sum, Count, Q
from django.template.response import TemplateResponse
from types import MethodType
from users.models import UserProfile, Position, BalanceTransaction, PolygonUSDTDeposit
from withdrawals.models import WithdrawalRequest, AdminDeposit
from robots.models import TradingRobot
from django.utils import timezone
from datetime import timedelta
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static


def api_root(request):
    """API root endpoint with available endpoints."""
    return JsonResponse({
        "name": "Paper Trading API",
        "version": "1.0.0",
        "endpoints": {
            "stocks": "/api/stocks/",
            "users": "/api/users/",
            "filings": "/api/filings/",
            "admin": "/admin/",
        },
        "stock_endpoints": {
            "quote": "/api/stocks/quote/{symbol}/",
            "bulk_quotes": "/api/stocks/quotes/",
            "search": "/api/stocks/search/?q={query}",
            "profile": "/api/stocks/profile/{symbol}/",
            "popular": "/api/stocks/popular/",
            "crypto": "/api/stocks/crypto/",
            "status": "/api/stocks/status/",
        },
        "user_endpoints": {
            "profile": "/api/users/profile/",
            "settings": "/api/users/settings/",
            "stats": "/api/users/stats/",
            "achievements": "/api/users/achievements/",
            "holdings": "/api/users/holdings/",
            "trades": "/api/users/trades/",
            "execute_trade": "/api/users/trades/execute/",
            "watchlist": "/api/users/watchlist/",
            "alerts": "/api/users/alerts/",
            "reset": "/api/users/reset/",
        }
    })


from users.auth_views import SignupView, LoginView, RefreshTokenView, VerifyEmailView, ResendVerificationView, LogoutView, MeView, TwoFactorLoginVerifyView
from users.security_views import ForgotPasswordView, ResetPasswordView
from users.models import SiteSettings


def maintenance_status(request):
    """Public endpoint to check maintenance mode status."""
    site = SiteSettings.load()
    links = {}
    if site.contact_email:
        links['email'] = site.contact_email
    if site.contact_github:
        links['github'] = site.contact_github
    if site.contact_twitter:
        links['twitter'] = site.contact_twitter
    if site.contact_discord:
        links['discord'] = site.contact_discord
    return JsonResponse({
        'enabled': site.maintenance_mode,
        'message': site.maintenance_message,
        'links': links,
    })



def master_trade_admin_index(self, request, extra_context=None):
    if not self.has_permission(request):
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied
    today = timezone.localdate()
    month_start = today.replace(day=1)
    week_start = timezone.now() - timedelta(days=7)
    position_stats = Position.objects.aggregate(
        total=Count("pk"),
        opened=Count("pk", filter=Q(status="OPEN")),
        closed=Count("pk", filter=Q(status="CLOSED")),
    )
    robot_stats = TradingRobot.objects.aggregate(
        total=Count("pk"),
        running=Count("pk", filter=Q(status="ACTIVE", scheduled_end_at__isnull=False,
                                    scheduled_pnl_percent__isnull=False)),
        awaiting=Count("pk", filter=Q(status="ACTIVE") &
                       (Q(scheduled_end_at__isnull=True) | Q(scheduled_pnl_percent__isnull=True))),
    )
    withdrawal_stats = WithdrawalRequest.objects.aggregate(
        pending=Count("pk", filter=Q(status="PENDING")),
        approved_amount=Sum("amount", filter=Q(status="APPROVED")),
        pending_amount=Sum("amount", filter=Q(status="PENDING")),
    )
    confirmed_deposits = PolygonUSDTDeposit.objects.filter(status="confirmed")
    deposit_stats = confirmed_deposits.aggregate(
        total=Sum("amount"), count=Count("pk"),
    )
    simulated_credits = AdminDeposit.objects.aggregate(total=Sum("amount"), count=Count("pk"))
    context = {
        **self.each_context(request),
        "title": "Visão geral · Master Trade",
        "total_clients": UserProfile.objects.count(),
        "new_clients_month": UserProfile.objects.filter(created_at__date__gte=month_start).count(),
        "new_clients_week": UserProfile.objects.filter(created_at__gte=week_start).count(),
        "total_positions": position_stats["total"],
        "open_positions": position_stats["opened"],
        "closed_positions": position_stats["closed"],
        "total_balance": UserProfile.objects.aggregate(value=Sum("buying_power"))["value"] or 0,
        "total_financial_entries": BalanceTransaction.objects.count(),
        "confirmed_deposits_amount": deposit_stats["total"] or 0,
        "confirmed_deposits_count": deposit_stats["count"],
        "simulated_deposits_amount": simulated_credits["total"] or 0,
        "simulated_deposits_count": simulated_credits["count"],
        "withdrawals_pending": withdrawal_stats["pending"],
        "withdrawals_pending_amount": withdrawal_stats["pending_amount"] or 0,
        "withdrawals_approved_amount": withdrawal_stats["approved_amount"] or 0,
        "robots_total": robot_stats["total"],
        "robots_running": robot_stats["running"],
        "robots_awaiting": robot_stats["awaiting"],
        "recent_actions": LogEntry.objects.select_related("user", "content_type").order_by("-action_time")[:5],
        **(extra_context or {}),
    }
    return TemplateResponse(request, "admin/index.html", context)


admin.site.index = MethodType(master_trade_admin_index, admin.site)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/maintenance-status/', maintenance_status, name='maintenance-status'),
    path('api/', api_root, name='api-root'),
    path('api/stocks/', include('stocks.urls', namespace='stocks')),
    path('api/users/', include('users.urls', namespace='users')),
    path('api/robots/', include('robots.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/filings/', include('filings.urls', namespace='filings')),
    path('api/auth/signup/', SignupView.as_view(), name='auth-signup'),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/refresh/', RefreshTokenView.as_view(), name='auth-refresh'),
    path('api/auth/verify-email/', VerifyEmailView.as_view(), name='auth-verify-email'),
    path('api/auth/resend-verification/', ResendVerificationView.as_view(), name='auth-resend-verification'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),
    path('api/auth/2fa/verify/', TwoFactorLoginVerifyView.as_view(), name='auth-2fa-verify'),
    path('api/auth/forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('api/auth/reset-password/', ResetPasswordView.as_view(), name='auth-reset-password'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
