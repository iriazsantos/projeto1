import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'inovatech-connect-secret-2024-superseguro';

const MASTER_ROLES = new Set(['admin', 'admin-master']);
const CHAT_MESSAGE_TYPES = new Set(['text', 'image', 'file', 'system']);
const sseClients = new Map();

function isMasterAdmin(user) {
  return MASTER_ROLES.has(String(user?.role || '').toLowerCase());
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canUsersChat(sourceUser, targetUser) {
  if (!sourceUser || !targetUser) return false;
  if (!sourceUser.active || !targetUser.active) return false;

  const sourceRole = normalizeRole(sourceUser.role);
  const targetRole = normalizeRole(targetUser.role);

  if (MASTER_ROLES.has(sourceRole) || MASTER_ROLES.has(targetRole)) return true;
  if (!sourceUser.condoId || !targetUser.condoId) return false;
  return sourceUser.condoId === targetUser.condoId;
}

function userDisplayLabel(user) {
  const role = normalizeRole(user.role);
  if (role === 'porteiro') return 'Portaria';
  if (role === 'admin' || role === 'admin-master') return 'Admin';
  if (user.unit && String(user.unit).trim()) return String(user.unit).trim();
  return String(user.name || 'Usuario');
}

function isUserOnline(userId) {
  const clients = sseClients.get(userId);
  return Boolean(clients && clients.size > 0);
}

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    condoId: user.condoId || null,
    condoName: user.condominium?.name || null,
    unit: user.unit || null,
    displayLabel: userDisplayLabel(user),
    chatEnabled: user.chatEnabled !== false,
    lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
    online: isUserOnline(user.id)
  };
}

function formatMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    fileUrl: message.fileUrl || null,
    fileName: message.fileName || null,
    fileMime: message.fileMime || null,
    fileSize: message.fileSize || null,
    deleted: message.deleted === true,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender ? formatUser(message.sender) : null
  };
}

function writeEvent(res, event, payload) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (error) {
    // Connection errors are handled by close listeners.
  }
}

function addClient(userId, res) {
  const key = String(userId);
  const set = sseClients.get(key) || new Set();
  set.add(res);
  sseClients.set(key, set);
}

function removeClient(userId, res) {
  const key = String(userId);
  const set = sseClients.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    sseClients.delete(key);
  }
}

function emitToUser(userId, event, payload) {
  const set = sseClients.get(String(userId));
  if (!set || set.size === 0) return;
  set.forEach((res) => writeEvent(res, event, payload));
}

function emitToUsers(userIds, event, payload) {
  const sent = new Set();
  userIds.forEach((id) => {
    const key = String(id);
    if (sent.has(key)) return;
    sent.add(key);
    emitToUser(key, event, payload);
  });
}

function getTokenFromRequest(req) {
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
}

function streamAuthMiddleware(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Token de acesso requerido para o stream' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido para o stream' });
  }
}

async function getAudienceUserIds(sourceUser) {
  if (!sourceUser) return [];
  const where = {
    active: true
  };

  if (!isMasterAdmin(sourceUser)) {
    where.OR = [
      { condoId: sourceUser.condoId || null },
      { role: 'admin' },
      { role: 'admin-master' }
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true }
  });

  return users.map((user) => user.id);
}

async function publishPresenceUpdate(userId, online) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      condominium: {
        select: { name: true }
      }
    }
  });

  if (!user) return;
  const audience = await getAudienceUserIds(user);
  const payload = {
    type: 'presence:update',
    user: {
      ...formatUser(user),
      online
    }
  };
  emitToUsers(audience, 'chat', payload);
}

async function setPresence(userId, online) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: new Date()
    }
  });

  await publishPresenceUpdate(userId, online);
}

