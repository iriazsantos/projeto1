import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const ALLOWED_ROLES = new Set(['admin', 'admin-master', 'sindico', 'porteiro', 'morador']);

function isMasterAdmin(user) {
  return user?.role === 'admin' || user?.role === 'admin-master';
}

function isCondoManager(user) {
  return user?.role === 'sindico' || user?.role === 'admin';
}

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return ALLOWED_ROLES.has(normalized) ? normalized : null;
}

function sanitizeOptional(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (!cpf || cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(cpf[10]);
}

function parseBirthDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAdult(dateValue, minAge = 18) {
  const birthDate = parseBirthDate(dateValue);
  if (!birthDate) return false;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age >= minAge;
}

// GET /api/users - lista usuarios
router.get('/', authMiddleware, async (req, res) => {
  try {
    const creator = req.user;
    const where = {};
    const includeInactive = req.query?.includeInactive === 'true' && isMasterAdmin(creator);

    if (!isMasterAdmin(creator) && creator?.condoId) {
      where.condoId = creator.condoId;
    }
    if (!includeInactive) {
      where.active = true;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        birthDate: true,
        condoId: true,
        unit: true,
        active: true,
        canViewCharges: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Erro /api/users GET:', error);
    res.status(500).json({ error: 'Falha ao listar usuarios' });
  }
});

// POST /api/users - criar usuario
router.post('/', express.json(), authMiddleware, async (req, res) => {
  try {
    const creator = req.user;
    if (!creator) {
      return res.status(401).json({ error: 'Autenticacao requerida' });
    }

    const { name, email, password, role, cpf, phone, birthDate, condoId, unit, active, canViewCharges } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email e password sao obrigatorios' });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Email invalido.' });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: 'Perfil invalido. Use: admin, admin-master, sindico, porteiro ou morador.' });
    }

    const normalizedCpf = sanitizeOptional(cpf);
    if (normalizedCpf && !isValidCpf(normalizedCpf)) {
      return res.status(400).json({ error: 'CPF invalido.' });
    }

    const parsedBirthDate = parseBirthDate(birthDate);
    if (birthDate !== undefined && birthDate !== null && birthDate !== '' && !parsedBirthDate) {
      return res.status(400).json({ error: 'birthDate invalido.' });
    }
    if (parsedBirthDate && !isAdult(parsedBirthDate, 18)) {
      return res.status(400).json({ error: 'Usuario deve ter pelo menos 18 anos.' });
    }

    const master = isMasterAdmin(creator);
    const sameCondo = Boolean(condoId && creator?.condoId && condoId === creator.condoId);

    if (!master) {
      const allowedRoleForCondoManager = normalizedRole === 'morador' || normalizedRole === 'porteiro';
      if (!isCondoManager(creator) || !sameCondo || !allowedRoleForCondoManager) {
        return res.status(403).json({ error: 'Permissao negada para criar este perfil neste condominio.' });
      }
    }

    if ((normalizedRole === 'sindico' || normalizedRole === 'morador' || normalizedRole === 'porteiro') && !condoId) {
      return res.status(400).json({ error: 'condoId e obrigatorio para sindico, morador e porteiro.' });
    }

    const normalizedCondoId = sanitizeOptional(condoId);
    if (normalizedCondoId) {
      const condo = await prisma.condominium.findUnique({ where: { id: normalizedCondoId }, select: { id: true } });
      if (!condo) {
        return res.status(400).json({ error: 'condoId invalido.' });
      }
    }

    const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: normalizedRole,
        cpf: normalizedCpf ? onlyDigits(normalizedCpf) : null,
        phone: sanitizeOptional(phone),
        birthDate: parsedBirthDate ? parsedBirthDate.toISOString().slice(0, 10) : null,
        condoId: normalizedCondoId,
        unit: sanitizeOptional(unit),
        active: active !== false,
        canViewCharges: canViewCharges === true
      }
    });

    if (normalizedRole === 'sindico' && user.condoId) {
      try {
        await prisma.condominium.update({
          where: { id: user.condoId },
          data: {
            sindico: user.name,
            sindicoId: user.id
          }
        });
      } catch (err) {
        console.warn('Nao foi possivel atualizar sindico no condominio:', err.message);
      }
    }

    const { password: pw, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('Erro /api/users POST:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ error: 'Este e-mail ja esta em uso.' });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('cpf')) {
      return res.status(400).json({ error: 'Este CPF ja esta em uso.' });
    }
    res.status(500).json({ error: 'Falha ao criar usuario', details: error.message });
  }
});

