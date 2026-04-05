import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const MASTER_ROLES = new Set(['admin', 'admin-master']);
const TICKET_STATUSES = new Set(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']);
const TICKET_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const TICKET_CATEGORIES = new Set([
  'geral',
  'acesso',
  'financeiro',
  'pagamento',
  'cadastro',
  'tecnico',
  'implantacao',
  'integracao',
  'faturamento',
  'outro'
]);

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isMasterAdmin(user) {
  return MASTER_ROLES.has(normalizeRole(user?.role));
}

function normalizeStatus(status, fallback = 'open') {
  const normalized = String(status || '').trim().toLowerCase();
  return TICKET_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizePriority(priority, fallback = 'medium') {
  const normalized = String(priority || '').trim().toLowerCase();
  return TICKET_PRIORITIES.has(normalized) ? normalized : fallback;
}

function normalizeCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return TICKET_CATEGORIES.has(normalized) ? normalized : 'geral';
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function maskProtocolDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function generateProtocol() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUP-${maskProtocolDate()}-${random}`;
}

function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    condoId: user.condoId || null,
    condoName: user.condominium?.name || null,
    unit: user.unit || null
  };
}

function formatMessage(message) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    senderId: message.senderId,
    senderRoleSnapshot: message.senderRoleSnapshot,
    senderNameSnapshot: message.senderNameSnapshot,
    message: message.message,
    isInternal: message.isInternal === true,
    attachmentUrl: message.attachmentUrl || null,
    attachmentName: message.attachmentName || null,
    attachmentMime: message.attachmentMime || null,
    attachmentSize: message.attachmentSize || null,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender ? formatUser(message.sender) : null
  };
}

async function countUnreadForRequester(ticket) {
  const where = {
    ticketId: ticket.id,
    sender: {
      is: {
        role: {
          in: Array.from(MASTER_ROLES)
        }
      }
    }
  };

  if (ticket.requesterLastReadAt) {
    where.createdAt = { gt: ticket.requesterLastReadAt };
  }

  return prisma.supportTicketMessage.count({ where });
}

async function countUnreadForAdmin(ticket) {
  const where = {
    ticketId: ticket.id,
    sender: {
      is: {
        role: {
          notIn: Array.from(MASTER_ROLES)
        }
      }
    }
  };

  if (ticket.adminLastReadAt) {
    where.createdAt = { gt: ticket.adminLastReadAt };
  }

  return prisma.supportTicketMessage.count({ where });
}

async function mapTicket(ticket) {
  const [requesterUnreadCount, adminUnreadCount] = await Promise.all([
    countUnreadForRequester(ticket),
    countUnreadForAdmin(ticket)
  ]);

  return {
    id: ticket.id,
    protocol: ticket.protocol,
    condoId: ticket.condoId || null,
    condoName: ticket.condominium?.name || null,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    source: ticket.source,
    description: ticket.description,
    requesterLastReadAt: ticket.requesterLastReadAt ? ticket.requesterLastReadAt.toISOString() : null,
    adminLastReadAt: ticket.adminLastReadAt ? ticket.adminLastReadAt.toISOString() : null,
    firstResponseAt: ticket.firstResponseAt ? ticket.firstResponseAt.toISOString() : null,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messageCount: ticket._count?.messages ?? 0,
    lastMessagePreview: ticket.messages?.[0]?.message || '',
    requesterUnreadCount,
    adminUnreadCount,
    requester: formatUser(ticket.requester),
    assignedAdmin: formatUser(ticket.assignedAdmin)
  };
}

async function ensureTicketAccess(ticketId, currentUser) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      requester: {
        include: {
          condominium: {
            select: { name: true }
          }
        }
      },
      assignedAdmin: {
        include: {
          condominium: {
            select: { name: true }
          }
        }
      },
      condominium: {
        select: { name: true }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      _count: {
        select: {
          messages: true
        }
      }
    }
  });

  if (!ticket) return null;

  if (isMasterAdmin(currentUser)) {
    return ticket;
  }

  if (ticket.requesterId !== currentUser.id) {
    return null;
  }

  return ticket;
}

router.get('/tickets', authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    const search = sanitizeText(req.query.search);
    const status = normalizeStatus(req.query.status, '');
    const priority = normalizePriority(req.query.priority, '');
    const category = req.query.category ? normalizeCategory(req.query.category) : '';
    const view = String(req.query.view || '').trim().toLowerCase();

    const where = {};

    if (!isMasterAdmin(currentUser) || view === 'mine') {
      where.requesterId = currentUser.id;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { protocol: { contains: search } },
        { subject: { contains: search } },
        { description: { contains: search } },
        { requester: { is: { name: { contains: search } } } },
        { condominium: { is: { name: { contains: search } } } }
      ];
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        requester: {
          include: {
            condominium: {
              select: { name: true }
            }
          }
        },
        assignedAdmin: {
          include: {
            condominium: {
              select: { name: true }
            }
          }
        },
        condominium: {
          select: { name: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const payload = await Promise.all(tickets.map((ticket) => mapTicket(ticket)));
    res.json({ tickets: payload });
  } catch (error) {
    console.error('Erro ao listar tickets de suporte:', error);
    res.status(500).json({ error: 'Falha ao listar tickets de suporte' });
  }
});

router.post('/tickets', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        condominium: {
          select: { name: true }
        }
      }
    });

    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para abrir ticket' });
    }

    const subject = sanitizeText(req.body?.subject);
    const message = sanitizeText(req.body?.message);
    const category = normalizeCategory(req.body?.category);
    const priority = normalizePriority(req.body?.priority);
    const attachmentUrl = sanitizeText(req.body?.attachmentUrl) || null;
    const attachmentName = sanitizeText(req.body?.attachmentName) || null;
    const attachmentMime = sanitizeText(req.body?.attachmentMime) || null;
    const attachmentSize = Number.isFinite(Number(req.body?.attachmentSize))
      ? Number(req.body.attachmentSize)
      : null;

    if (!subject || subject.length < 6) {
      return res.status(400).json({ error: 'Informe um assunto com pelo menos 6 caracteres' });
    }

    if (!message && !attachmentUrl) {
      return res.status(400).json({ error: 'Descreva o chamado ou envie um anexo' });
    }

    const protocol = generateProtocol();
    const now = new Date();
    const condoId = currentUser.condoId || null;

    const created = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          protocol,
          condoId,
          requesterId: currentUser.id,
          subject,
          category,
          priority,
          status: 'open',
          source: 'portal',
          description: message || attachmentName || 'Novo chamado com anexo',
          requesterLastReadAt: now,
          adminLastReadAt: isMasterAdmin(currentUser) ? now : null,
          lastMessageAt: now
        }
      });

      await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: currentUser.id,
          senderRoleSnapshot: currentUser.role,
          senderNameSnapshot: currentUser.name,
          message: message || attachmentName || 'Anexo enviado',
          attachmentUrl,
          attachmentName,
          attachmentMime,
          attachmentSize
        }
      });

      return tx.supportTicket.findUnique({
        where: { id: ticket.id },
        include: {
          requester: {
            include: {
              condominium: {
                select: { name: true }
              }
            }
          },
          assignedAdmin: {
            include: {
              condominium: {
                select: { name: true }
              }
            }
          },
          condominium: {
            select: { name: true }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      });
    });

    const payload = await mapTicket(created);
    res.status(201).json({ ticket: payload });
  } catch (error) {
    console.error('Erro ao criar ticket de suporte:', error);
    res.status(500).json({ error: 'Falha ao criar ticket de suporte' });
  }
});

router.get('/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const ticket = await ensureTicketAccess(req.params.id, req.user);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket nao encontrado ou sem permissao' });
    }

    const messageWhere = isMasterAdmin(req.user)
      ? { ticketId: ticket.id }
      : { ticketId: ticket.id, isInternal: false };

    const messages = await prisma.supportTicketMessage.findMany({
      where: messageWhere,
      include: {
        sender: {
          include: {
            condominium: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const payload = await mapTicket(ticket);
    res.json({
      ticket: payload,
      messages: messages.map((message) => formatMessage(message))
    });
  } catch (error) {
    console.error('Erro ao obter ticket de suporte:', error);
    res.status(500).json({ error: 'Falha ao obter ticket de suporte' });
  }
});

router.post('/tickets/:id/read', authMiddleware, async (req, res) => {
  try {
    const ticket = await ensureTicketAccess(req.params.id, req.user);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket nao encontrado ou sem permissao' });
    }

    const now = new Date();
    const data = isMasterAdmin(req.user)
      ? { adminLastReadAt: now }
      : { requesterLastReadAt: now };

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data
    });

    res.json({
      success: true,
      ticketId: ticket.id,
      readAt: now.toISOString()
    });
  } catch (error) {
    console.error('Erro ao marcar ticket como lido:', error);
    res.status(500).json({ error: 'Falha ao atualizar leitura do ticket' });
  }
});

router.post('/tickets/:id/messages', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!currentUser || currentUser.active === false) {
      return res.status(401).json({ error: 'Usuario invalido para responder ticket' });
    }

    const ticket = await ensureTicketAccess(req.params.id, req.user);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket nao encontrado ou sem permissao' });
    }

    const message = sanitizeText(req.body?.message);
    const isInternal = Boolean(req.body?.isInternal) && isMasterAdmin(req.user);
    const attachmentUrl = sanitizeText(req.body?.attachmentUrl) || null;
    const attachmentName = sanitizeText(req.body?.attachmentName) || null;
    const attachmentMime = sanitizeText(req.body?.attachmentMime) || null;
    const attachmentSize = Number.isFinite(Number(req.body?.attachmentSize))
      ? Number(req.body.attachmentSize)
      : null;

    if (!message && !attachmentUrl) {
      return res.status(400).json({ error: 'Mensagem vazia. Escreva um texto ou envie um anexo.' });
    }

    if (ticket.status === 'closed' && !isMasterAdmin(req.user)) {
      return res.status(400).json({ error: 'Este ticket foi encerrado e nao aceita novas respostas do solicitante.' });
    }

    const senderIsMaster = isMasterAdmin(req.user);
    const now = new Date();
    const nextStatus = senderIsMaster
      ? ticket.status === 'resolved' || ticket.status === 'closed'
        ? 'in_progress'
        : 'in_progress'
      : 'open';

    const created = await prisma.$transaction(async (tx) => {
      const messageEntity = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: currentUser.id,
          senderRoleSnapshot: currentUser.role,
          senderNameSnapshot: currentUser.name,
          message: message || attachmentName || 'Anexo enviado',
          isInternal,
          attachmentUrl,
          attachmentName,
          attachmentMime,
          attachmentSize
        },
        include: {
          sender: {
            include: {
              condominium: {
                select: { name: true }
              }
            }
          }
        }
      });

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: isInternal ? ticket.status : nextStatus,
          assignedAdminId: senderIsMaster ? currentUser.id : ticket.assignedAdminId,
          lastMessageAt: now,
          firstResponseAt: senderIsMaster && !ticket.firstResponseAt ? now : ticket.firstResponseAt,
          resolvedAt: senderIsMaster && nextStatus === 'resolved' ? now : null,
          closedAt: senderIsMaster && nextStatus === 'closed' ? now : null,
          requesterLastReadAt: senderIsMaster ? ticket.requesterLastReadAt : now,
          adminLastReadAt: senderIsMaster ? now : ticket.adminLastReadAt
        }
      });

      return messageEntity;
    });

    res.status(201).json({ message: formatMessage(created) });
  } catch (error) {
    console.error('Erro ao responder ticket de suporte:', error);
    res.status(500).json({ error: 'Falha ao responder ticket de suporte' });
  }
});

router.patch('/tickets/:id/status', express.json(), authMiddleware, async (req, res) => {
  try {
    if (!isMasterAdmin(req.user)) {
      return res.status(403).json({ error: 'Somente o Admin Master pode gerenciar o status dos tickets' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!currentUser) {
      return res.status(401).json({ error: 'Usuario invalido para atualizar ticket' });
    }

    const ticket = await ensureTicketAccess(req.params.id, req.user);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket nao encontrado' });
    }

    const status = normalizeStatus(req.body?.status);
    const note = sanitizeText(req.body?.note);
    const now = new Date();
    const updates = {
      status,
      assignedAdminId: ticket.assignedAdminId || currentUser.id,
      lastMessageAt: now,
      resolvedAt: status === 'resolved' ? now : null,
      closedAt: status === 'closed' ? now : null,
      adminLastReadAt: now
    };

    await prisma.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: updates
      });

      await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: currentUser.id,
          senderRoleSnapshot: currentUser.role,
          senderNameSnapshot: currentUser.name,
          message: note || `Status atualizado para ${status}.`,
          isInternal: true
        }
      });
    });

    const updated = await ensureTicketAccess(ticket.id, req.user);
    const payload = await mapTicket(updated);
    res.json({ ticket: payload });
  } catch (error) {
    console.error('Erro ao atualizar status do ticket:', error);
    res.status(500).json({ error: 'Falha ao atualizar status do ticket' });
  }
});

router.patch('/tickets/:id/assign', express.json(), authMiddleware, async (req, res) => {
  try {
    if (!isMasterAdmin(req.user)) {
      return res.status(403).json({ error: 'Somente o Admin Master pode assumir tickets' });
    }

    const ticket = await ensureTicketAccess(req.params.id, req.user);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket nao encontrado' });
    }

    const requestedAdminId = sanitizeText(req.body?.assignedAdminId) || req.user.id;
    const admin = await prisma.user.findUnique({
      where: { id: requestedAdminId }
    });

    if (!admin || !isMasterAdmin(admin)) {
      return res.status(400).json({ error: 'Usuario selecionado nao pode gerenciar tickets de suporte' });
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        assignedAdminId: admin.id,
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
        adminLastReadAt: new Date()
      }
    });

    const updated = await ensureTicketAccess(ticket.id, req.user);
    const payload = await mapTicket(updated);
    res.json({ ticket: payload });
  } catch (error) {
    console.error('Erro ao atribuir ticket:', error);
    res.status(500).json({ error: 'Falha ao atribuir ticket de suporte' });
  }
});

export default router;