async function ensureConversationAccess(conversationId, userId) {
  const participant = await prisma.chatParticipant.findFirst({
    where: {
      conversationId,
      userId
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                include: {
                  condominium: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!participant) return null;
  return participant.conversation;
}

async function mapConversation(conversation, currentUserId) {
  const me = conversation.participants.find((participant) => participant.userId === currentUserId);

  const unreadWhere = {
    conversationId: conversation.id,
    senderId: { not: currentUserId },
    deleted: false
  };
  if (me?.lastReadAt) {
    unreadWhere.createdAt = { gt: me.lastReadAt };
  }

  const unreadCount = await prisma.chatMessage.count({ where: unreadWhere });
  const lastMessageEntity = await prisma.chatMessage.findFirst({
    where: { conversationId: conversation.id },
    include: {
      sender: {
        include: {
          condominium: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const directPartner = conversation.type === 'direct'
    ? conversation.participants.find((participant) => participant.userId !== currentUserId)
    : null;

  return {
    id: conversation.id,
    condoId: conversation.condoId,
    type: conversation.type,
    name: conversation.name || null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    unreadCount,
    participants: conversation.participants.map((participant) => formatUser(participant.user)),
    directPartner: directPartner ? formatUser(directPartner.user) : null,
    canSend: true,
    lastMessage: lastMessageEntity ? formatMessage(lastMessageEntity) : null
  };
}

router.get('/stream', streamAuthMiddleware, async (req, res) => {
  const userId = req.user.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuario invalido no stream' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addClient(userId, res);
  await setPresence(userId, true);

  writeEvent(res, 'chat', { type: 'stream:ready', userId, timestamp: new Date().toISOString() });

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  req.on('close', async () => {
    clearInterval(keepAlive);
    removeClient(userId, res);
    if (!isUserOnline(userId)) {
      try {
        await setPresence(userId, false);
      } catch (error) {
        // Ignore close race conditions.
      }
    }
  });
});

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const includeDisabled = req.query.includeDisabled === '1' && isMasterAdmin(req.user);
    const baseWhere = {
      active: true,
      id: { not: currentUserId }
    };

    if (!includeDisabled) {
      baseWhere.chatEnabled = true;
    }

    if (!isMasterAdmin(req.user)) {
      baseWhere.OR = [
        { condoId: req.user.condoId || null },
        { role: 'admin' },
        { role: 'admin-master' }
      ];
    }

    const users = await prisma.user.findMany({
      where: baseWhere,
      include: {
        condominium: {
          select: { name: true }
        }
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ users: users.map((user) => formatUser(user)) });
  } catch (error) {
    console.error('Erro ao listar usuarios do chat:', error);
    res.status(500).json({ error: 'Falha ao listar usuarios do chat' });
  }
});

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const conversations = await prisma.chatConversation.findMany({
      where: {
        participants: {
          some: { userId: currentUserId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                condominium: {
                  select: { name: true }
                }
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const mapped = await Promise.all(
      conversations.map((conversation) => mapConversation(conversation, currentUserId))
    );

    res.json({ conversations: mapped });
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    res.status(500).json({ error: 'Falha ao listar conversas' });
  }
});

router.post('/conversations/direct', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = String(req.body?.targetUserId || '').trim();

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId e obrigatorio' });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Nao e permitido criar conversa consigo mesmo' });
    }

    const [sourceUser, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUserId }
      }),
      prisma.user.findUnique({
        where: { id: targetUserId }
      })
    ]);

    if (!sourceUser || !targetUser) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    if (sourceUser.chatEnabled === false) {
      return res.status(403).json({ error: 'Seu chat esta desabilitado. Habilite para iniciar conversas.' });
    }

    if (targetUser.chatEnabled === false) {
      return res.status(400).json({ error: 'Este usuario esta com chat desabilitado no momento.' });
    }

    if (!canUsersChat(sourceUser, targetUser)) {
      return res.status(403).json({ error: 'Sem permissao para conversar com este usuario' });
    }

    const existingCandidates = await prisma.chatConversation.findMany({
      where: {
        type: 'direct',
        participants: {
          some: { userId: currentUserId }
        },
        AND: [
          {
            participants: {
              some: { userId: targetUserId }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                condominium: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    const existing = existingCandidates.find((candidate) => {
      const ids = candidate.participants.map((participant) => participant.userId);
      return ids.length === 2 && ids.includes(currentUserId) && ids.includes(targetUserId);
    });

    if (existing) {
      const payload = await mapConversation(existing, currentUserId);
      return res.json({ conversation: payload });
    }

    const condoId = sourceUser.condoId || targetUser.condoId;
    if (!condoId) {
      return res.status(400).json({ error: 'Nao foi possivel determinar o condominio da conversa' });
    }

    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.create({
        data: {
          condoId,
          type: 'direct',
          createdById: currentUserId,
          updatedAt: now
        }
      });

      await tx.chatParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId: currentUserId, lastReadAt: now },
          { conversationId: conversation.id, userId: targetUserId }
        ]
      });

      return tx.chatConversation.findUnique({
        where: { id: conversation.id },
        include: {
          participants: {
            include: {
              user: {
                include: {
                  condominium: { select: { name: true } }
                }
              }
            }
          }
        }
      });
    });

    if (!created) {
      return res.status(500).json({ error: 'Falha ao criar conversa direta' });
    }

    const responseConversation = await mapConversation(created, currentUserId);
    const participants = created.participants.map((participant) => participant.userId);
    const participantPayloads = await Promise.all(
      created.participants.map((participant) => mapConversation(created, participant.userId))
    );

    participants.forEach((participantId, idx) => {
      emitToUser(participantId, 'chat', {
        type: 'conversation:new',
        conversation: participantPayloads[idx]
      });
    });

    res.status(201).json({ conversation: responseConversation });
  } catch (error) {
    console.error('Erro ao criar conversa direta:', error);
    res.status(500).json({ error: 'Falha ao criar conversa direta' });
  }
});

