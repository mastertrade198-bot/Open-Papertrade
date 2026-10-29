import uuid
from django.db import models
from django.utils import timezone

class WithdrawalRequest(models.Model):
    METHOD_CHOICES = [('PIX', 'PIX'), ('USDT', 'USDT')]
    STATUS_CHOICES = [('PENDING', 'Pendente'), ('APPROVED', 'Aprovado'), ('REJECTED', 'Rejeitado')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    method = models.CharField(max_length=4, choices=METHOD_CHOICES)
    destination = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'withdrawal_requests'
        ordering = ['-created_at']
