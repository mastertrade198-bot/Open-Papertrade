# AGENTS.md — Master Trade

## Missão e escopo
Este projeto é uma plataforma de **trading simulado** baseada no Open-Papertrade. Atue como agente de desenvolvimento full-stack: inspecione o código existente, planeje mudanças pequenas, implemente, teste quando possível e documente resultados. Não apresente operações simuladas como transações financeiras reais.

## Ambiente
- Repositório: `mastertrade198-bot/Open-Papertrade`
- Codespaces: `/workspaces/Open-Papertrade`
- Frontend: `frontend-ui/` — Next.js, React, TypeScript, porta 3000
- Backend: `backend/` — Django, Python, porta 8000
- Confirme os comandos e a estrutura reais antes de executar tarefas.

## Autonomia de desenvolvimento
Dentro das permissões efetivamente disponibilizadas pelas ferramentas e pelo usuário, você pode:
- Ler, criar e editar componentes, páginas, estilos, testes e documentação.
- Implementar APIs, modelos, migrations, serializers, autenticação, gráficos, ordens simuladas e painéis administrativos.
- Criar branches de trabalho, commits e pull requests.
- Investigar falhas, refatorar e instalar dependências de desenvolvimento necessárias, avaliando riscos.
- Executar lint, testes, builds e comandos de diagnóstico disponíveis.
- Consultar documentação e sites de referência para criar implementações próprias.

Estas instruções **não concedem** permissões adicionais no GitHub, Codespaces, sistemas externos ou servidores. Respeite os controles de acesso e aprovações exigidas.

## Proteção do trabalho existente
1. Antes de alterar o projeto, verifique branch atual, `git status`, mudanças locais e histórico recente.
2. Preserve todas as alterações locais e remotas; nunca descarte trabalho preexistente.
3. Trabalhe em branch própria baseada na branch de desenvolvimento apropriada.
4. **Não faça push direto na `main`, merge na `main` nem deploy de produção sem autorização explícita.**
5. Não execute `git reset --hard`, `git clean -fd`, force-push, exclusões em massa ou reescrita de histórico sem aprovação específica.
6. Não altere dados de produção, saldos ou transações de usuários sem aprovação e análise de impacto.
7. Não exponha segredos, tokens, senhas, dados pessoais nem arquivos `.env`; não os inclua em commits.
8. Antes de modificar autenticação, permissões, pagamentos ou operações, avalie riscos e preserve trilhas de auditoria.

## Funcionalidades e padrões do Master Trade
- Preservar operações simuladas abertas, margem, alavancagem, preço de entrada, P&L e controles administrativos com auditoria.
- Manter frontend responsivo, compacto e profissional, com nomes completos e símbolos dos ativos.
- Usar cotações provenientes dos provedores configurados. Nunca inventar preços, marcar dados antigos como tempo real nem mascarar indisponibilidade de mercado.
- Para saques simulados, impedir duplicidade e manter consistência de saldo e histórico.
- Não remover funcionalidades ou alterar contratos de API sem verificar dependências.
- Respeitar as escolhas existentes de design e os tokens CSS em `frontend-ui/src/app/globals.css`.

## Referências externas e propriedade intelectual
É permitido estudar fluxos, organização visual, padrões de navegação e funcionalidades de sites públicos ou de páginas que o usuário esteja autorizado a acessar. Crie código, textos, ícones e identidade próprios. Não copie código proprietário, material protegido, marcas, credenciais ou dados de terceiros sem autorização e direitos aplicáveis. Não contorne logins, paywalls, proteções técnicas ou restrições de acesso.

## Fluxo recomendado
1. Compreender a solicitação e inspecionar os arquivos relacionados.
2. Identificar dependências e riscos; evitar mudanças desnecessárias.
3. Criar branch de desenvolvimento e implementar alterações incrementais.
4. Rodar verificações disponíveis (TypeScript/lint/build no frontend; testes e checks do Django no backend).
5. Conferir diffs, evitar segredos e registrar commit descritivo.
6. Informar branch, commit, arquivos alterados, testes executados, limitações e instruções de uso.
7. Se não puder testar ou acessar o ambiente, declarar isso explicitamente; nunca afirmar sucesso não verificado.

## Limites de autorização
A autorização para desenvolver não implica autorização para publicar, efetuar pagamentos, acessar contas externas, contornar controles de segurança ou representar conformidade regulatória inexistente. Solicite aprovação quando a ação envolver produção, mudanças irreversíveis, custos, dados sensíveis ou efeitos externos significativos.
