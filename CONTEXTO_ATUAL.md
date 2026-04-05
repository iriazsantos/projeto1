# Contexto Atual do Projeto

## Objetivo principal
- Entregar o portal INOVATECH CONNECT com operacao completa de condominio (usuarios, comunicacao, financeiro/licenca, suporte e integracoes de API) com backend Node + Prisma e front React/Vite.

## Regras de negocio criticas
- Login deve respeitar bloqueio de condominio por inadimplencia de licenca.
- Somente admin/admin-master acessa gestao global, status de APIs internas e saude do agente.
- Chat e suporte devem respeitar permissao por perfil e escopo de condominio.
- Cobrancas de licenca precisam manter rastreabilidade (status local + sincronizacao gateway).

## Funcionalidades concluidas
- Backend principal com rotas de auth, users, condos, admin, gateway, chat, suporte, uploads e agent API.
- Central de Suporte integrada no App (secao unica para usuarios e admin master).
- Chat em tempo real com conversas, mensagens, leitura e presenca.
- Assembleia Virtual implementada (Prisma + API + UI) com criacao de pautas, votacao por item e apuracao automatica por quorum.
- Automacao de cobranca recorrente no gateway master (schema + migracoes + rotas).
- Build de producao (`npm run build`) validado com sucesso.
- Smoke test de retomada validado: login admin, listagem suporte/chat, criacao de ticket, resposta e mensagem no chat.
- Badge de chat no menu lateral agora usa contagem real de nao lidas via `/api/chat/conversations`.

## Funcionalidades pendentes
- Cobertura de testes automatizados E2E para fluxos de suporte/chat/gateway.
- Cobertura de testes automatizados E2E para fluxos de assembleia virtual.
- Limpeza do working tree (ha muitos arquivos de log/diagnostico e alteracoes antigas no stage).
- Definir e fixar credenciais/seed padrao para ambiente local (hoje ha dados mistos de seed antiga e nova).
- Revisao final de UX dos novos modulos (chat/suporte) em mobile.

## Decisoes tecnicas importantes
- Front continua com autenticacao hibrida: tenta backend primeiro e tem fallback local.
- Token JWT salvo em `auth_token` e `authToken` para compatibilidade com telas legadas.
- Base de dados local em SQLite (`prisma/dev.db`) com migracoes versionadas em `prisma/migrations`.
- Rotas novas de suporte/chat usam Prisma diretamente, sem depender do estado legado em `state.json`.

## Como validar rapido
1. Subir ambiente: `npm run dev` e verificar `http://localhost:3000/health` + `http://localhost:5173`.
2. Login com admin local atual: `admin@inovatech.com / Stilo@273388`.
3. Validar no menu: `Mensagens` (badge de nao lidas) e `Central de Suporte` (abrir ticket, responder e alterar status).

## Observacoes para proxima sessao
- Antes de encerrar, rodar `npm run checkpoint -- "resumo da sessao"` para atualizar snapshot.
- Se houver `EADDRINUSE` na porta 3000, finalizar processo antigo do Node antes de reiniciar `npm run dev`.
- Evitar novos commits sem separar logs/arquivos temporarios dos arquivos de codigo.
