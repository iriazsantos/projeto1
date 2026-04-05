# Build Mobile (APK e iPhone)

## 1) Defina a URL da API para o app mobile

Use `.env.mobile.example` como base e crie um arquivo `.env` (ou `.env.production`) na raiz com:

```env
VITE_API_BASE_URL=https://SEU_BACKEND_PUBLICO
```

Exemplo:

```env
VITE_API_BASE_URL=https://api.inovatechconnect.com.br
```

Sem essa variavel, o app usa caminho relativo (`/api`) e no mobile nao encontra o backend.

## 2) Gerar projeto Android e iOS (uma vez)

```bash
npm run cap:add:android
npm run cap:add:ios
```

## 3) Sincronizar web build com os apps nativos

```bash
npm run mobile:android:sync
npm run mobile:ios:sync
```

## 4) Android APK (debug)

```bash
npm run mobile:android:apk
```

Saida esperada:

`android/app/build/outputs/apk/debug/app-debug.apk`

Para abrir no Android Studio:

```bash
npm run mobile:android:open
```

## 5) iPhone (iOS)

No Windows nao e possivel compilar `.ipa`. Voce precisa de macOS + Xcode.

Passos:

1. Suba o projeto no mac (mesmo codigo).
2. Rode `npm run mobile:ios:sync`.
3. Rode `npm run mobile:ios:open`.
4. No Xcode, assine o app e gere o build para TestFlight/App Store.

## 6) Backend CORS para mobile

O backend ja aceita por padrao:

- `http://localhost`
- `http://localhost:5173`
- `capacitor://localhost`
- `ionic://localhost`

Para liberar dominios adicionais, configure no servidor:

```env
CORS_ORIGINS=https://seu-front.com,https://outro-dominio.com
```
