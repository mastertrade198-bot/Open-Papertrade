from decimal import Decimal
from django import forms
from django.contrib import admin
from django.db import transaction
from django.utils import timezone
from unfold.admin import ModelAdmin
from .models import Project, Participation, ParticipationPoint, ParticipationAudit


@admin.register(Project)
class ProjectAdmin(ModelAdmin):
    list_display = ('name', 'category', 'asset', 'duration_days', 'expected_return_percent', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name', 'asset')


class ParticipationAdminForm(forms.ModelForm):
    adjustment_reason = forms.CharField(label='Justificativa da alteração', required=False, widget=forms.Textarea(attrs={'rows': 2}))

    class Meta:
        model = Participation
        fields = '__all__'

    def clean(self):
        cleaned = super().clean()
        if self.instance.pk and 'current_percent' in self.changed_data and not cleaned.get('adjustment_reason', '').strip():
            self.add_error('adjustment_reason', 'Informe a justificativa para alterar o resultado.')
        if self.instance.pk and any(field in self.changed_data for field in ('principal', 'user', 'project', 'started_at', 'status')):
            raise forms.ValidationError('Capital, usuário, projeto, início e status não podem ser editados pelo admin.')
        return cleaned


@admin.register(Participation)
class ParticipationAdmin(ModelAdmin):
    form = ParticipationAdminForm
    list_display = ('user', 'project', 'principal', 'current_percent', 'status', 'updated_at')
    list_filter = ('project', 'status')
    search_fields = ('user__email', 'project__name')
    readonly_fields = ('id', 'principal', 'user', 'project', 'started_at', 'updated_at', 'status')
    fields = ('id', 'user', 'project', 'principal', 'started_at', 'status', 'current_percent', 'adjustment_reason', 'updated_at')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            raise ValueError('Participações devem ser criadas pela API.')
        with transaction.atomic():
            previous = Participation.objects.select_for_update().get(pk=obj.pk)
            old = previous.current_percent
            super().save_model(request, obj, form, change)
            if old != obj.current_percent:
                ParticipationPoint.objects.create(participation=obj, percent=obj.current_percent)
                ParticipationAudit.objects.create(
                    participation=obj, actor=request.user,
                    previous_percent=old, new_percent=obj.current_percent,
                    reason=form.cleaned_data['adjustment_reason'].strip(),
                )


@admin.register(ParticipationPoint)
class ParticipationPointAdmin(ModelAdmin):
    list_display = ('participation', 'percent', 'recorded_at')
    readonly_fields = ('participation', 'percent', 'recorded_at')
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False


@admin.register(ParticipationAudit)
class ParticipationAuditAdmin(ModelAdmin):
    list_display = ('participation', 'actor', 'previous_percent', 'new_percent', 'created_at')
    readonly_fields = ('participation', 'actor', 'previous_percent', 'new_percent', 'reason', 'created_at')
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False
