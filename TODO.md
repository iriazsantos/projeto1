so me# Plano de Implementação: Banco de Dados Funcional com Autenticação e Permissões

## Status: Em andamento

### 1. [✅] Criar middleware de autenticação (server/middleware/auth.js)
- JWT verify
- Anexar user ao req
- JWT verify
- Anexar user ao req

### 2. [✅] Criar rota de login (server/routes/auth.js)
- POST /api/auth/login (email/password -> JWT)
- POST /api/auth/login (email/password -> JWT)

### 3. [✅] Atualizar server/index.js
- Importar jsonwebtoken
- Adicionar rotas auth e users
- Aplicar middleware se necessário
- Importar jsonwebtoken
- Adicionar rotas auth
- Aplicar middleware se necessário

### 4. [✅] Atualizar server/routes/users.js
- Proteger todas CRUD com auth
- Validações de permissão por role/condomínio
- Proteger POST/PUT/DELETE com auth
- Validações de permissão:
  * Admin Master (role='admin', condoId=null): cria todos
  * Síndico/Admin (condoId): só morador/admin/porteiro no próprio condomínio

### 5. [✅] Atualizar seed (prisma/seed.js)
- Senhas consistentes com SALT_ROUNDS=12
- Adicionar roles claras: 'admin_master', 'sindico', 'admin', 'porteiro', 'morador'

### 6. [ ] Testar
- npx prisma generate
- node prisma/seed.js
- Testar login + criações

### 7. [ ] Frontend (opcional)
- Form login em UserManagement
