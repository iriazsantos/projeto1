# Configuração de Gateways de Pagamento - INOVATECH CONNECT

Este documento explica como configurar os gateways de pagamento reais no sistema INOVATECH CONNECT.

## 🏗️ Arquitetura Implementada

O sistema agora possui integrações reais com:
- **Asaas** - Gateway líder no Brasil
- **Mercado Pago** - Maior fintech da América Latina  
- **Stripe** - Gateway internacional

### Componentes Criados:

1. **`server/gateway-integrations.js`** - Módulo com integrações reais
2. **`src/PixChargeGenerator.tsx`** - Componente para cobranças PIX reais
3. **Endpoints atualizados** - API endpoints com integração real

## 🔧 Configuração dos Gateways

### 1. Asaas

#### Sandbox (Teste)
- **API URL**: `https://sandbox.asaas.com/api/v3`
- **Cadastro**: https://sandbox.asaas.com/
- **Documentação**: https://asaasv3.docs.apiary.io

#### Campos necessários:
```json
{
  "apiKey": "sua_api_key_aqui",
  "environment": "sandbox",
  "webhookSecret": "seu_webhook_secret_aqui"
}
```

#### Passos:
1. Crie conta no Asaas Sandbox
2. Copie a API Key do dashboard
3. Configure webhook URL: `https://seu-dominio.com/api/webhooks/asaas`
4. Teste conexão no painel do sistema

### 2. Mercado Pago

#### Sandbox (Teste)
- **API URL**: `https://api.mercadopago.com/sandbox/v1`
- **Cadastro**: https://www.mercadopago.com.br/developers
- **Documentação**: https://www.mercadopago.com.br/developers

#### Campos necessários:
```json
{
  "apiKey": "seu_access_token_aqui",
  "environment": "sandbox",
  "webhookSecret": "seu_webhook_secret_aqui"
}
```

#### Passos:
1. Crie aplicação no Mercado Pago Developers
2. Copie o Access Token
3. Configure webhook URL: `https://seu-dominio.com/api/webhooks/mercadopago`
4. Configure eventos: `payment.created`, `payment.updated`

### 3. Stripe

#### Teste
- **API URL**: `https://api.stripe.com/v1`
- **Cadastro**: https://dashboard.stripe.com/register
- **Documentação**: https://stripe.com/docs/api

#### Campos necessários:
```json
{
  "apiKey": "sk_test_...", // Chave secreta de teste
  "environment": "sandbox",
  "webhookSecret": "whsec_..." // Webhook signing secret
}
```

#### Passos:
1. Crie conta Stripe
2. Copie a Secret Key (sk_test_...)
3. Configure webhook endpoint: `https://seu-dominio.com/api/webhooks/stripe`
4. Configure eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`

## 🚀 Como Usar

### 1. Configurar Gateway no Sistema

1. Acesse o módulo **Gateway Config** no sistema
2. Selecione o gateway desejado
3. Preencha os campos:
   - **API Key**: Chave de API do gateway
   - **Environment**: `sandbox` para teste, `production` para produção
   - **Webhook Secret**: Secret para validar webhooks (opcional)
4. Clique em **Testar Conexão**
5. Salve configuração

### 2. Criar Cobranças

#### Cobranças em Lote
```javascript
// Via API
POST /api/gateway/create-charges
{
  "dueDay": 10,
  "monthlyValue": "299.90"
}
```

#### Cobrança PIX Individual
```javascript
// Via componente React
<PixChargeGenerator 
  chargeId="charge_123"
  amount={299.90}
  description="Licença Mensal"
  onGenerated={(data) => console.log(data)}
/>
```

### 3. Receber Pagamentos

Os webhooks são processados automaticamente:
- Pagamentos confirmados atualizam status no banco
- Notificações são criadas para os usuários
- Condomínios são desbloqueados automaticamente

## 📋 Fluxo Completo

1. **Configuração**: Admin configura gateway no painel
2. **Criação**: Sistema cria cobranças no gateway e no banco
3. **Pagamento**: Cliente paga via PIX, boleto ou cartão
4. **Webhook**: Gateway envia confirmação de pagamento
5. **Processamento**: Sistema atualiza status e desbloqueia acesso

## 🔍 Monitoramento

### Logs de Webhook
Todos os webhooks são logados no console:
```
[WEBHOOK] asaas: {"event":"PAYMENT_CONFIRMED","payment":{...}}
```

### Status das Cobranças
- **pending**: Aguardando pagamento
- **paid**: Paga (confirmada via webhook)
- **cancelled**: Cancelada
- **overdue**: Vencida

## 🛡️ Segurança

### Validação de Webhooks
- Asaas: Validação via header `asaas-signature`
- Stripe: Validação via header `stripe-signature`
- Mercado Pago: Validação via header `x-signature`

### Variáveis de Ambiente
Para produção, configure:
```bash
JWT_SECRET=seu_jwt_secret
NODE_ENV=production
```

## 🧪 Testes

### Testar Conexão
1. Configure gateway em modo sandbox
2. Clique em "Testar Conexão"
3. Verifique se retorna "Conectado com sucesso"

### Testar Webhook
Use ferramentas como:
- **ngrok**: `ngrok http 3001` para expor localhost
- **Webhook.site**: Para testar endpoints

## 📞 Suporte

### Links Úteis
- **Asaas**: https://asaas.freshdesk.com/
- **Mercado Pago**: https://www.mercadopago.com.br/developers/support/
- **Stripe**: https://support.stripe.com/

### Problemas Comuns

1. **API Key inválida**: Verifique se copiou a chave correta
2. **Webhook não funciona**: Confirme URL e se está acessível
3. **Cobrança não criada**: Verifique limites da conta sandbox

## 🚀 Próximos Passos

1. **Configurar ambiente de produção** com chaves reais
2. **Personalizar webhooks** para regras de negócio
3. **Implementar retentativas automáticas** para pagamentos falhos
4. **Adicionar relatórios** de faturamento

---

## 📝 Resumo das Mudanças

✅ **Simulação → Real**: Sistema agora integra com APIs reais  
✅ **Webhooks Funcionais**: Processamento automático de pagamentos  
✅ **PIX Real**: Geração de QR Codes via gateways  
✅ **Notificações**: Alertas automáticos de pagamento  
✅ **Multi-Gateway**: Suporte a 3 principais gateways  

O sistema está pronto para uso em ambiente de teste e facilmente configurável para produção.
