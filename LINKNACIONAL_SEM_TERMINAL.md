# Deploy na Link Nacional Sem Terminal (Front + Back + Banco)

Este guia e para quando a hospedagem nao oferece acesso a terminal/SSH.
O fluxo usa apenas:

- `Setup Node.js App` no cPanel.
- `File Manager` (upload de ZIP).
- Botao `Run NPM Install` (quando disponivel).

## 1) Gerar pacote ZIP localmente

No seu computador (na pasta do projeto), use um dos comandos:

```bash
npm run deploy:pack:ln:min
```

- Recomendado.
- Gera build de producao.
- Nao inclui `node_modules` (menor e mais seguro para Linux).

```bash
npm run deploy:pack:ln:full
```

- Inclui `node_modules`.
- Use apenas se sua interface nao tiver botao `Run NPM Install`.

```bash
npm run deploy:pack:ln:update
```

- Pacote de atualizacao.
- Nao inclui banco (`prisma/dev.db`) nem uploads, para preservar dados ja existentes na hospedagem.
- Nao inclui `node_modules` (recomendado para Linux).

```bash
npm run deploy:pack:ln:update:full
```

- Atualizacao com `node_modules` incluso.
- Use so se seu cPanel nao tiver botao `Run NPM Install`.

O ZIP sera salvo em:

`deploy-packages/linknacional/`

## 2) Criar app Node no cPanel

No cPanel da Link Nacional:

1. Abra `Setup Node.js App`.
2. Clique em `CREATE APPLICATION`.
3. Configure:
- `Node.js version`: 20+ (preferencialmente 22, se disponivel).
- `Application mode`: `Production`.
- `Application root`: pasta onde o sistema ficara.
- `Application startup file`: `app.js`.
4. Clique em `CREATE`.

## 3) Upload e extracao do ZIP

1. Abra `File Manager`.
2. Entre na pasta definida em `Application root`.
3. Envie o ZIP gerado localmente.
4. Extraia o ZIP nessa mesma pasta.

## 4) Variaveis de ambiente

No `Setup Node.js App` > `Environment Variables`, configure:

- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET=SEU_SEGREDO_FORTE`
- `CORS_ORIGINS=https://seudominio.com,https://www.seudominio.com`
- `DATABASE_URL=file:./prisma/dev.db`

Use `env.linknacional.example` como base.

## 5) Instalar dependencias sem terminal

Se o cPanel mostrar o botao `Run NPM Install`:

1. Clique em `Run NPM Install`.
2. Aguarde finalizar.

Se esse botao nao existir:

1. Use o pacote `deploy:pack:ln:full`.
2. Extraia e reinicie o app.

## 6) Reiniciar e testar

No `Setup Node.js App`:

1. Clique em `RESTART`.
2. Teste:
- `https://seudominio.com/health`
- `https://seudominio.com/api`
- `https://seudominio.com/`

## 7) Atualizacoes futuras sem perder dados

Para atualizar codigo sem sobrescrever banco e uploads:

1. Gere: `npm run deploy:pack:ln:update`
2. Envie e extraia sobre a mesma pasta no `File Manager`.
3. Clique em `RESTART`.

## 8) Backup obrigatorio

Antes de qualquer atualizacao, salve copia de:

- `prisma/dev.db`
- `uploads/`
- `server/data/state.json`
