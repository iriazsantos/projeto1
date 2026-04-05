# 🧪 TESTING & DEPLOYMENT GUIDE

## Quick Start - Teste Local em 5 Minutos

### 1️⃣ Inicie o Servidor Backend
```bash
cd "c:\Users\NITRO 5\Downloads\INOVATECH CONNECT\INOVATECH CONNECT"
PORT=3001 npm run dev:server
```

✅ Esperado:
```
🚀 Server rodando em http://localhost:3001
📊 Health: http://localhost:3001/health
💳 Teste gateway: POST /api/gateway/test-connection
```

### 2️⃣ Em Outro Terminal: Inicie o Frontend
```bash
npm run dev:client
```

✅ Esperado:
```
  VITE v5.1.4  ready in 500 ms

  ➜  Local:   http://localhost:5173/
```

### 3️⃣ Em Outro Terminal: Rode os Testes
```bash
node test-payment-gateway.js
```

✅ Esperado:
```
🧪 Testando Payment Gateway Routes

1️⃣  Testando /health endpoint...
✅ Status: 200
```

---

## 🔑 Testar com Gateway Real (Sandbox)

### Opção 1: Asaas (Recomendado para Brasil)

**1. Criar conta em:** https://sandbox.asaas.com

**2. Obter API Key:**
- Dashboard → Configurações → Integrações → API
- Copiar a "Chave de Acesso"

**3. Testar conexão:**
```bash
curl -X POST a \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "asaas",
    "apiKey": "aac_sua_chave_aqui",
    "environment": "sandbox"
  }'
```

✅ Resposta esperada:
```json
{
  "success": true,
  "connected": true,
  "message": "Conexão bem-sucedida"
}
```

**4. Configurar no app:**
- Fazer login como admin
- Ir para Admin Master
- Gateway Configuration
- Salvar credenciais

---

## 📱 Fluxo Completo: Criar e Pagar

### Cenário: Cobrança PIX

**1. Admin configura gateway (já feito acima)**

**2. Criar cobrança:**
```bash
curl -X POST http://localhost:3001/api/gateway/create-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -d '{
    "condoId": "1",
    "amount": 50.00,
    "customerName": "João Silva",
    "customerEmail": "joao@example.com",
    "customerCpf": "123.456.789-00",
    "method": "pix"
  }'
```

Resposta (exemplo):
```json
{
  "success": true,
  "payment": {
    "id": "pay_abc123",
    "amount": 50.00,
    "status": "pending",
    "method": "pix"
  },
  "gateway": {
    "pixCode": "00020126580014...",
    "qrCodeImage": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020126580014..."
  }
}
```

**3. Visualizar PIX:**
- Abrir QRCode em app de celular
- Ou copiar código manual

**4. Simular pagamento (em sandbox):**
- No dashboard Asaas
- Ir para cobrança criada
- Botão "Marcar como Pago"
- Sistema recebe webhook automatically

**5. Verificar status:**
```bash
curl -X GET "http://localhost:3001/api/gateway/payments?condoId=1" \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

Status atualizado: `"status": "paid"`

---

## 🚀 Deploy em Produção

### 1. Configurar Variáveis de Ambiente
```bash
# .env.production
PORT=3000
NODE_ENV=production

ASAAS_API_KEY=aac_seu_id_producao
MERCADOPAGO_API_KEY=APP_seu_id_producao
STRIPE_API_KEY=sk_live_seu_id_producao

DATABASE_URL=file:./prod.db
JWT_SECRET=sua_chave_super_secreta

# Gateways em produção (não sandbox)
ASAAS_ENVIRONMENT=production
STRIPE_ENVIRONMENT=production
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Start Server com PM2
```bash
npm install -g pm2
pm2 start server/index.js --name "inovatech-backend"
pm2 start npm --name "inovatech-frontend" -- run "dev:client"
```

### 4. Configurar HTTPS
```bash
# Gerar certificado (Let's Encrypt via Certbot)
certbot certonly --standalone -d inovatech.com
```

### 5. Configurar Nginx Reverse Proxy
```nginx
server {
    listen 443 ssl;
    server_name inovatech.com;
    
    ssl_certificate /etc/letsencrypt/live/inovatech.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/inovatech.com/privatekey.pem;
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
    
    location / {
        proxy_pass http://localhost:5173;
    }
}
```

### 6. Registrar Webhook URLs nos Gateways
- Asaas: https://inovatech.com/api/gateway/webhooks/asaas
- MercadoPago: https://inovatech.com/api/gateway/webhooks/mercadopago
- Stripe: https://inovatech.com/api/gateway/webhooks/stripe

---

## 🐛 Troubleshooting

### Erro: "EADDRINUSE: address already in use"
```bash
# Matar processo na porta 3001
lsof -i :3001
kill -9 <PID>
```

### Erro: "JWT not valid"
- Verifique se está incluindo `Authorization: Bearer {token}` no header
- Faça login novamente para obter novo token

### Erro: "Gateway connection failed"
- Teste a chave API diretamente no webhook do gateway
- Verifique ambiente (sandbox vs production)

### Webhook não atualiza
- Verificar logs do servidor: `tail -f logs/server.log`
- Confirmar que webhook URL está configurado no gateway
- Disparar webhook de teste no dashboard do gateway

---

## 📊 Monitoramento

### Logs do Servidor
```bash
# Ver últimas 50 linhas
tail -50 logs/server.log

# Seguir logs em tempo real
tail -f logs/server.log

# Procurar por erros
grep "ERROR" logs/server.log
```

### Health Check
```bash
curl http://localhost:3001/health
```

Resposta:
```json
{
  "status": "OK",
  "timestamp": "2025-03-19T14:30:00Z",
  "gateways": ["asaas", "mercadopago", "stripe"]
}
```

### Database Integrity Check
```bash
# Validar dados da Payment table
sqlite3 prisma/dev.db "SELECT COUNT(*) as total_payments FROM Payment;"

# Listar últimas cobranças
sqlite3 prisma/dev.db ".mode column" "SELECT id, amount, status FROM Payment ORDER BY createdAt DESC LIMIT 10;"
```

---

## ✅ Checklist Pré-Produção

- [ ] Todos os testes passando
- [ ] Credenciais de gateway configuradas
- [ ] Webhook URLs registradas
- [ ] HTTPS configurado
- [ ] JWT secret aleatório gerado
- [ ] Backup do banco de dados
- [ ] Logs habilitados
- [ ] Error monitoring (Sentry) configurado
- [ ] Health checks funcionando
- [ ] Rate limiting implementado
- [ ] Email confirmação de pagamento
- [ ] Testes de carga executados

---

## 🎓 Documentação Referência

- [PAYMENT_GATEWAY_GUIDE.md](PAYMENT_GATEWAY_GUIDE.md) - API detalhada
- [PAYMENT_GATEWAY_SUMMARY.md](PAYMENT_GATEWAY_SUMMARY.md) - Overview técnico
- [PAYMENT_GATEWAY_COMPLETE.md](PAYMENT_GATEWAY_COMPLETE.md) - Status report

---

## 🆘 Suporte

**Problemas comuns:**
1. Porta 3001 em uso? Use `PORT=3002` no lugar
2. CORS error? Verificar `cors()` config em `server/index.js`
3. Banco bloqueado? Fechar outro cliente SQLite
4. Token expirado? Fazer login novamente

**Contato:**
- Issues no GitHub
- Email: support@inovatech.com
- Discord: [link do servidor]

---

**Teste local completo em ~5 minutos! 🚀**