router.post('/conversations/group', express.json(), authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const name = String(req.body?.name || '').trim();
    const participantIds = Array.isArray(req.body?.participantIds) ? req.body.participantIds : [];

    if (!name) {
      return res.status(400).json({ error: 'Nome do grupo e obrigatorio' });
    }

    const uniqueIds = Array.from(new Set([currentUserId, ...participantIds.map((id) => String(id))]));
    if (uniqueIds.length < 2) {
      return res.status(400).json({ error: 'Selecione pelo menos 2 participantes' });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        active: true
      }
    });

    if (users.length !== uniqueIds.length) {
      return res.status(400).json({ error: 'Um ou mais participantes nao foram encontrados' });
    }

    const sourceUser = users.find((user) => user.id === currentUserId);
    if (!sourceUser) {
      return res.status(401).json({ error: 'Usuario invalido para criar grupo' });
    }

    if (sourceUser.chatEnabled === false) {
      return res.status(403).json({ error: 'Seu chat esta desabilitado. Habilite para criar grupos.' });
    }

    const invalidTarget = users.find((target) => target.id !== currentUserId && (!target.chatEnabled || !canUsersChat(sourceUser, target)));
    if (invalidTarget) {
      return res.status(403).json({ error: `Sem permissao para adicionar ${invalidTarget.name} no grupo` });
    }

    const condoId = sourceUser.condoId || users.find((user) => user.id !== currentUserId)?.condoId;
    if (!condoId) {
      return res.status(400).json({ error: 'Nao foi possivel definir o condominio do grupo' });
    }

    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.create({
        data: {
          condoId,
          type: 'group',
          name,
          createdById: currentUserId,
          updatedAt: now
        }
      });

      await tx.chatParticipant.createMany({
        data: uniqueIds.map((id) => ({
          conversationId: conversation.id,
          userId: id,
          lastReadAt: id === currentUserId ? now : null
        }))
      });

      await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: currentUserId,
          type: 'system',
          content: `${sourceUser.name} criou o grupo "${name}".`
        }
      });

      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: now }
      });

      return tx.chatConversation.findUnique({
        where: { id: conversation.id },
        include: {
          participants: {
            include: {
              user: {
                include: {
                  condominium: { select: { name: true } }
                }
              }
            }
          }
        }
      });
    });

    if (!created) {
      return res.status(500).json({ error: 'Falha ao criar grupo' });
    }

    const payloadsByUser = await Promise.all(
      created.participants.map((participant) => mapConversation(created, participant.userId))
    );

    created.participants.forEach((participant, idx) => {
      emitToUser(participant.userId, 'chat', {
        type: 'conversation:new',
        conversation: payloadsByUser[idx]
      });
    });

    const forCurrent = payloadsByUser[created.participants.findIndex((participant) => participant.userId === currentUserId)] || payloadsByUser[0];
    res.status(201).json({ conversation: forCurrent });
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({ error: 'Falha ao criar grupo' });
  }
});

