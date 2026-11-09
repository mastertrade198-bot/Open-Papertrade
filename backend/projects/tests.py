from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from .models import Project, Participation, ParticipationAudit
from .views import serialize_participation
from users.models import UserProfile


class ProjectSimulationTests(TestCase):
    def setUp(self):
        self.user = UserProfile.objects.create(name='Pessoa de teste', email='projects-test@example.com', buying_power=Decimal('1000.00'))
        self.project = Project.objects.create(name='Projeto de teste', asset='Teste', duration_days=100, expected_return_percent=Decimal('10.00'))
        self.participation = Participation.objects.create(
            user=self.user, project=self.project, principal=Decimal('100.00'),
            started_at=timezone.now() - timedelta(days=50),
        )

    def test_linear_progression_is_individual(self):
        result = serialize_participation(self.participation)
        self.assertAlmostEqual(result['percent'], 5, places=1)
        self.assertAlmostEqual(result['simulatedValue'], 105, places=1)

    def test_individual_admin_adjustment_does_not_change_other_user(self):
        second = UserProfile.objects.create(name='Outra pessoa', email='projects-test2@example.com', buying_power=Decimal('1000.00'))
        other = Participation.objects.create(user=second, project=self.project, principal=Decimal('100.00'), started_at=self.participation.started_at)
        self.participation.current_percent = Decimal('3.00')
        self.participation.save(update_fields=['current_percent'])
        ParticipationAudit.objects.create(participation=self.participation, previous_percent=Decimal('0'), new_percent=Decimal('3'), reason='Teste de auditoria')
        self.assertAlmostEqual(serialize_participation(self.participation)['percent'], 8, places=1)
        self.assertAlmostEqual(serialize_participation(other)['percent'], 5, places=1)