// GET /api/users/by-condo/:condoId - listar por condominio
router.get('/by-condo/:condoId', authMiddleware, async (req, res) => {
  try {
    const creator = req.user;
    const { condoId } = req.params;
    const includeInactive = req.query?.includeInactive === 'true' && isMasterAdmin(creator);

    const allowed = isMasterAdmin(creator)
      || (isCondoManager(creator) && creator?.condoId === condoId);

    if (!allowed) {
      return res.status(403).json({ error: 'Sem permissao para ver usuarios deste condominio' });
    }

    const users = await prisma.user.findMany({
      where: {
        condoId,
        ...(includeInactive ? {} : { active: true })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        birthDate: true,
        condoId: true,
        unit: true,
        active: true,
        canViewCharges: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Erro /api/users/by-condo GET:', error);
    res.status(500).json({ error: 'Falha ao listar usuarios do condominio' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        birthDate: true,
        condoId: true,
        unit: true,
        active: true,
        canViewCharges: true,
        createdAt: true
      }
    });

    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
    res.json(user);
  } catch (error) {
    console.error('Erro /api/users/:id:', error);
    res.status(500).json({ error: 'Falha ao buscar usuario' });
  }
});

// PUT /api/users/:id - atualizar
router.put('/:id', express.json(), authMiddleware, async (req, res) => {
  try {
    const creator = req.user;

    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const master = isMasterAdmin(creator);
    const allowed = master || (isCondoManager(creator) && targetUser.condoId === creator?.condoId);

    if (!allowed) {
      return res.status(403).json({ error: 'Sem permissao para editar este usuario' });
    }

    const { name, email, password, role, cpf, phone, birthDate, condoId, unit, active, canViewCharges } = req.body || {};

    let normalizedRole;
    if (role !== undefined) {
      normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        return res.status(400).json({ error: 'Perfil invalido. Use: admin, admin-master, sindico, porteiro ou morador.' });
      }
    }

    if (!master) {
      if (normalizedRole && normalizedRole !== 'morador' && normalizedRole !== 'porteiro') {
        return res.status(403).json({ error: 'Somente Admin Master pode definir perfil sindico/admin.' });
      }
      if (condoId !== undefined && condoId !== creator?.condoId) {
        return res.status(403).json({ error: 'Sem permissao para mover usuario para outro condominio.' });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (email !== undefined) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'Email invalido.' });
      }
      updates.email = normalizedEmail;
    }
    if (cpf !== undefined) {
      const normalizedCpf = sanitizeOptional(cpf);
      if (normalizedCpf && !isValidCpf(normalizedCpf)) {
        return res.status(400).json({ error: 'CPF invalido.' });
      }
      updates.cpf = normalizedCpf ? onlyDigits(normalizedCpf) : null;
    }
    if (phone !== undefined) updates.phone = sanitizeOptional(phone);
    if (birthDate !== undefined) {
      if (birthDate === null || String(birthDate).trim() === '') {
        updates.birthDate = null;
      } else {
        const parsedBirthDate = parseBirthDate(birthDate);
        if (!parsedBirthDate) {
          return res.status(400).json({ error: 'birthDate invalido.' });
        }
        if (!isAdult(parsedBirthDate, 18)) {
          return res.status(400).json({ error: 'Usuario deve ter pelo menos 18 anos.' });
        }
        updates.birthDate = parsedBirthDate.toISOString().slice(0, 10);
      }
    }
    if (condoId !== undefined) {
      const normalizedCondoId = sanitizeOptional(condoId);
      if (normalizedCondoId) {
        const condo = await prisma.condominium.findUnique({ where: { id: normalizedCondoId }, select: { id: true } });
        if (!condo) {
          return res.status(400).json({ error: 'condoId invalido.' });
        }
      }
      updates.condoId = normalizedCondoId;
    }
    if (unit !== undefined) updates.unit = sanitizeOptional(unit);
    if (active !== undefined) updates.active = active === true;
    if (canViewCharges !== undefined) updates.canViewCharges = canViewCharges === true;
    if (normalizedRole !== undefined) updates.role = normalizedRole;

    if (password) {
      updates.password = await bcrypt.hash(String(password), SALT_ROUNDS);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        birthDate: true,
        condoId: true,
        unit: true,
        active: true,
        canViewCharges: true,
        createdAt: true
      }
    });

    if (user.role === 'sindico' && user.condoId) {
      try {
        await prisma.condominium.update({
          where: { id: user.condoId },
          data: {
            sindico: user.name,
            sindicoId: user.id
          }
        });
      } catch (err) {
        console.warn('Nao foi possivel atualizar sindico no condominio:', err.message);
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Erro /api/users PUT:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ error: 'Este e-mail ja esta em uso.' });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('cpf')) {
      return res.status(400).json({ error: 'Este CPF ja esta em uso.' });
    }
    res.status(500).json({ error: 'Falha ao atualizar usuario' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const creator = req.user;

    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const master = isMasterAdmin(creator);
    const allowed = master || (isCondoManager(creator) && targetUser.condoId === creator?.condoId);

    if (!allowed) {
      return res.status(403).json({ error: 'Sem permissao para deletar este usuario' });
    }

    try {
      await prisma.user.delete({ where: { id: req.params.id } });
      return res.json({ success: true, mode: 'hard-delete' });
    } catch (removeError) {
      const isForeignKeyConstraint = removeError?.code === 'P2003'
        || String(removeError?.message || '').includes('Foreign key constraint');

      if (!isForeignKeyConstraint) {
        throw removeError;
      }

      await prisma.user.update({
        where: { id: req.params.id },
        data: { active: false }
      });

      return res.json({ success: true, mode: 'soft-delete' });
    }
  } catch (error) {
    console.error('Erro /api/users DELETE:', error);
    res.status(500).json({ error: 'Falha ao deletar usuario' });
  }
});

export default router;
