# 🚀 GUIA DE EXPORTAÇÃO — INOVATECH CONNECT
## Como transferir para outra plataforma

---

## 📁 ESTRUTURA COMPLETA DO PROJETO

```
inovatech-connect/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── manifest.json
│   └── sw.js
└── src/
    ├── main.tsx
    ├── App.tsx          (~3500 linhas)
    ├── index.css
    ├── types.ts
    ├── store.ts
    ├── WhatsAppChat.tsx
    ├── Marketplace.tsx
    ├── LandingPage.tsx
    ├── ReservationsModule.tsx
    ├── LicensePayment.tsx
    ├── GatewayConfig.tsx
    ├── MissingFeatures.tsx
    ├── NotificationSystem.tsx
    ├── PushNotificationSystem.tsx
    ├── ChatSystem.tsx
    ├── QRScanner.tsx
    ├── PixConfig.tsx
    └── utils/
        └── cn.ts
```

---

## 🥇 OPÇÃO 1 — StackBlitz (RECOMENDADO — Idêntico ao Bolt)

### Passo a passo:
1. Acesse **stackblitz.com**
2. Clique em **"Create new project"** → **"React + TypeScript + Vite"**
3. No terminal integrado, execute:
```bash
npm install qrcode @types/qrcode lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
4. Copie cada arquivo conforme a estrutura acima
5. Clique em **"Deploy"** → **Netlify** ou **Vercel**

✅ Funciona 100% igual ao Bolt.new
✅ Suporte completo a TypeScript
✅ Hot reload automático

---

## 🥈 OPÇÃO 2 — CodeSandbox

1. Acesse **codesandbox.io**
2. **"Import from GitHub"** (se tiver no GitHub) ou **"Create Sandbox"** → **"Vite + React + TS"**
3. No `package.json`, adicione as dependências
4. Cole os arquivos

---

## 🥉 OPÇÃO 3 — GitHub + Vercel (Para hospedar online)

### Criar repositório no GitHub:
```bash
git init
git add .
git commit -m "INOVATECH CONNECT - Sistema Completo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/inovatech-connect.git
git push -u origin main
```

### Deploy no Vercel:
1. Acesse **vercel.com**
2. **"Add New Project"** → Importar do GitHub
3. Framework: **Vite**
4. **Deploy** → URL pública em 2 minutos!

---

## 🤖 OPÇÃO 4 — IAs para Recriar

### Claude.ai (MELHOR para recriar código complexo):
- Acesse **claude.ai**
- Cole o prompt abaixo + cada arquivo

### v0.dev (Vercel - especialista em React/Tailwind):
- Acesse **v0.dev**
- Cole o prompt de funcionalidades

### Cursor AI (Editor local com IA):
- Baixe em **cursor.com**
- Abra a pasta do projeto
- Ctrl+K para pedir modificações

---

## 📋 PROMPT PARA RECRIAR EM QUALQUER IA

```
Crie um sistema de gestão de condomínios chamado "INOVATECH CONNECT" 
usando React + TypeScript + Vite + Tailwind CSS com as seguintes funcionalidades:

TECNOLOGIAS:
- React 18 + TypeScript + Vite + Tailwind CSS
- Biblioteca qrcode para gerar QR Codes
- Estado gerenciado com useState/useEffect (sem Redux)
- Dados mock em memória (sem backend real)

4 PERFIS DE USUÁRIO:
1. Admin Master - gerencia todos os condomínios e usuários
2. Síndico - gerencia seu condomínio
3. Porteiro - registra encomendas e controla acesso
4. Morador - acessa seus dados e serviços

MÓDULOS COMPLETOS:
✅ Tela de login split-screen com foto de condomínio
✅ Landing page com animações e partículas
✅ Dashboard por perfil com estatísticas
✅ Gestão de condomínios (CRUD completo)
✅ Gestão de usuários com CPF, data de nascimento, foto via câmera
✅ Sistema financeiro com pagamento via PIX (QR Code real)
✅ Encomendas com QR Code criptografado e câmera real para leitura
✅ Marketplace estilo Facebook com fotos, categorias, busca
✅ Chat interno estilo WhatsApp com áudio, emojis, ligações de voz/vídeo
✅ Sistema de reservas com calendário, slots de horário, multa automática
✅ Votações/assembleias com resultados em tempo real
✅ Denúncias anônimas com categorias e urgência
✅ Comunicados com prioridade (normal/importante/urgente)
✅ Controle de acesso e visitantes na portaria
✅ Manutenção e chamados com fotos e prioridade
✅ Documentos digitais com categorias e upload
✅ Marketplace com mensagens diretas pelo chat interno
✅ Sistema de licença: Admin cobra condomínios, bloqueio automático após 30 dias
✅ Configuração PIX do síndico (independente do gateway do admin)
✅ Gateway de pagamento configurável (Asaas/MercadoPago/Stripe/PagSeguro)
✅ Notificações push com som (Web Audio API)
✅ PWA com banner de instalação
✅ 3 temas: Claro, Dark, Oceano
✅ Layout responsivo mobile/desktop
✅ Animações em botões (ripple, glow, shimmer)
✅ Gestão de pessoas (síndico): moradores com login, porteiros com login, funcionários sem login
✅ Permissão por morador: visualizar ou não cobranças
✅ Parentesco/vínculo ao cadastrar moradores da mesma unidade
✅ Foto do morador via câmera ou arquivo
✅ Achados e perdidos
✅ Relatórios e analytics
✅ Banco de dados SQL completo com schema PostgreSQL
✅ Backend PHP 8.2 com API REST

IDENTIDADE VISUAL:
- Nome: INOVATECH CONNECT
- Tela de login: split screen (foto condomínio + formulário preto)
- Sidebar branca com menu colorido
- Cards com gradientes suaves
- Glassmorphism no header
```

---

## 💾 BACKUP DOS ARQUIVOS PRINCIPAIS

### package.json necessário:
```json
{
  "name": "inovatech-connect",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.9",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

### tailwind.config.js:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

### vite.config.ts:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
})
```

---

## 🌐 HOSPEDAGEM RECOMENDADA

| Plataforma | URL de Exemplo | Custo | Dificuldade |
|---|---|---|---|
| **Vercel** | inovatech.vercel.app | Grátis | ⭐ Fácil |
| **Netlify** | inovatech.netlify.app | Grátis | ⭐ Fácil |
| **GitHub Pages** | usuario.github.io/inovatech | Grátis | ⭐⭐ Médio |
| **VPS + Nginx** | inovatech.com | ~R$25/mês | ⭐⭐⭐ Difícil |
| **Hostinger** | inovatech.com | ~R$15/mês | ⭐⭐ Médio |
| **cPanel Hosting** | inovatech.com | ~R$20/mês | ⭐⭐ Médio |

### Para hospedar com PHP (cPanel/Hostinger):
1. Execute `npm run build` na pasta do projeto
2. Faça upload da pasta `dist/` para `public_html/`
3. Faça upload da pasta `backend/` para o servidor
4. Configure o banco MySQL com o arquivo `backend/schema.sql`
5. Edite `backend/config/database.php` com suas credenciais
6. Acesse seu domínio!

---

## 📞 DADOS DE ACESSO PADRÃO

Após configurar o sistema, use:

| Usuário | Email | Senha |
|---|---|---|
| Admin Master | admin@inovatech.com | 123456 |
| Síndico | sindico@teste.com | 123456 |
| Porteiro | porteiro@teste.com | 123456 |
| Morador | morador@teste.com | 123456 |

---

*INOVATECH CONNECT © 2024 — Todos os direitos reservados*
