import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const MASTER_ROLES = new Set([]);
const MANAGER_ROLES = new Set(['sindico']);
const VOTER_ROLES = new Set(['morador']);
const ASSEMBLY_STATUSES = new Set(['draft', 'open', 'closed']);
const AGENDA_ITEM_STATUSES = new Set(['open', 'closed']);
const QUORUM_TYPES = new Set(['simple', 'two_thirds', 'unanimity']);
const VOTE_CHOICES = new Set(['yes', 'no', 'abstain']);
const UNIT_FALLBACK_PREFIX = 'USER:';
const ASSEMBLY_NOTIFICATION_TYPE = 'announcement';

const ASSEMBLY_INCLUDE = {
  condominium: {
    select: { name: true }
  },
  creator: {
    select: { id: true, name: true, role: true }
  },
  agendaItems: {
    include: {
      votes: {
        select: {
          id: true,
          userId: true,
          choice: true,
          weight: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              unit: true
            }
          }
        }
      }
    }
  }
};

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isMasterAdmin(user) {
  return MASTER_ROLES.has(normalizeRole(user?.role));
}

function canManageAssemblies(user) {
  return MANAGER_ROLES.has(normalizeRole(user?.role));
}

function canVoteInAssembly(user) {
  return VOTER_ROLES.has(normalizeRole(user?.role));
}

function normalizeText(value, maxLength = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, maxLength);
}

function normalizeUnit(value) {
  return normalizeText(value, 120).toUpperCase();
}

function votingKeyFromUser(user) {
  const normalizedUnit = normalizeUnit(user?.unit);
  if (normalizedUnit) return `UNIT:${normalizedUnit}`;
  const fallbackId = normalizeText(user?.id, 120);
  return `${UNIT_FALLBACK_PREFIX}${fallbackId || 'ANON'}`;
}

function votingKeyFromVote(vote) {
  const normalizedUnit = normalizeUnit(vote?.user?.unit);
  if (normalizedUnit) return `UNIT:${normalizedUnit}`;
  const fallbackId = normalizeText(vote?.userId, 120);
  return `${UNIT_FALLBACK_PREFIX}${fallbackId || 'ANON'}`;
}

