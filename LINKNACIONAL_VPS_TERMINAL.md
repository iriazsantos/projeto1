# Deploy na VPS cPanel Com Terminal (SSH)

Este guia deixa seu sistema pronto para subir na VPS com cPanel usando terminal.

## 0) Pré-requisito no Grupo MEB (WHM)

Como sua VPS esta no Grupo MEB, confirme primeiro se o WHM tem suporte Node via Application Manager.

No WHM (root), os pacotes precisam estar instalados:

- AlmaLinux/Rocky 9: `ea-apache24-mod-passenger`, `ea-apache24-mod_env`, `ea-nodejs20` ou `ea-nodejs22`
- AlmaLinux/Rocky 8: `ea-ruby27-mod_passenger`, `ea-apache24-mod_env`, `ea-nodejs20` ou `ea-nodejs22`

Comandos de referencia (root):

```bash
dnf install -y ea-apache24-mod-passenger ea-apache24-mod_env ea-nodejs22
```

Se o `Application Manager` nao aparecer no cPanel, habilite na feature list do WHM.

## 1) Pacote para enviar (recomendado)

No seu computador, gere o pacote precompilado:

```bash
npm run deploy:pack:ln:min
```

Arquivo gerado em:

`deploy-packages/linknacional/`

Use o ZIP `*-min-no-modules.zip`.

## 2) Criar app Node no cPanel

No `Setup Node.js App`:

1. `Node.js version`: 20+ (ideal 22).
2. `Application mode`: `Production`.
3. `Application root`: pasta do projeto (ex.: `inovatech-connect`).
4. `Application startup file`: `app.js`.
5. Criar a aplicacao.

## 3) Upload do ZIP

Envie o ZIP para a pasta do projeto via:

- File Manager do cPanel, ou
- SCP/SFTP.

Depois extraia o ZIP dentro do `Application root`.

## 4) Variaveis de ambiente

No `Setup Node.js App` > `Environment Variables`:

- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET=SEU_SEGREDO_FORTE`
- `CORS_ORIGINS=https://seudominio.com,https://www.seudominio.com`
- `DATABASE_URL=file:./prisma/dev.db`

Base: `env.linknacional.example`.

## 5) Deploy via terminal (SSH)

Entre na pasta da aplicacao e rode:

```bash
cd ~/inovatech-connect
sed -i 's/\r$//' scripts/linknacional-postdeploy.sh
chmod +x scripts/linknacional-postdeploy.sh
npm run deploy:linknacional:skip-build
```

`skip-build` e o modo ideal para pacote precompilado.

Se o script npm nao existir no `package.json` enviado, rode direto:

```bash
bash scripts/linknacional-postdeploy.sh --skip-build
```

Se voce subir o codigo fonte completo e quiser compilar na VPS:

```bash
npm run deploy:linknacional
```

## 6) Reiniciar app

No cPanel `Setup Node.js App`, clique em `RESTART`.

## 7) Validacao

- `https://seudominio.com/health`
- `https://seudominio.com/api`
- `https://seudominio.com/`

## 8) Atualizacao sem perder dados

Para atualizacoes futuras preservando banco/uploads:

1. Gere local: `npm run deploy:pack:ln:update`
2. Envie e extraia sobre a pasta da app.
3. SSH:

```bash
cd ~/inovatech-connect
npm run deploy:linknacional:skip-build
```

4. Reinicie a app no cPanel.

## 9) Diagnostico rapido (se der erro)

Rode e envie a saida:

```bash
cd ~/inovatech-connect
pwd
ls -lah
command -v node || true
command -v npm || true
ls -d /opt/cpanel/ea-nodejs*/bin 2>/dev/null || true
npm run deploy:linknacional:skip-build 2>&1 | tee deploy-error.log
```
