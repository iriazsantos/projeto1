import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = new Set(['admin', 'admin-master']);

function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || '').toLowerCase());
}

function parseMaybeDate(value) {
  if (!value) return value;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed;
}

function parseDateStrict(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateFields(data, keys) {
  const next = { ...(data || {}) };
  for (const key of keys) {
    if (key in next) {
      next[key] = parseMaybeDate(next[key]);
    }
  }
  return next;
}

function toMinutes(time) {
  if (!time || !String(time).includes(':')) return null;
  const [h, m] = String(time).split(':').map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

async function checkReservationConflict({ condoId, areaId, date, startTime, endTime, ignoreId = null }) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return { ok: false, reason: 'Horario invalido. Use HH:mm e fim maior que inicio.' };
  }

  const targetDate = String(date || '').trim();
  if (!targetDate) {
    return { ok: false, reason: 'Data invalida.' };
  }

  const where = {
    condoId,
    areaId,
    date: targetDate,
    status: { in: ['pending', 'confirmed'] },
  };
  if (ignoreId) where.id = { not: ignoreId };

  const reservations = await prisma.reservation.findMany({ where });
  const hasOverlap = reservations.some((item) => {
    const otherStart = toMinutes(item.startTime);
    const otherEnd = toMinutes(item.endTime);
    if (otherStart === null || otherEnd === null) return false;
    return start < otherEnd && end > otherStart;
  });

  return hasOverlap
    ? { ok: false, reason: 'Ja existe reserva conflitante para esta area e horario.' }
    : { ok: true };
}

