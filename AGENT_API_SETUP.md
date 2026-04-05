# Integracao de API de Agente (IA)

Este projeto agora possui um conector de IA no backend, para usar qualquer provedor compativel com o formato Anthropic Messages.

## 1) Configure o `.env`

Crie um arquivo `.env` na raiz do projeto com:

```env
AGENT_ENABLED=true
AGENT_PROVIDER=anthropic-messages
AGENT_API_KEY=sua_chave_aqui
AGENT_BASE_URL=https://api.anthropic.com
AGENT_MODEL=claude-opus-4-6
AGENT_MAX_TOKENS=1024
AGENT_TIMEOUT_MS=45000
AGENT_HEALTH_TIMEOUT_MS=9000
AGENT_HEALTH_CACHE_TTL_MS=60000
```

Se quiser usar um roteador/proxy de terceiros, altere apenas `AGENT_BASE_URL`, `AGENT_API_KEY` e `AGENT_MODEL`.

## 2) Endpoints disponiveis

- `POST /api/agent/chat`
  - Requer token de usuario logado (`Authorization: Bearer ...`).
  - Corpo:

```json
{
  "messages": [
    { "role": "user", "content": "Ola, preciso de ajuda no meu ticket." }
  ],
  "system": "Responda em portugues com foco em suporte condominial.",
  "maxTokens": 700,
  "temperature": 0.3
}
```

- `GET /api/agent/health?probe=1`
  - Apenas admin.
  - Retorna status real de conectividade do endpoint configurado.

## 3) Monitoramento no painel admin

A conexao do agente agora aparece em `GET /api/admin/status` dentro da categoria `APIs internas` como `Agent API (IA)`.

## 4) Boas praticas de seguranca

- Nunca colocar chave da API no front-end.
- Nunca commitar `.env` com chaves reais.
- Se usar um gateway gratuito de terceiros, trate como ambiente de risco:
  - evite dados sensiveis;
  - valide disponibilidade e politicas de privacidade;
  - prefira credenciais proprias em producao.
