# Deploy Completo na Link Nacional (Front + Back + Banco)

Este projeto ja esta preparado para rodar na Link Nacional via cPanel (Setup Node.js App) com:

- Frontend servido pelo proprio Express (`dist`).
- Backend API em `/api/*`.
- Banco SQLite em `prisma/dev.db`.

## Fluxo sem terminal (recomendado para seu caso)

Se sua hospedagem nao oferece terminal, siga:

- `LINKNACIONAL_SEM_TERMINAL.md`

Esse guia usa apenas cPanel (`Setup Node.js App` + `File Manager`) e pacote ZIP pronto para upload.

## Fluxo com terminal (VPS/SSH)

Se sua conta agora tem terminal SSH, siga:

- `LINKNACIONAL_VPS_TERMINAL.md`

## 1) Criar app Node no cPanel

No cPanel da Link Nacional:

1. Abra `Setup Node.js App`.
   - Se nao aparecer esse recurso, solicite ao suporte a ativacao do Node/Application Manager na sua conta.
2. Clique em `CREATE APPLICATION`.
3. Configure:
   - `Node.js version`: 20+ (preferencialmente 22, se disponivel).
   - `Application mode`: `Production`.
   - `Application root`: pasta do projeto (ex.: `inovatech-connect`).
   - `Application startup file`: `app.js`.
   - `Application URL`: seu dominio/subdominio final.
4. Clique em `CREATE`.

## 2) Enviar arquivos para hospedagem

Use Git, FTP ou Gerenciador de Arquivos para enviar o projeto para a pasta definida em `Application root`.

Arquivos/pastas obrigatorios:

- `app.js`
- `server/`
- `src/` (se for buildar no servidor)
- `prisma/`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig*.json`
- `public/` (opcional, recomendado manter)

## 3) Configurar variaveis de ambiente

No `Setup Node.js App` > `Environment Variables`, adicione pelo menos:

- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET=SEU_SEGREDO_FORTE`
- `CORS_ORIGINS=https://seudominio.com,https://www.seudominio.com`
- `DATABASE_URL=file:./prisma/dev.db`

Use o arquivo `env.linknacional.example` como referencia.

## 4) Rodar deploy pelo Terminal do cPanel (opcional)

Dentro da pasta do projeto:

```bash
chmod +x scripts/linknacional-postdeploy.sh
npm run deploy:linknacional
```

Se quiser popular dados iniciais:

```bash
RUN_SEED=true npm run deploy:linknacional
```

## 5) Reiniciar e validar

1. Volte em `Setup Node.js App`.
2. Clique em `RESTART`.
3. Teste:
   - `https://seudominio.com/health`
   - `https://seudominio.com/api`
   - `https://seudominio.com/` (frontend)

## 6) Persistencia e backup (obrigatorio)

Faca backup frequente de:

- `prisma/dev.db`
- `uploads/`
- `server/data/state.json`

## 7) Atualizacoes futuras

A cada update:

```bash
git pull
npm run deploy:linknacional
```

Depois clique em `RESTART` no Setup Node.js App.

## 8) Referencias da plataforma

- Link Nacional: Setup Node.js App no cPanel  
  https://www.linknacional.com.br/blog/node-js/
- cPanel Application Manager (Passenger / variaveis / deploy)  
  https://docs.cpanel.net/cpanel/software/application-manager/102/