router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.id;
    const limitRaw = Number.parseInt(String(req.query.limit || '60'), 10);
    const limit = Number.isNaN(limitRaw) ? 60 : Math.min(Math.max(limitRaw, 1), 200);
    const beforeRaw = typeof req.query.before === 'string' ? req.query.before : null;
    const beforeDate = beforeRaw ? new Date(beforeRaw) : null;

    const conversation = await ensureConversationAccess(conversationId, currentUserId);
    if (!conversation) {
      return res.status(403).json({ error: 'Sem permissao para acessar esta conversa' });
    }

    const where = {
      conversationId
    };
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      where.createdAt = { lt: beforeDate };
    }

    const entities = await prisma.chatMessage.findMany({
      where,
      include: {
        sender: {
          include: {
            condominium: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const messages = entities.reverse().map((entity) => formatMessage(entity));
    res.json({ messages });
  } catch (error) {
    console.error('Erro ao listar mensagens:', error);
    res.status(500).json({ error: 'Falha ao listar mensagens' });
  }
});

router.post('/conversations/:id/messages', express.json(), authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.id;
    const requestedType = String(req.body?.type || 'text').trim().toLowerCase();
    const type = CHAT_MESSAGE_TYPES.has(requestedType) ? requestedType : 'text';
    const content = String(req.body?.content || '').trim();
    const fileUrl = req.body?.fileUrl ? String(req.body.fileUrl).trim() : null;
    const fileName = req.body?.fileName ? String(req.body.fileName).trim() : null;
    const fileMime = req.body?.fileMime ? String(req.body.fileMime).trim() : null;
    const fileSize = Number.isFinite(Number(req.body?.fileSize)) ? Number(req.body.fileSize) : null;

    const sender = await prisma.user.findUnique({
      where: { id: currentUserId }
    });

    if (!sender) {
      return res.status(401).json({ error: 'Usuario nao encontrado' });
    }

    if (sender.chatEnabled === false) {
      return res.status(403).json({ error: 'Seu chat esta desabilitado para envio de mensagens' });
    }

    const conversation = await ensureConversationAccess(conversationId, currentUserId);
    if (!conversation) {
      return res.status(403).json({ error: 'Sem permissao para enviar mensagem nesta conversa' });
    }

    if (conversation.type === 'direct') {
      const partner = conversation.participants.find((participant) => participant.userId !== currentUserId);
      if (partner?.user?.chatEnabled === false) {
        return res.status(400).json({ error: 'O destinatario esta com chat desabilitado no momento.' });
      }
    }

    if (type === 'text' && !content) {
      return res.status(400).json({ error: 'Mensagem de texto nao pode ser vazia' });
    }

    if ((type === 'file' || type === 'image') && !fileUrl) {
      return res.status(400).json({ error: 'fileUrl e obrigatorio para mensagens com arquivo' });
    }

    const finalContent = content || fileName || (type === 'image' ? 'Imagem enviada' : 'Arquivo enviado');
    const now = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: currentUserId,
          type,
          content: finalContent,
          fileUrl,
          fileName,
          fileMime,
          fileSize
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

      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: now }
      });

      await tx.chatParticipant.updateMany({
        where: {
          conversationId,
          userId: currentUserId
        },
        data: {
          lastReadAt: now
        }
      });

      return message;
    });

    const payloadMessage = formatMessage(created);
    const participantIds = conversation.participants.map((participant) => participant.userId);

    emitToUsers(participantIds, 'chat', {
      type: 'message:new',
      conversationId,
      message: payloadMessage
    });

    res.status(201).json({ message: payloadMessage });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Falha ao enviar mensagem' });
  }
});

router.post('/conversations/:id/read', authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.id;
    const conversation = await ensureConversationAccess(conversationId, currentUserId);

    if (!conversation) {
      return res.status(403).json({ error: 'Sem permissao para ler esta conversa' });
    }

    const readAt = new Date();
    await prisma.chatParticipant.updateMany({
      where: {
        conversationId,
        userId: currentUserId
      },
      data: {
        lastReadAt: readAt
      }
    });

    emitToUsers(
      conversation.participants.map((participant) => participant.userId),
      'chat',
      {
        type: 'message:read',
        conversationId,
        userId: currentUserId,
        readAt: readAt.toISOString()
      }
    );

    res.json({
      success: true,
      conversationId,
      readAt: readAt.toISOString()
    });
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    res.status(500).json({ error: 'Falha ao marcar conversa como lida' });
  }
});

router.post('/presence', express.json(), authMiddleware, async (req, res) => {
  try {
    const online = req.body?.online !== false;
    await setPresence(req.user.id, online);
    res.json({ success: true, online });
  } catch (error) {
    console.error('Erro ao atualizar presenca:', error);
    res.status(500).json({ error: 'Falha ao atualizar presenca' });
  }
});

router.put('/me/settings', express.json(), authMiddleware, async (req, res) => {
  try {
    const chatEnabled = req.body?.chatEnabled !== false;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { chatEnabled },
      include: {
        condominium: {
          select: { name: true }
        }
      }
    });

    const audience = await getAudienceUserIds(user);
    emitToUsers(audience, 'chat', {
      type: 'settings:update',
      user: formatUser(user)
    });

    res.json({
      success: true,
      settings: {
        chatEnabled: user.chatEnabled !== false
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar configuracoes do chat:', error);
    res.status(500).json({ error: 'Falha ao atualizar configuracoes do chat' });
  }
});

router.get('/me/settings', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        chatEnabled: true
      }
    });

    res.json({
      settings: {
        chatEnabled: user?.chatEnabled !== false
      }
    });
  } catch (error) {
    console.error('Erro ao obter configuracoes do chat:', error);
    res.status(500).json({ error: 'Falha ao obter configuracoes do chat' });
  }
});

export default router;
