from django.contrib import admin
from django.db import transaction
from django.db.models import F
from decimal import Decimal
from django import forms
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import HttpResponseRedirect
from django.core.exceptions import PermissionDenied
from django.contrib import messages
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display, action
from .models import (
    UserProfile, UserSettings, Achievement, UserAchievement,
    Trade, Holding, Watchlist, PriceAlert, SiteSettings, APIKey, LimitOrder,
    Strategy, Backtest, Position, PositionAuditLog, BalanceTransaction, generate_username,
)
from .email_service import send_test_email
from .report_views import compute_weekly_report, compute_monthly_report, compute_yearly_report

CURRENCY_SYMBOLS = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹',
    'JPY': '¥', 'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF',
    'CNY': '¥', 'SGD': 'S$',
}

def _fmt(amount, currency='USD'):
    """Format amount with the correct currency symbol."""
    sym = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{sym}{amount:,.2f}"


@admin.register(SiteSettings)
class SiteSettingsAdmin(ModelAdmin):
    list_display = ['__str__', 'display_maintenance', 'display_email_status', 'display_smtp_host', 'display_buying_power']
    fieldsets = [
        ("Maintenance Mode", {
            "fields": ["maintenance_mode", "maintenance_message", "contact_email", "contact_github", "contact_twitter", "contact_discord"],
            "description": "Enable maintenance mode to take the site offline. All users will see a maintenance page. Contact links are displayed on the maintenance page.",
        }),
        ("Email Verification", {
            "fields": ["email_verification_enabled"],
            "description": "Toggle whether new users must verify their email address before logging in.",
        }),
        ("New User Defaults", {
            "fields": ["default_buying_power", "currency_buying_power"],
            "description": "Configure starting balance for newly registered users. Set per-currency amounts or a fallback default.",
        }),
        ("Exchange Rates", {
            "fields": ["exchange_rates"],
            "description": 'Fallback exchange rates vs USD used when live API is unavailable. Format: {"EUR": 0.84, "INR": 90.55, "GBP": 0.73, "JPY": 152.70, "CAD": 1.36, "AUD": 1.41, "CHF": 0.77, "CNY": 6.91, "SGD": 1.26}. Leave empty to use hardcoded defaults.',
        }),
        ("SMTP Configuration", {
            "fields": [
                "smtp_host", "smtp_port", "smtp_username", "smtp_password",
                "smtp_use_tls", "smtp_use_ssl", "smtp_from_email", "smtp_from_name",
            ],
            "description": "Configure your SMTP server for sending emails. Common providers: Gmail (smtp.gmail.com:587), SendGrid (smtp.sendgrid.net:587), Mailgun, Amazon SES.",
        }),
        ("Frontend", {
            "fields": ["frontend_url"],
            "description": "The base URL of the frontend app, used for building email verification links.",
        }),
    ]
    actions_detail = ['send_test_email_action']

    def has_add_permission(self, request):
        # Only allow one instance
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @display(description="Maintenance", label={"ON": "danger", "OFF": "success"})
    def display_maintenance(self, obj):
        return "ON" if obj.maintenance_mode else "OFF"

    @display(description="Email Verification", label={"Enabled": "success", "Disabled": "info"})
    def display_email_status(self, obj):
        return "Enabled" if obj.email_verification_enabled else "Disabled"

    @display(description="SMTP Host")
    def display_smtp_host(self, obj):
        return obj.smtp_host or "Not configured"

    @display(description="Default Balance")
    def display_buying_power(self, obj):
        return f"{obj.default_buying_power:,.0f}"

    @action(description="Send Test Email", url_path="send-test-email")
    def send_test_email_action(self, request, object_id):
        obj = self.get_object(request, object_id)
        if not obj.smtp_from_email:
            messages.error(request, "Cannot send test email: SMTP 'from email' is not configured.")
            return HttpResponseRedirect(request.META.get('HTTP_REFERER', '/admin/'))

        # Send test email to the SMTP from address itself
        to_email = obj.smtp_from_email
        success, error = send_test_email(to_email)

        if success:
            messages.success(request, f"Test email sent successfully to {to_email}!")
        else:
            messages.error(request, f"Failed to send test email: {error}")

        return HttpResponseRedirect(request.META.get('HTTP_REFERER', '/admin/'))




class BalanceAdjustmentForm(forms.Form):
    operation = forms.ChoiceField(label="Operação", choices=[("CREDIT", "Adicionar saldo"), ("DEBIT", "Remover saldo")])
    amount = forms.DecimalField(label="Valor", min_value=Decimal("0.01"), max_digits=20, decimal_places=2)
    reason = forms.CharField(label="Justificativa", max_length=150, widget=forms.Textarea(attrs={"rows": 3}))