router.post('/reservations', authMiddleware, async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    const condoId = isAdminRole(req.user?.role)
      ? (payload.condoId || req.user?.condoId || null)
      : (req.user?.condoId || null);

    if (!condoId) return res.status(400).json({ error: 'condoId obrigatorio' });

    const areaId = String(payload.areaId || '').trim();
    const userIdInput = String(payload.userId || '').trim();
    if (!areaId || !userIdInput || !payload.date || !payload.startTime || !payload.endTime) {
      return res.status(400).json({ error: 'areaId, userId, date, startTime e endTime sao obrigatorios' });
    }

    const date = String(payload.date || '').trim();
    if (!date) return res.status(400).json({ error: 'date invalido' });

    const userId = !isAdminRole(req.user?.role) && req.user?.role === 'morador'
      ? req.user.id
      : userIdInput;

    const [area, user] = await Promise.all([
      prisma.commonArea.findUnique({ where: { id: areaId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!area || area.condoId !== condoId) {
      return res.status(400).json({ error: 'areaId invalido para este condominio' });
    }
    if (!user || user.condoId !== condoId) {
      return res.status(400).json({ error: 'userId invalido para este condominio' });
    }

    const conflict = await checkReservationConflict({
      condoId,
      areaId,
      date,
      startTime: payload.startTime,
      endTime: payload.endTime,
    });
    if (!conflict.ok) return res.status(409).json({ error: conflict.reason });

    const startMinutes = toMinutes(payload.startTime);
    const endMinutes = toMinutes(payload.endTime);
    const durationHours = (endMinutes - startMinutes) / 60;
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      return res.status(400).json({ error: 'Horario invalido' });
    }
    if (area.maxHours && durationHours > area.maxHours) {
      return res.status(400).json({ error: `Reserva excede limite de ${area.maxHours} horas para esta area` });
    }

    const totalCost = payload.totalCost !== undefined
      ? Number(payload.totalCost || 0)
      : Number((durationHours * Number(area.pricePerHour || 0)).toFixed(2));

    const created = await prisma.reservation.create({
      data: {
        condoId,
        areaId,
        areaName: area.name,
        userId: user.id,
        userName: user.name,
        unit: payload.unit || user.unit || null,
        date,
        startTime: String(payload.startTime),
        endTime: String(payload.endTime),
        totalCost,
        status: payload.status || 'pending',
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('Erro /api/reservations POST:', error);
    return res.status(500).json({ error: 'Falha ao criar reserva' });
  }
});

router.put('/reservations/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Reserva nao encontrada' });

    if (!isAdminRole(req.user?.role) && existing.condoId !== req.user?.condoId) {
      return res.status(403).json({ error: 'Sem acesso a reserva' });
    }

    const payload = { ...(req.body || {}) };
    if (!isAdminRole(req.user?.role)) payload.condoId = req.user?.condoId;

    const nextCondoId = payload.condoId || existing.condoId;
    const nextAreaId = payload.areaId || existing.areaId;
    const nextUserId = (!isAdminRole(req.user?.role) && req.user?.role === 'morador')
      ? req.user.id
      : (payload.userId || existing.userId);
    const nextDate = payload.date !== undefined ? String(payload.date || '').trim() : existing.date;
    if (payload.date !== undefined && !nextDate) return res.status(400).json({ error: 'date invalido' });

    const nextStart = payload.startTime || existing.startTime;
    const nextEnd = payload.endTime || existing.endTime;
    const nextStatus = payload.status || existing.status;

    const [area, user] = await Promise.all([
      prisma.commonArea.findUnique({ where: { id: nextAreaId } }),
      prisma.user.findUnique({ where: { id: nextUserId } }),
    ]);

    if (!area || area.condoId !== nextCondoId) {
      return res.status(400).json({ error: 'areaId invalido para este condominio' });
    }
    if (!user || user.condoId !== nextCondoId) {
      return res.status(400).json({ error: 'userId invalido para este condominio' });
    }

    if (['pending', 'confirmed'].includes(nextStatus)) {
      const conflict = await checkReservationConflict({
        condoId: nextCondoId,
        areaId: nextAreaId,
        date: nextDate,
        startTime: nextStart,
        endTime: nextEnd,
        ignoreId: existing.id,
      });
      if (!conflict.ok) return res.status(409).json({ error: conflict.reason });

      const startMinutes = toMinutes(nextStart);
      const endMinutes = toMinutes(nextEnd);
      const durationHours = (endMinutes - startMinutes) / 60;
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        return res.status(400).json({ error: 'Horario invalido' });
      }
      if (area.maxHours && durationHours > area.maxHours) {
        return res.status(400).json({ error: `Reserva excede limite de ${area.maxHours} horas para esta area` });
      }

      if (payload.totalCost === undefined) {
        payload.totalCost = Number((durationHours * Number(area.pricePerHour || 0)).toFixed(2));
      }
    }

    payload.condoId = nextCondoId;
    payload.areaId = nextAreaId;
    payload.areaName = area.name;
    payload.userId = user.id;
    payload.userName = user.name;
    if (payload.unit === undefined) payload.unit = user.unit || existing.unit || null;
    if (payload.date !== undefined) payload.date = nextDate;

    const updated = await prisma.reservation.update({
      where: { id: existing.id },
      data: payload,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Erro /api/reservations PUT:', error);
    return res.status(500).json({ error: 'Falha ao atualizar reserva' });
  }
});

function applyModelDefaults(pathName, payload, req) {
  const next = { ...(payload || {}) };

  if (pathName === 'common-areas') {
    next.capacity = Number(next.capacity ?? 0);
    next.maxHours = Number(next.maxHours ?? 2);
    next.pricePerHour = Number(next.pricePerHour ?? 0);
    next.description = next.description ?? '';
    next.rules = next.rules ?? '';
    next.image = next.image ?? '';
    next.cancellationFinePercent = Number(next.cancellationFinePercent ?? 0);
    next.cancellationFineWindowHours = Number(next.cancellationFineWindowHours ?? 24);
  }

  if (pathName === 'deliveries') {
    next.sender = next.sender ?? '';
    next.trackingCode = next.trackingCode ?? '';
    next.description = next.description ?? '';
    next.qrToken = next.qrToken ?? '';
    next.status = next.status ?? 'received';
    next.arrivedAt = next.arrivedAt ? parseMaybeDate(next.arrivedAt) : new Date();
  }

  if (pathName === 'announcements') {
    next.authorId = next.authorId ?? req.user?.id;
    next.authorName = next.authorName ?? req.user?.name ?? 'Admin';
    next.priority = next.priority ?? 'normal';
  }

  if (pathName === 'votes') {
    next.description = next.description ?? '';
    next.options = typeof next.options === 'string' ? next.options : JSON.stringify(next.options ?? []);
    next.status = next.status ?? 'open';
  }

  if (pathName === 'market-items') {
    next.sellerName = next.sellerName ?? req.user?.name ?? '';
    next.unit = next.unit ?? '';
    next.description = next.description ?? '';
    next.status = next.status ?? 'active';
    next.price = Number(next.price ?? 0);
  }

  if (pathName === 'documents') {
    next.description = next.description ?? '';
    next.fileType = next.fileType ?? 'application/octet-stream';
    next.fileSize = String(next.fileSize ?? '0');
    next.uploadedByName = next.uploadedByName ?? req.user?.name ?? '';
    next.version = String(next.version ?? '1');
    next.tags = typeof next.tags === 'string' ? next.tags : JSON.stringify(next.tags ?? []);
  }

  if (pathName === 'maintenance-requests') {
    next.location = next.location ?? '';
    next.priority = next.priority ?? 'medium';
    next.status = next.status ?? 'open';
    next.category = next.category ?? 'geral';
    next.photos = typeof next.photos === 'string' ? next.photos : JSON.stringify(next.photos ?? []);
  }

  if (pathName === 'access-logs') {
    next.document = next.document ?? '';
    next.destination = next.destination ?? '';
    next.purpose = next.purpose ?? '';
    next.authorizedBy = next.authorizedBy ?? req.user?.name ?? '';
    next.status = next.status ?? 'entered';
    next.enteredAt = next.enteredAt ? parseMaybeDate(next.enteredAt) : new Date();
  }

  if (pathName === 'lost-found') {
    next.description = next.description ?? '';
    next.location = next.location ?? '';
    next.category = next.category ?? '';
    next.reportedBy = next.reportedBy ?? req.user?.id;
    next.reportedByName = next.reportedByName ?? req.user?.name ?? '';
    next.status = next.status ?? 'open';
  }

  if (pathName === 'employees') {
    next.cpf = next.cpf ?? '';
    next.birthDate = next.birthDate ?? '';
    next.phone = next.phone ?? '';
    next.department = next.department ?? '';
    next.admissionDate = next.admissionDate ?? '';
    next.salary = Number(next.salary ?? 0);
    next.address = next.address ?? '';
    next.document = next.document ?? '';
  }

  if (pathName === 'invoices') {
    next.description = next.description ?? '';
    next.amount = Number(next.amount ?? 0);
    next.status = next.status ?? 'pending';
    next.dueDate = next.dueDate ? parseMaybeDate(next.dueDate) : new Date();
  }

  if (pathName === 'payments') {
    next.description = next.description ?? '';
    next.amount = Number(next.amount ?? 0);
    next.status = next.status ?? 'pending';
    next.method = next.method ?? 'pix';
    next.customerName = next.customerName ?? '';
    next.customerEmail = next.customerEmail ?? '';
    next.customerCpf = next.customerCpf ?? '';
    next.gatewayProvider = next.gatewayProvider ?? 'asaas';
  }

  if (pathName === 'license-charges') {
    next.description = next.description ?? '';
    next.amount = Number(next.amount ?? 0);
    next.dueDate = next.dueDate ? parseMaybeDate(next.dueDate) : new Date();
    next.status = next.status ?? 'pending';
    next.reference = next.reference ?? '';
  }

  if (pathName === 'license-billings') {
    next.description = next.description ?? '';
    next.amount = Number(next.amount ?? 0);
    next.dueDate = next.dueDate ? parseMaybeDate(next.dueDate) : new Date();
    next.billingMonth = next.billingMonth ?? new Date().toISOString().slice(0, 7);
    next.status = next.status ?? 'pending';
  }

  return next;
}

function registerGenericCrud({ pathName, model, condoField = 'condoId', ownUserField = null, dateFields = [] }) {
  router.get(`/${pathName}`, authMiddleware, async (req, res) => {
    try {
      const where = {};

      if (ownUserField && !isAdminRole(req.user?.role)) {
        where[ownUserField] = req.user?.id;
      } else if (condoField && !isAdminRole(req.user?.role)) {
        where[condoField] = req.user?.condoId;
      } else if (condoField && isAdminRole(req.user?.role) && req.query?.condoId) {
        where[condoField] = String(req.query.condoId);
      }

      const records = await prisma[model].findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return res.json(records);
    } catch (error) {
      console.error(`Erro /api/${pathName} GET:`, error);
      return res.status(500).json({ error: `Falha ao listar ${pathName}` });
    }
  });

  router.post(`/${pathName}`, authMiddleware, async (req, res) => {
    try {
      let payload = normalizeDateFields(req.body || {}, dateFields);
      payload = applyModelDefaults(pathName, payload, req);
      if (payload.role) payload.role = String(payload.role).trim().toLowerCase();
      if (payload.password) payload.password = await bcrypt.hash(String(payload.password), 12);

      if (ownUserField && !isAdminRole(req.user?.role) && !payload[ownUserField]) {
        payload[ownUserField] = req.user?.id;
      }
      if (condoField && !isAdminRole(req.user?.role) && !payload[condoField]) {
        payload[condoField] = req.user?.condoId;
      }

      const created = await prisma[model].create({ data: payload });
      return res.status(201).json(created);
    } catch (error) {
      console.error(`Erro /api/${pathName} POST:`, error);
      return res.status(500).json({ error: `Falha ao criar em ${pathName}` });
    }
  });

  router.get(`/${pathName}/:id`, authMiddleware, async (req, res) => {
    try {
      const record = await prisma[model].findUnique({ where: { id: req.params.id } });
      if (!record) return res.status(404).json({ error: 'Registro nao encontrado' });

      if (ownUserField && !isAdminRole(req.user?.role) && record[ownUserField] !== req.user?.id) {
        return res.status(403).json({ error: 'Sem acesso' });
      }
      if (condoField && !isAdminRole(req.user?.role) && record[condoField] !== req.user?.condoId) {
        return res.status(403).json({ error: 'Sem acesso' });
      }

      return res.json(record);
    } catch (error) {
      console.error(`Erro /api/${pathName}/:id GET:`, error);
      return res.status(500).json({ error: `Falha ao buscar registro em ${pathName}` });
    }
  });

  router.put(`/${pathName}/:id`, authMiddleware, async (req, res) => {
    try {
      const existing = await prisma[model].findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Registro nao encontrado' });

      if (ownUserField && !isAdminRole(req.user?.role) && existing[ownUserField] !== req.user?.id) {
        return res.status(403).json({ error: 'Sem acesso' });
      }
      if (condoField && !isAdminRole(req.user?.role) && existing[condoField] !== req.user?.condoId) {
        return res.status(403).json({ error: 'Sem acesso' });
      }

      let payload = normalizeDateFields(req.body || {}, dateFields);
      payload = applyModelDefaults(pathName, payload, req);
      if (payload.role) payload.role = String(payload.role).trim().toLowerCase();
      if (payload.password) payload.password = await bcrypt.hash(String(payload.password), 12);
      if (condoField && !isAdminRole(req.user?.role)) payload[condoField] = req.user?.condoId;

      const updated = await prisma[model].update({ where: { id: req.params.id }, data: payload });
      return res.json(updated);
    } catch (error) {
      console.error(`Erro /api/${pathName}/:id PUT:`, error);
      return res.status(500).json({ error: `Falha ao atualizar registro em ${pathName}` });
    }
  });

  router.delete(`/${pathName}/:id`, authMiddleware, async (req, res) => {
    try {
      const existing = await prisma[model].findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Registro nao encontrado' });

      if (ownUserField && !isAdminRole(req.user?.role) && existing[ownUserField] !== req.user?.id) {
        return res.status(403).json({ error: 'Sem acesso' });
      }
      if (condoField && !isAdminRole(req.user?.role) && existing[condoField] !== req.user?.condoId) {
        return res.status(403).json({ error: 'Sem acesso' });
      }

      await prisma[model].delete({ where: { id: req.params.id } });
      return res.status(204).send();
    } catch (error) {
      console.error(`Erro /api/${pathName}/:id DELETE:`, error);
      return res.status(500).json({ error: `Falha ao remover registro em ${pathName}` });
    }
  });
}

[
  { pathName: 'deliveries', model: 'delivery', dateFields: ['arrivedAt', 'deliveredAt'] },
  { pathName: 'notifications', model: 'notification', condoField: null, ownUserField: 'userId' },
  { pathName: 'announcements', model: 'announcement' },
  { pathName: 'common-areas', model: 'commonArea' },
  { pathName: 'reservations', model: 'reservation' },
  { pathName: 'votes', model: 'vote', dateFields: ['endDate'] },
  { pathName: 'complaints', model: 'complaint' },
  { pathName: 'market-items', model: 'marketItem' },
  { pathName: 'documents', model: 'document' },
  { pathName: 'maintenance-requests', model: 'maintenanceRequest' },
  { pathName: 'access-logs', model: 'accessLog', dateFields: ['enteredAt', 'exitedAt'] },
  { pathName: 'lost-found', model: 'lostFound' },
  { pathName: 'employees', model: 'employee' },
  { pathName: 'invoices', model: 'invoice', dateFields: ['dueDate', 'paidAt'] },
  { pathName: 'payments', model: 'payment', dateFields: ['paidAt'] },
  { pathName: 'license-charges', model: 'licenseCharge', dateFields: ['dueDate', 'paidAt', 'viewedAt'] },
  { pathName: 'license-billings', model: 'licenseBilling', dateFields: ['dueDate', 'paidAt'] },
].forEach(registerGenericCrud);

export default router;
