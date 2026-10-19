# Administração de operações simuladas

As alterações anteriores do Codespaces foram preservadas integralmente na branch safeguard/codespaces-20261019 (commit 10ccbbd), incluindo arquivos de backup e o checkpoint d4ef522. A implementação continua em feat/position-admin-audit-20261019. Nenhum merge na main foi realizado.

## Acesso

Use /admin/ com um usuário de autenticação Django autorizado. O UserProfile da plataforma é um modelo separado: is_admin no perfil não concede automaticamente acesso ao Django Admin. Para delegar a equipe, conceda view_position, change_position e view_positionauditlog no Django; superusuários já possuem essas permissões.

Em Trading > Operações simuladas, filtre por status, direção ou moeda e busque por ativo, usuário, e-mail ou ID. Abra uma posição OPEN para editar preço de entrada, alavancagem (1–100), quantidade e margem. Informe o motivo da alteração.

O valor nocional é recalculado com preço × quantidade. Quando preço, quantidade ou alavancagem mudam e a margem permanece igual ao valor anterior, a margem é recalculada por nocional / alavancagem. Uma margem manual maior é permitida; margem inferior ao mínimo é rejeitada. Valores monetários usam Decimal e arredondamento para centavos. A variação da margem é debitada ou devolvida ao saldo fictício disponível do titular. Saldo negativo é rejeitado.

A operação, o saldo e a auditoria são gravados na mesma transação. Há bloqueio das linhas envolvidas e verificação de versão para rejeitar uma tela desatualizada. SQLite é adequado para desenvolvimento; bloqueios select_for_update têm efeito completo em PostgreSQL.

## Auditoria

O histórico aparece na própria posição e em Position audit logs. Registra valores anteriores e novos, saldo, data, motivo e identificador/nome do operador Django em new_values._actor. actor referencia um perfil da plataforma com o mesmo e-mail, quando existir. Os dados decimais são armazenados como strings para preservar precisão.

Não é possível criar ou excluir posições pelo painel; posições encerradas são somente leitura. Logs não podem ser criados, alterados ou excluídos pelo Django Admin. Estes controles são do painel; acesso direto ao banco continua sob responsabilidade do administrador da infraestrutura. Não há chamadas a corretoras nem movimentação de dinheiro real.

## Validação

No backend com o ambiente virtual existente:

- .venv/bin/python manage.py check
- .venv/bin/python manage.py test users.test_position_admin --noinput
- .venv/bin/python manage.py makemigrations --check --dry-run

Os testes usam um banco separado e cobrem POST real do admin, recálculo, reserva/devolução de margem, valores inválidos, permissão, posição fechada, versão desatualizada, rollback e restrições da auditoria. Não foi necessário criar nova migração para este painel: ele utiliza Position e PositionAuditLog da migração 0026 já existente.