class UserProfileAdminForm(forms.ModelForm):
    """Create a trading account without exposing its stored password hash."""
    password1 = forms.CharField(
        label="Senha", widget=forms.PasswordInput(render_value=False), required=False
    )
    password2 = forms.CharField(
        label="Confirmar senha", widget=forms.PasswordInput(render_value=False), required=False
    )

    class Meta:
        model = UserProfile
        exclude = ("password",)

    def clean(self):
        cleaned = super().clean()
        if self.instance._state.adding:
            password = cleaned.get("password1")
            if not password:
                self.add_error("password1", "Informe uma senha.")
            elif password != cleaned.get("password2"):
                self.add_error("password2", "As senhas não coincidem.")
            else:
                try:
                    validate_password(password, user=self.instance)
                except ValidationError as error:
                    self.add_error("password1", error)
        return cleaned


@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    form = UserProfileAdminForm
    list_display = ['name', 'email', 'display_buying_power', 'display_finance_link', 'display_admin', 'created_at']
    search_fields = ['name', 'email', 'username']
    list_filter = ['is_admin', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'password_changed_at', 'is_2fa_enabled']
    fieldsets = [
        ("Profile", {"fields": ["id", "name", "username", "email", "avatar_url"]}),
        ("Email Verification", {"fields": ["is_email_verified"]}),
        ("Account", {"fields": ["buying_power", "initial_balance", "plan"]}),
        ("Admin", {"fields": ["is_admin"]}),
        ("Security", {"fields": ["password_changed_at", "is_2fa_enabled"]}),
        ("Timestamps", {"fields": ["created_at", "updated_at"]}),
    ]

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            fields.extend(["buying_power", "initial_balance"])
        return fields

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return [
                ("Novo usuário", {"fields": ("name", "username", "email", "password1", "password2")}),
                ("Saldo simulado", {"fields": ("initial_balance", "buying_power")}),
                ("Conta", {"fields": ("plan", "is_email_verified")}),
            ]
        return super().get_fieldsets(request, obj)

    def save_model(self, request, obj, form, change):
        if not change:
            if not obj.username:
                obj.username = generate_username(obj.name)
            obj.is_admin = False
            obj.set_password(form.cleaned_data["password1"])
        super().save_model(request, obj, form, change)
        if not change:
            UserSettings.objects.get_or_create(user=obj)

    def get_urls(self):
        custom_urls = [
            path(
                '<path:object_id>/reports/',
                self.admin_site.admin_view(self.user_reports_view),
                name='users_userprofile_reports',
            ),
            path(
                '<path:object_id>/finance/',
                self.admin_site.admin_view(self.finance_view),
                name='users_userprofile_finance',
            ),
        ]
        return custom_urls + super().get_urls()

    @display(description="Financeiro")
    def display_finance_link(self, obj):
        url = reverse("admin:users_userprofile_finance", args=[obj.pk])
        return format_html('<a href="{}">Adicionar / remover saldo</a>', url)

    def finance_view(self, request, object_id):
        if not request.user.is_active or not request.user.is_superuser:
            raise PermissionDenied("Somente superusuários podem ajustar saldos.")
        target = get_object_or_404(UserProfile, pk=object_id)
        form = BalanceAdjustmentForm(request.POST or None)
        if request.method == "POST" and form.is_valid():
            with transaction.atomic():
                locked = UserProfile.objects.select_for_update().get(pk=target.pk)
                before = locked.buying_power
                amount = form.cleaned_data["amount"]
                operation = form.cleaned_data["operation"]
                delta = amount if operation == "CREDIT" else -amount
                after = before + delta
                if after < 0:
                    form.add_error("amount", "Saldo insuficiente para realizar o débito.")
                else:
                    # Atomic conditional update also guards SQLite (which lacks SELECT FOR UPDATE).
                    changed = UserProfile.objects.filter(pk=locked.pk, buying_power__gte=amount).update(
                        buying_power=F("buying_power") - amount
                    ) if operation == "DEBIT" else UserProfile.objects.filter(pk=locked.pk).update(
                        buying_power=F("buying_power") + amount
                    )
                    if not changed:
                        form.add_error("amount", "Saldo insuficiente ou alterado. Tente novamente.")
                    else:
                        locked.refresh_from_db(fields=["buying_power"])
                        BalanceTransaction.objects.create(
                            user=locked, amount=delta, balance_before=before,
                            balance_after=locked.buying_power,
                            category="ADMIN_CREDIT" if operation == "CREDIT" else "ADMIN_DEBIT",
                            description=f"{form.cleaned_data['reason']} | Admin: {request.user.get_username()}"[:255],
                        )
                        messages.success(request, "Movimentação de saldo registrada com sucesso.")
                        return HttpResponseRedirect(reverse("admin:users_userprofile_change", args=[target.pk]))
        context = {
            **self.admin_site.each_context(request),
            "title": f"Financeiro: {target.name}",
            "target_user": target,
            "form": form,
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/users/finance_adjustment.html", context)

    def user_reports_view(self, request, object_id):
        """Custom admin view that renders a user's trading reports."""
        target_user = get_object_or_404(UserProfile, pk=object_id)
        now = timezone.now()

        report_type = request.GET.get('type', 'weekly')
        year = int(request.GET.get('year', now.year))
        month = int(request.GET.get('month', now.month))

        report = None
        report_empty = False
        empty_message = ''

        if report_type == 'weekly':
            report = compute_weekly_report(target_user)
            if report is None:
                report_empty = True
                empty_message = 'No trades this week.'
        elif report_type == 'monthly':
            report = compute_monthly_report(target_user, year, month)
            if report is None:
                report_empty = True
                empty_message = f'No trades in {timezone.datetime(year, month, 1).strftime("%B %Y")}.'
        elif report_type == 'yearly':
            report = compute_yearly_report(target_user, year)
            if report is None:
                report_empty = True
                empty_message = f'No trades in {year}.'

        # Compute bar heights for chart rendering
        if report:
            bars = report.get('dailyBars') or report.get('weekBars') or []
            if bars:
                max_abs = max(abs(b['value']) for b in bars) or 1
                for b in bars:
                    b['height'] = max(int(abs(b['value']) / max_abs * 100), 5) if b['value'] != 0 else 5

        # Year/month choices for the filter form
        first_trade = Trade.objects.filter(user=target_user).order_by('executed_at').first()
        start_year = first_trade.executed_at.year if first_trade else now.year
        year_choices = list(range(now.year, start_year - 1, -1))
        month_choices = [
            (1, 'January'), (2, 'February'), (3, 'March'), (4, 'April'),
            (5, 'May'), (6, 'June'), (7, 'July'), (8, 'August'),
            (9, 'September'), (10, 'October'), (11, 'November'), (12, 'December'),
        ]

        tab_choices = [
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
            ('yearly', 'Yearly Wrapped'),
        ]

        # Resolve avatar URL for template
        avatar_url = None
        if target_user.avatar_url:
            if target_user.avatar_url.startswith('http'):
                avatar_url = target_user.avatar_url
            else:
                avatar_url = request.build_absolute_uri(f'/media/{target_user.avatar_url}')

        context = {
            **self.admin_site.each_context(request),
            'title': f'Reports: {target_user.name}',
            'target_user': target_user,
            'avatar_url': avatar_url,
            'report_type': report_type,
            'report': report,
            'report_empty': report_empty,
            'empty_message': empty_message,
            'year': year,
            'month': month,
            'year_choices': year_choices,
            'month_choices': month_choices,
            'tab_choices': tab_choices,
            'opts': self.model._meta,
        }
        return TemplateResponse(request, 'admin/users/user_reports.html', context)

    @display(description="Buying Power", ordering="buying_power")
    def display_buying_power(self, obj):
        try:
            cur = obj.settings.currency
        except UserSettings.DoesNotExist:
            cur = 'USD'
        return _fmt(obj.buying_power, cur)

    @display(description="Plan", label={"FREE": "info", "PRO": "success", "PREMIUM": "warning"})
    def display_plan(self, obj):
        return obj.plan

    @display(description="Verified", boolean=True)
    def display_verified(self, obj):
        return obj.is_email_verified

    @display(description="Admin", boolean=True)
    def display_admin(self, obj):
        return obj.is_admin

    @display(description="Reports")
    def display_reports_link(self, obj):
        url = reverse('admin:users_userprofile_reports', args=[obj.pk])
        return format_html('<a href="{}" style="white-space:nowrap">View Reports</a>', url)













# Operational records are visible but not editable here: changing a leveraged
# position must go through the audited position-management API.
@admin.register(Position)
class PositionAdmin(ModelAdmin):
    list_display = ("user", "symbol", "side", "status", "quantity", "entry_price", "leverage", "margin", "realized_pnl", "opened_at")
    list_filter = ("status", "side", "opened_at")
    search_fields = ("symbol", "user__name", "user__email")
    readonly_fields = tuple(field.name for field in Position._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(BalanceTransaction)
class BalanceTransactionAdmin(ModelAdmin):
    list_display = ("user", "category", "amount", "balance_before", "balance_after", "created_at")
    list_filter = ("category", "created_at")
    search_fields = ("user__name", "user__email", "description")
    readonly_fields = tuple(field.name for field in BalanceTransaction._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PositionAuditLog)
class PositionAuditLogAdmin(ModelAdmin):
    list_display = ("position", "actor", "action", "created_at")
    list_filter = ("action", "created_at")
    readonly_fields = tuple(field.name for field in PositionAuditLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
