import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'inovatech-connect-secret-2024-superseguro';
const JWT_EXPIRATION = '24h'; // 24 horas

// POST /api/auth/login - Login de usuário
router.post('/', express.json(), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário por email OU nome (suporta login por username)
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        condoId: true,
        unit: true,
        active: true,
        cpf: true,
        phone: true,
        createdAt: true,
        password: true
      }
    });

    // Se não encontrou por email, tenta buscar por nome (username)
    if (!user) {
      const users = await prisma.user.findMany({
        where: { name: { equals: email } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          condoId: true,
          unit: true,
          active: true,
          cpf: true,
          phone: true,
          createdAt: true,
          password: true
        },
        take: 1
      });
      user = users[0] || null;
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    // Verificar senha (bcrypt hash OU texto plano para compatibilidade)
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.password);
    } catch {
      // Fallback: comparação direta (senhas não hasheadas)
    }
    if (!isValidPassword && password === user.password) {
      isValidPassword = true;
    }
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isPlatformAdmin = user.role === 'admin' || user.role === 'admin-master';
    if (!isPlatformAdmin && user.condoId) {
      const condo = await prisma.condominium.findUnique({
        where: { id: user.condoId },
        select: {
          blocked: true,
          name: true
        }
      });

      if (condo?.blocked) {
        return res.status(403).json({
          error: `Condominio ${condo.name} bloqueado por inadimplencia da licenca.`
        });
      }
    }

    // Gerar JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        condoId: user.condoId,
        unit: user.unit
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

// Remover password da resposta
    const { password: pw, ...safeUser } = user;

    res.json({
      success: true,
      token,
      user: safeUser,
      message: 'Login realizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;

