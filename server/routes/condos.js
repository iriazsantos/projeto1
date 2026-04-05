import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

function isMasterAdmin(user) {
  return user?.role === 'admin' || user?.role === 'admin-master';
}

function parseUnits(units) {
  if (units === undefined || units === null || units === '') return 0;
  const parsed = Number.parseInt(String(units), 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function normalizeDocument(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isValidCNPJ(value) {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base, weights) => {
    const sum = base
      .split('')
      .reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calcDigit(`${cnpj.slice(0, 12)}${firstDigit}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstDigit === Number(cnpj[12]) && secondDigit === Number(cnpj[13]);
}

// GET /api/condos - Lista condominios
router.get('/', authMiddleware, async (req, res) => {
  try {
    const condos = await prisma.condominium.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        units: true,
        sindico: true,
        sindicoId: true,
        active: true,
        blocked: true,
        monthlyRevenue: true,
        pendingCharges: true,
        licenseValue: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const condosWithCounts = await Promise.all(
      condos.map(async (condo) => {
        const userCount = await prisma.user.count({
          where: { condoId: condo.id, active: true }
        });

        return {
          ...condo,
          residents: userCount,
          units: condo.units
        };
      })
    );

    res.json(condosWithCounts);
  } catch (error) {
    console.error('Erro /api/condos GET:', error);
    res.status(500).json({ error: 'Falha ao listar condominios' });
  }
});

// POST /api/condos - Cria condominio
router.post('/', express.json(), authMiddleware, async (req, res) => {
  try {
    if (!isMasterAdmin(req.user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode criar condominios' });
    }

    const {
      name,
      cnpj,
      email,
      phone,
      address,
      city,
      units,
      sindico,
      sindicoId,
      licenseValue
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nome do condominio e obrigatorio' });
    }

    const normalizedCnpj = normalizeDocument(cnpj);
    if (normalizedCnpj && !isValidCNPJ(normalizedCnpj)) {
      return res.status(400).json({ error: 'CNPJ invalido. Informe um CNPJ valido para cobrar via gateway.' });
    }

    const normalizedEmail = email ? String(email).trim() : '';
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Email invalido. Informe um email valido no cadastro do condominio.' });
    }

    const condo = await prisma.condominium.create({
      data: {
        name: String(name).trim(),
        cnpj: normalizedCnpj || null,
        email: normalizedEmail || null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : '',
        city: city ? String(city).trim() : '',
        units: parseUnits(units),
        residents: 0,
        sindico: sindico ? String(sindico).trim() : 'Sindico nao definido',
        sindicoId: sindicoId ? String(sindicoId).trim() : 'sem-sindico',
        active: true,
        blocked: false,
        monthlyRevenue: 0,
        pendingCharges: 0,
        licenseValue: Number(licenseValue) > 0 ? Number(licenseValue) : 299
      }
    });

    res.status(201).json(condo);
  } catch (error) {
    console.error('Erro /api/condos POST:', error);
    res.status(500).json({ error: 'Falha ao criar condominio' });
  }
});

// PUT /api/condos/:id - Atualiza cadastro do condominio
router.put('/:id', express.json(), authMiddleware, async (req, res) => {
  try {
    if (!isMasterAdmin(req.user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode editar condominios' });
    }

    const { id } = req.params;
    const {
      name,
      cnpj,
      email,
      phone,
      address,
      city,
      units,
      active,
      blocked,
      licenseValue
    } = req.body || {};

    const updateData = {};

    if (name !== undefined) updateData.name = String(name).trim();
    if (cnpj !== undefined) {
      const normalizedCnpj = normalizeDocument(cnpj);
      if (normalizedCnpj && !isValidCNPJ(normalizedCnpj)) {
        return res.status(400).json({ error: 'CNPJ invalido. Informe um CNPJ valido para cobrar via gateway.' });
      }
      updateData.cnpj = normalizedCnpj || null;
    }
    if (email !== undefined) {
      const normalizedEmail = email ? String(email).trim() : '';
      if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'Email invalido. Informe um email valido no cadastro do condominio.' });
      }
      updateData.email = normalizedEmail || null;
    }
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (address !== undefined) updateData.address = String(address).trim();
    if (city !== undefined) updateData.city = String(city).trim();
    if (units !== undefined) updateData.units = parseUnits(units);
    if (active !== undefined) updateData.active = Boolean(active);
    if (blocked !== undefined) updateData.blocked = Boolean(blocked);
    if (licenseValue !== undefined) {
      const parsedLicenseValue = Number(licenseValue);
      if (!Number.isNaN(parsedLicenseValue) && parsedLicenseValue >= 0) {
        updateData.licenseValue = parsedLicenseValue;
      }
    }

    const condo = await prisma.condominium.update({
      where: { id },
      data: updateData
    });

    res.json(condo);
  } catch (error) {
    console.error('Erro /api/condos PUT:', error);
    res.status(500).json({ error: 'Falha ao atualizar condominio' });
  }
});

export default router;