function dedupeVotesByUnit(votes) {
  const latestByKey = new Map();
  for (const vote of Array.isArray(votes) ? votes : []) {
    const key = votingKeyFromVote(vote);
    const current = latestByKey.get(key);
    if (!current) {
      latestByKey.set(key, vote);
      continue;
    }
    const currentUpdatedAt = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
    const incomingUpdatedAt = vote?.updatedAt ? new Date(vote.updatedAt).getTime() : 0;
    if (incomingUpdatedAt >= currentUpdatedAt) {
      latestByKey.set(key, vote);
    }
  }
  return Array.from(latestByKey.values());
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTimePtBr(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeAssemblyStatus(value, fallback = 'open') {
  const normalized = String(value || '').trim().toLowerCase();
  return ASSEMBLY_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeAgendaStatus(value, fallback = 'open') {
  const normalized = String(value || '').trim().toLowerCase();
  return AGENDA_ITEM_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeQuorumType(value, fallback = 'simple') {
  const normalized = String(value || '').trim().toLowerCase();
  return QUORUM_TYPES.has(normalized) ? normalized : fallback;
}

function normalizeVoteChoice(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VOTE_CHOICES.has(normalized) ? normalized : null;
}

function evaluateItemOutcome(quorumType, counts, eligibleVoters) {
  const yes = counts.yes || 0;
  const no = counts.no || 0;
  const abstain = counts.abstain || 0;
  const totalVotes = yes + no + abstain;
  const validBase = Math.max(eligibleVoters, 0);
  const denominator = validBase > 0 ? validBase : 1;
  const participationPercent = Math.round((totalVotes / denominator) * 10000) / 100;
  const approvalPercent = Math.round((yes / denominator) * 10000) / 100;

  let approved = false;
  if (quorumType === 'simple') {
    approved = yes > no && (yes + no) > 0;
  } else if (quorumType === 'two_thirds') {
    approved = validBase > 0 && (yes / validBase) >= (2 / 3);
  } else if (quorumType === 'unanimity') {
    approved = validBase > 0 && yes === validBase;
  }

  return {
    approved,
    eligibleVoters: validBase,
    totalVotes,
    yes,
    no,
    abstain,
    participationPercent,
    approvalPercent
  };
}

async function getCurrentUser(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      condominium: {
        select: { id: true, name: true }
      }
    }
  });
}

async function notifyCondoResidentsAssemblyOpened(tx, {
  condoId,
  assemblyTitle,
  assemblyEndsAt,
  managerName
}) {
  if (!condoId) return 0;

  const residents = await tx.user.findMany({
    where: {
      condoId,
      active: true,
      role: {
        in: Array.from(VOTER_ROLES)
      }
    },
    select: {
      id: true
    }
  });

  if (residents.length === 0) return 0;

  const safeTitle = normalizeText(assemblyTitle, 120) || 'Nova assembleia';
  const endsAtText = formatDateTimePtBr(assemblyEndsAt);
  const openedBy = normalizeText(managerName, 120) || 'sindico';
  const notificationTitle = `Assembleia aberta: ${safeTitle}`;
  const notificationMessage = `O sindico ${openedBy} abriu uma assembleia virtual. Vote ate ${endsAtText}.`;

  await tx.notification.createMany({
    data: residents.map((resident) => ({
      userId: resident.id,
      title: notificationTitle,
      message: notificationMessage,
      type: ASSEMBLY_NOTIFICATION_TYPE,
      read: false
    }))
  });

  return residents.length;
}

async function autoCloseExpiredAssemblies() {
  const now = new Date();
  const expiredAssemblies = await prisma.assembly.findMany({
    where: {
      status: 'open',
      endsAt: { lt: now }
    },
    select: { id: true }
  });

  if (expiredAssemblies.length === 0) return 0;
  const assemblyIds = expiredAssemblies.map((assembly) => assembly.id);

  await prisma.$transaction([
    prisma.assembly.updateMany({
      where: { id: { in: assemblyIds } },
      data: { status: 'closed', updatedAt: now }
    }),
    prisma.assemblyAgendaItem.updateMany({
      where: {
        assemblyId: { in: assemblyIds },
        status: 'open'
      },
      data: { status: 'closed' }
    })
  ]);

  return assemblyIds.length;
}

function ensureAssemblyAccess(user, assembly) {
  if (!user || !assembly) return false;
  if (isMasterAdmin(user)) return true;
  if (!user.condoId) return false;
  return user.condoId === assembly.condoId;
}

async function getEligibleVotingUnitsByCondo(condoId, cache) {
  if (!condoId) return 0;
  if (cache.has(condoId)) {
    return cache.get(condoId);
  }

  const voters = await prisma.user.findMany({
    where: {
      condoId,
      active: true,
      role: {
        in: Array.from(VOTER_ROLES)
      }
    },
    select: {
      id: true,
      unit: true
    }
  });

  const eligibleUnitKeys = new Set(voters.map((user) => votingKeyFromUser(user)));
  const count = eligibleUnitKeys.size;
  cache.set(condoId, count);
  return count;
}

async function mapAssembly(assembly, currentUser, eligibleByCondoCache = new Map()) {
  const eligibleVoters = await getEligibleVotingUnitsByCondo(assembly.condoId, eligibleByCondoCache);
  const currentUserVotingKey = votingKeyFromUser(currentUser);
  const now = new Date();
  const startsAt = new Date(assembly.startsAt);
  const endsAt = new Date(assembly.endsAt);
  const votingWindowOpen = assembly.status === 'open' && now >= startsAt && now <= endsAt;
  const expired = now > endsAt;

  const items = [...(assembly.agendaItems || [])]
    .sort((a, b) => (a.itemOrder || 0) - (b.itemOrder || 0))
    .map((item) => {
      const voteCounts = { yes: 0, no: 0, abstain: 0 };
      const uniqueVotes = dedupeVotesByUnit(item.votes);
      uniqueVotes.forEach((vote) => {
        if (vote.choice === 'yes' || vote.choice === 'no' || vote.choice === 'abstain') {
          voteCounts[vote.choice] += Number(vote.weight) || 0;
        }
      });

      const stats = evaluateItemOutcome(item.quorumType, voteCounts, eligibleVoters);
      const myVote = uniqueVotes.find((vote) => vote.userId === currentUser?.id);
      const unitVoteByOther = uniqueVotes.find((vote) =>
        votingKeyFromVote(vote) === currentUserVotingKey && vote.userId !== currentUser?.id
      );

      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        itemOrder: item.itemOrder,
        quorumType: item.quorumType,
        status: item.status,
        myVote: myVote?.choice || null,
        unitVoteLocked: Boolean(unitVoteByOther),
        unitVoteBy: unitVoteByOther
          ? {
              userId: unitVoteByOther.userId,
              name: unitVoteByOther.user?.name || 'Morador da unidade',
              unit: unitVoteByOther.user?.unit || null,
              choice: unitVoteByOther.choice,
              votedAt: unitVoteByOther.updatedAt ? new Date(unitVoteByOther.updatedAt).toISOString() : null
            }
          : null,
        stats
      };
    });

  const totals = items.reduce((acc, item) => {
    acc.totalVotes += item.stats.totalVotes;
    acc.approved += item.stats.approved ? 1 : 0;
    return acc;
  }, { totalVotes: 0, approved: 0 });

  return {
    id: assembly.id,
    condoId: assembly.condoId,
    condoName: assembly.condominium?.name || null,
    title: assembly.title,
    description: assembly.description || '',
    status: assembly.status,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: assembly.createdAt.toISOString(),
    updatedAt: assembly.updatedAt.toISOString(),
    votingWindowOpen,
    expired,
    itemCount: items.length,
    approvedItems: totals.approved,
    totalVotes: totals.totalVotes,
    creator: assembly.creator
      ? {
          id: assembly.creator.id,
          name: assembly.creator.name,
          role: assembly.creator.role
        }
      : null,
    items
  };
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para listar assembleias' });
    }
    if (!canManageAssemblies(currentUser) && !canVoteInAssembly(currentUser)) {
      return res.status(403).json({ error: 'Seu perfil nao participa de assembleias' });
    }

    await autoCloseExpiredAssemblies();

    const status = req.query.status ? normalizeAssemblyStatus(req.query.status, '') : '';
    const condoIdQuery = normalizeText(req.query.condoId, 100);

    const where = {};
    if (status) where.status = status;

    if (isMasterAdmin(currentUser)) {
      if (condoIdQuery) where.condoId = condoIdQuery;
    } else if (currentUser.condoId) {
      where.condoId = currentUser.condoId;
    } else {
      return res.json({ assemblies: [] });
    }

    const assemblies = await prisma.assembly.findMany({
      where,
      include: ASSEMBLY_INCLUDE,
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    const eligibleByCondoCache = new Map();
    const payload = await Promise.all(
      assemblies.map((assembly) => mapAssembly(assembly, currentUser, eligibleByCondoCache))
    );

    return res.json({ assemblies: payload });
  } catch (error) {
    console.error('Erro ao listar assembleias:', error);
    return res.status(500).json({ error: 'Falha ao listar assembleias' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para consultar assembleia' });
    }
    if (!canManageAssemblies(currentUser) && !canVoteInAssembly(currentUser)) {
      return res.status(403).json({ error: 'Seu perfil nao participa de assembleias' });
    }

    await autoCloseExpiredAssemblies();

    const assembly = await prisma.assembly.findUnique({
      where: { id: req.params.id },
      include: ASSEMBLY_INCLUDE
    });

    if (!assembly) {
      return res.status(404).json({ error: 'Assembleia nao encontrada' });
    }

    if (!ensureAssemblyAccess(currentUser, assembly)) {
      return res.status(403).json({ error: 'Sem permissao para acessar esta assembleia' });
    }

    const payload = await mapAssembly(assembly, currentUser, new Map());
    return res.json({ assembly: payload });
  } catch (error) {
    console.error('Erro ao buscar assembleia:', error);
    return res.status(500).json({ error: 'Falha ao buscar assembleia' });
  }
});

