"""Validated administrative edits for simulated positions."""
from decimal import Decimal, ROUND_HALF_UP
from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import transaction
from unfold.admin import ModelAdmin, TabularInline
from .models import Position, PositionAuditLog, UserProfile

EDIT_FIELDS = ('entry_price', 'leverage', 'quantity', 'margin')
CENT = Decimal('0.01')

def snapshot(position):
    return {key: str(getattr(position, key)) for key in (*EDIT_FIELDS, 'notional_value')}

class PositionEditForm(forms.ModelForm):
    reason = forms.CharField(label='Motivo da alteração', widget=forms.Textarea(attrs={'rows': 2}), max_length=1000)
    version = forms.CharField(widget=forms.HiddenInput)

    class Meta:
        model = Position
        fields = EDIT_FIELDS
        help_texts = {
            'entry_price': 'Preço de entrada simulado em USD.',
            'leverage': 'Entre 1 e 100 vezes.',
            'margin': 'Reserva em USD. Ao alterar preço, quantidade ou alavancagem, a margem é recalculada se este campo permanecer igual. Uma margem manual deve cobrir o mínimo calculado.',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.updated_at:
            self.fields['version'].initial = self.instance.updated_at.isoformat()

    def clean(self):
        data = super().clean()
        if not all(key in data for key in EDIT_FIELDS):
            return data
        # The admin wraps POST change forms in an atomic transaction.
        current = Position.objects.select_for_update().get(pk=self.instance.pk)
        if current.status != Position.Status.OPEN:
            raise ValidationError('Somente posições abertas podem ser alteradas.')
        if data.get('version') != current.updated_at.isoformat():
            raise ValidationError('Esta posição foi alterada por outra sessão. Recarregue a página antes de editar.')
        for key in EDIT_FIELDS:
            if not data[key].is_finite() or data[key] <= 0:
                self.add_error(key, 'Informe um valor finito maior que zero.')
        if not Decimal('1') <= data['leverage'] <= Decimal('100'):
            self.add_error('leverage', 'A alavancagem deve estar entre 1 e 100.')
        if self.errors:
            return data
        notional = (data['quantity'] * data['entry_price']).quantize(CENT, rounding=ROUND_HALF_UP)
        minimum = (notional / data['leverage']).quantize(CENT, rounding=ROUND_HALF_UP)
        if minimum <= 0 or notional >= Decimal('1000000000000000000'):
            raise ValidationError('O valor da operação está fora dos limites permitidos.')
        if data['margin'] == current.margin and any(data[key] != getattr(current, key) for key in EDIT_FIELDS[:3]):
            data['margin'] = minimum
        if data['margin'] < minimum:
            self.add_error('margin', 'A margem deve cobrir pelo menos USD ' + str(minimum))
            return data
        owner = UserProfile.objects.select_for_update().get(pk=current.user_id)
        balance = owner.buying_power + current.margin - data['margin']
        if balance < 0 or balance >= Decimal('1000000000000000000'):
            raise ValidationError('Saldo disponível insuficiente ou fora dos limites para esta margem.')
        self.original = current
        self.owner = owner
        self.new_balance = balance
        self.notional = notional
        return data

class PositionAuditInline(TabularInline):
    model = PositionAuditLog
    fields = ('created_at', 'actor', 'action', 'old_values', 'new_values')
    readonly_fields = fields
    extra = 0
    can_delete = False
    def has_add_permission(self, request, obj=None):
        return False
    def has_change_permission(self, request, obj=None):
        return False

@admin.register(Position)
class PositionAdmin(ModelAdmin):
    form = PositionEditForm
    list_display = ('id', 'user', 'symbol', 'side', 'status', 'entry_price', 'leverage', 'quantity', 'margin', 'opened_at')
    list_filter = ('status', 'side', 'currency')
    search_fields = ('symbol', 'user__username', 'user__email', '=id')
    list_select_related = ('user',)
    readonly_fields = ('id', 'user', 'symbol', 'name', 'side', 'status', 'currency', 'notional_value', 'exit_price', 'realized_pnl', 'opened_at', 'closed_at', 'updated_at')
    fields = ('id', 'user', 'symbol', 'name', 'side', 'status', 'currency', *EDIT_FIELDS, 'notional_value', 'reason', 'version', 'exit_price', 'realized_pnl', 'opened_at', 'closed_at', 'updated_at')
    inlines = (PositionAuditInline,)
    actions = None
    save_as = False

    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
    def has_change_permission(self, request, obj=None):
        return super().has_change_permission(request, obj) and (obj is None or obj.status == Position.Status.OPEN)

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        old = form.original
        obj.notional_value = form.notional
        before = snapshot(old)
        after = snapshot(obj)
        if before == after:
            return
        owner = form.owner
        previous_buying_power = owner.buying_power
        owner.buying_power = form.new_balance
        owner.save(update_fields=['buying_power', 'updated_at'])
        obj.save()
        # Django auth users and trading UserProfile accounts are distinct identities.
        # Do not infer an audit actor from a matching email address.
        PositionAuditLog.objects.create(
            position=obj, actor=None, action='ADMIN_EDIT', old_values={**before, 'buying_power': str(previous_buying_power)},
            new_values={**after, 'buying_power': str(owner.buying_power), '_reason': form.cleaned_data['reason'], '_actor': {'id': str(request.user.pk), 'username': request.user.get_username()}},
        )

@admin.register(PositionAuditLog)
class PositionAuditLogAdmin(ModelAdmin):
    list_display = ('id', 'position', 'actor', 'action', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('position__symbol', 'position__user__username', 'actor__email')
    readonly_fields = tuple(field.name for field in PositionAuditLog._meta.fields)
    actions = None
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