router.get('/:id/minutes', authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para gerar ata' });
    }
    if (!canManageAssemblies(currentUser) && !canVoteInAssembly(currentUser)) {
      return res.status(403).json({ error: 'Seu perfil nao participa de assembleias' });
    }

    await autoCloseExpiredAssemblies();

    const assembly = await prisma.assembly.findUnique({
      where: { id: req.params.id },
      include: ASSEMBLY_INCLUDE
    });

    if (!assembly) {
      return res.status(404).json({ error: 'Assembleia nao encontrada' });
    }
    if (!ensureAssemblyAccess(currentUser, assembly)) {
      return res.status(403).json({ error: 'Sem permissao para acessar esta assembleia' });
    }

    const payload = await mapAssembly(assembly, currentUser, new Map());
    const generatedAt = new Date();
    const lines = [
      'ATA RESUMIDA - ASSEMBLEIA VIRTUAL',
      `Assembleia: ${payload.title}`,
      `Condominio: ${payload.condoName || '-'}`,
      `Status: ${payload.status}`,
      `Inicio: ${new Date(payload.startsAt).toLocaleString('pt-BR')}`,
      `Fim: ${new Date(payload.endsAt).toLocaleString('pt-BR')}`,
      `Gerada em: ${generatedAt.toLocaleString('pt-BR')}`,
      '',
      'PAUTAS E RESULTADOS'
    ];

    payload.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.title}`,
        `   Quorum: ${item.quorumType}`,
        `   Resultado: ${item.stats.approved ? 'APROVADO' : 'NAO APROVADO'}`,
        `   Votos => Sim: ${item.stats.yes} | Nao: ${item.stats.no} | Abstencao: ${item.stats.abstain}`,
        `   Participacao: ${item.stats.participationPercent}% (${item.stats.totalVotes}/${item.stats.eligibleVoters})`,
        ''
      );
    });

    return res.json({
      assemblyId: payload.id,
      generatedAt: generatedAt.toISOString(),
      minutesText: lines.join('\n'),
      summary: {
        itemCount: payload.itemCount,
        approvedItems: payload.approvedItems,
        totalVotes: payload.totalVotes
      }
    });
  } catch (error) {
    console.error('Erro ao gerar ata da assembleia:', error);
    return res.status(500).json({ error: 'Falha ao gerar ata da assembleia' });
  }
});

router.post('/', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para criar assembleia' });
    }

    if (!canManageAssemblies(currentUser)) {
      return res.status(403).json({ error: 'Somente sindico pode criar assembleias' });
    }

    const title = normalizeText(req.body?.title, 180);
    const description = normalizeText(req.body?.description, 6000);
    const startsAt = parseDate(req.body?.startsAt) || new Date();
    const endsAt = parseDate(req.body?.endsAt);
    const requestedCondoId = normalizeText(req.body?.condoId, 120);
    const requestedStatus = normalizeAssemblyStatus(req.body?.status, 'open');

    if (!title || title.length < 6) {
      return res.status(400).json({ error: 'Informe um titulo com pelo menos 6 caracteres' });
    }
    if (!['draft', 'open'].includes(requestedStatus)) {
      return res.status(400).json({ error: 'Status invalido para criacao. Use draft ou open.' });
    }

    if (!endsAt || endsAt <= startsAt) {
      return res.status(400).json({ error: 'A data final deve ser maior que a data inicial' });
    }

    const rawItems = Array.isArray(req.body?.agendaItems) ? req.body.agendaItems : [];
    const agendaItems = rawItems
      .map((item, index) => ({
        title: normalizeText(item?.title, 220),
        description: normalizeText(item?.description, 4000),
        quorumType: normalizeQuorumType(item?.quorumType, 'simple'),
        itemOrder: Number.isFinite(Number(item?.itemOrder)) ? Number(item.itemOrder) : index
      }))
      .filter((item) => item.title.length >= 3);

    if (agendaItems.length === 0) {
      return res.status(400).json({ error: 'Adicione ao menos um item de pauta valido' });
    }

    let condoId = currentUser.condoId || null;
    if (isMasterAdmin(currentUser)) {
      condoId = requestedCondoId || condoId;
    }
    if (!condoId) {
      return res.status(400).json({ error: 'Condominio nao definido para criar assembleia' });
    }

    if (!isMasterAdmin(currentUser) && requestedCondoId && requestedCondoId !== currentUser.condoId) {
      return res.status(403).json({ error: 'Sem permissao para criar assembleia fora do seu condominio' });
    }

    let notifiedResidents = 0;
    const created = await prisma.$transaction(async (tx) => {
      const assembly = await tx.assembly.create({
        data: {
          condoId,
          createdById: currentUser.id,
          title,
          description: description || null,
          status: requestedStatus,
          startsAt,
          endsAt
        }
      });

      await tx.assemblyAgendaItem.createMany({
        data: agendaItems.map((item, index) => ({
          assemblyId: assembly.id,
          title: item.title,
          description: item.description || null,
          quorumType: item.quorumType,
          itemOrder: Number.isFinite(item.itemOrder) ? item.itemOrder : index,
          status: 'open'
        }))
      });

      if (requestedStatus === 'open') {
        notifiedResidents = await notifyCondoResidentsAssemblyOpened(tx, {
          condoId,
          assemblyTitle: title,
          assemblyEndsAt: endsAt,
          managerName: currentUser.name
        });
      }

      return tx.assembly.findUnique({
        where: { id: assembly.id },
        include: ASSEMBLY_INCLUDE
      });
    });

    const payload = await mapAssembly(created, currentUser, new Map());
    return res.status(201).json({ assembly: payload, notifiedResidents });
  } catch (error) {
    console.error('Erro ao criar assembleia:', error);
    return res.status(500).json({ error: 'Falha ao criar assembleia' });
  }
});

router.patch('/:id/status', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para atualizar assembleia' });
    }

    await autoCloseExpiredAssemblies();

    const status = normalizeAssemblyStatus(req.body?.status, '');
    if (!status || status === 'draft') {
      return res.status(400).json({ error: 'Status invalido. Use open ou closed.' });
    }

    const assembly = await prisma.assembly.findUnique({
      where: { id: req.params.id }
    });
    if (!assembly) {
      return res.status(404).json({ error: 'Assembleia nao encontrada' });
    }

    const canManage = canManageAssemblies(currentUser)
      && (isMasterAdmin(currentUser) || currentUser.condoId === assembly.condoId);
    if (!canManage) {
      return res.status(403).json({ error: 'Sem permissao para alterar status desta assembleia' });
    }

    let notifiedResidents = 0;
    await prisma.$transaction(async (tx) => {
      await tx.assembly.update({
        where: { id: assembly.id },
        data: { status }
      });

      if (status === 'closed') {
        await tx.assemblyAgendaItem.updateMany({
          where: { assemblyId: assembly.id },
          data: { status: 'closed' }
        });
      }
      if (status === 'open') {
        await tx.assemblyAgendaItem.updateMany({
          where: { assemblyId: assembly.id, status: 'closed' },
          data: { status: 'open' }
        });
        if (assembly.status !== 'open') {
          notifiedResidents = await notifyCondoResidentsAssemblyOpened(tx, {
            condoId: assembly.condoId,
            assemblyTitle: assembly.title,
            assemblyEndsAt: assembly.endsAt,
            managerName: currentUser.name
          });
        }
      }
    });

    const updated = await prisma.assembly.findUnique({
      where: { id: assembly.id },
      include: ASSEMBLY_INCLUDE
    });

    const payload = await mapAssembly(updated, currentUser, new Map());
    return res.json({ assembly: payload, notifiedResidents });
  } catch (error) {
    console.error('Erro ao atualizar status da assembleia:', error);
    return res.status(500).json({ error: 'Falha ao atualizar status da assembleia' });
  }
});

router.patch('/:id/items/:itemId/status', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para atualizar item' });
    }

    const status = normalizeAgendaStatus(req.body?.status, '');
    if (!status) {
      return res.status(400).json({ error: 'Status do item invalido. Use open ou closed.' });
    }

    const item = await prisma.assemblyAgendaItem.findUnique({
      where: { id: req.params.itemId },
      include: {
        assembly: true,
        votes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                unit: true
              }
            }
          }
        }
      }
    });
    if (!item || item.assemblyId !== req.params.id) {
      return res.status(404).json({ error: 'Item de pauta nao encontrado' });
    }

    const canManage = canManageAssemblies(currentUser)
      && (isMasterAdmin(currentUser) || currentUser.condoId === item.assembly.condoId);
    if (!canManage) {
      return res.status(403).json({ error: 'Sem permissao para alterar item desta assembleia' });
    }

    await prisma.assemblyAgendaItem.update({
      where: { id: item.id },
      data: { status }
    });

    return res.json({ success: true, itemId: item.id, status });
  } catch (error) {
    console.error('Erro ao atualizar status do item:', error);
    return res.status(500).json({ error: 'Falha ao atualizar item da assembleia' });
  }
});

router.post('/:id/items/:itemId/vote', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req.user?.id);
    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para votar' });
    }

    if (!canVoteInAssembly(currentUser)) {
      return res.status(403).json({ error: 'Seu perfil nao possui permissao para votar em assembleias' });
    }

    await autoCloseExpiredAssemblies();

    const choice = normalizeVoteChoice(req.body?.choice);
    if (!choice) {
      return res.status(400).json({ error: 'Voto invalido. Use yes, no ou abstain.' });
    }

    const item = await prisma.assemblyAgendaItem.findUnique({
      where: { id: req.params.itemId },
      include: {
        assembly: true
      }
    });

    if (!item || item.assemblyId !== req.params.id) {
      return res.status(404).json({ error: 'Item de pauta nao encontrado para votacao' });
    }

    if (!ensureAssemblyAccess(currentUser, item.assembly)) {
      return res.status(403).json({ error: 'Sem permissao para votar nesta assembleia' });
    }

    const now = new Date();
    if (item.assembly.status !== 'open') {
      return res.status(400).json({ error: 'Assembleia fechada para votacao' });
    }
    if (now < item.assembly.startsAt) {
      return res.status(400).json({ error: 'A votacao desta assembleia ainda nao iniciou' });
    }
    if (now > item.assembly.endsAt) {
      return res.status(400).json({ error: 'Prazo de votacao encerrado para esta assembleia' });
    }
    if (item.status !== 'open') {
      return res.status(400).json({ error: 'Este item de pauta esta fechado para votacao' });
    }

    const currentVotingKey = votingKeyFromUser(currentUser);
    const conflictVote = dedupeVotesByUnit(item.votes || []).find((vote) =>
      votingKeyFromVote(vote) === currentVotingKey && vote.userId !== currentUser.id
    );
    if (conflictVote) {
      return res.status(409).json({
        error: `A unidade ${currentUser.unit || '-'} ja possui voto registrado por ${conflictVote.user?.name || 'outro morador'}.`
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.assemblyVote.upsert({
        where: {
          itemId_userId: {
            itemId: item.id,
            userId: currentUser.id
          }
        },
        create: {
          assemblyId: item.assemblyId,
          itemId: item.id,
          userId: currentUser.id,
          choice,
          weight: 1
        },
        update: {
          choice,
          weight: 1
        }
      });

      await tx.assembly.update({
        where: { id: item.assemblyId },
        data: { updatedAt: now }
      });
    });

    const assembly = await prisma.assembly.findUnique({
      where: { id: item.assemblyId },
      include: ASSEMBLY_INCLUDE
    });

    const payload = await mapAssembly(assembly, currentUser, new Map());
    return res.json({
      success: true,
      choice,
      assembly: payload
    });
  } catch (error) {
    console.error('Erro ao registrar voto da assembleia:', error);
    return res.status(500).json({ error: 'Falha ao registrar voto da assembleia' });
  }
});

export default router;
