import express from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/state.json');
const DATA_FILE_BACKUP = `${DATA_FILE}.bak`;
const DATA_FILE_TEMP = `${DATA_FILE}.tmp`;
const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads');

const router = express.Router();
const prisma = new PrismaClient();
let stateWriteQueue = Promise.resolve();

function normalizeLegacyLicenseStatus(status) {
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'overdue';
  return 'pending';
}

function normalizeUserRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'admin-master') return 'admin-master';
  if (normalized === 'sindico') return 'sindico';
  if (normalized === 'porteiro') return 'porteiro';
  if (normalized === 'morador') return 'morador';
  return 'morador';
}

function buildReferenceFromDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : '';
}

function sanitizeSegment(value, fallback = 'item') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalized || fallback;
}

function parseDataImageUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/i);
  if (!match) return null;

  const mimeSubtype = match[1].toLowerCase();
  const base64Payload = dataUrl.slice(match[0].length);
  return { mimeSubtype, base64Payload };
}

function mimeSubtypeToExtension(mimeSubtype) {
  const directMap = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
    bmp: 'bmp',
    'svg+xml': 'svg'
  };

  return directMap[mimeSubtype] || sanitizeSegment(mimeSubtype, 'jpg');
}

async function persistDataImage({
  dataUrl,
  condoId,
  category,
  filenamePrefix
}) {
  const parsed = parseDataImageUrl(dataUrl);
  if (!parsed) return dataUrl;

  const condoFolder = sanitizeSegment(condoId || 'platform', 'platform');
  const categoryFolder = sanitizeSegment(category, 'other');
  const ext = mimeSubtypeToExtension(parsed.mimeSubtype);
  const safePrefix = sanitizeSegment(filenamePrefix, 'image');
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const filename = `${safePrefix}-${uniqueSuffix}.${ext}`;

  const targetFolder = path.join(UPLOADS_BASE, 'condos', condoFolder, categoryFolder);
  await fs.mkdir(targetFolder, { recursive: true });

  const absolutePath = path.join(targetFolder, filename);
  await fs.writeFile(absolutePath, Buffer.from(parsed.base64Payload, 'base64'));

  return `/uploads/condos/${condoFolder}/${categoryFolder}/${filename}`;
}

async function safePersistDataImage(options) {
  try {
    return await persistDataImage(options);
  } catch (error) {
    console.warn('[STATE] Falha ao persistir imagem base64:', error?.message || error);
    return options.dataUrl;
  }
}

async function normalizeImagesToUploadUrls(newState) {
  if (!newState?.core || typeof newState.core !== 'object') return;

  const users = Array.isArray(newState.core.users) ? newState.core.users : [];
  for (const user of users) {
    if (typeof user?.photo === 'string' && user.photo.startsWith('data:image/')) {
      user.photo = await safePersistDataImage({
        dataUrl: user.photo,
        condoId: user.condoId || 'platform',
        category: 'users_photos',
        filenamePrefix: `user-${user.id || user.name || 'photo'}`
      });
    }
  }

  const areas = Array.isArray(newState.core.commonAreas) ? newState.core.commonAreas : [];
  for (const area of areas) {
    if (typeof area?.photoUrl === 'string' && area.photoUrl.startsWith('data:image/')) {
      area.photoUrl = await safePersistDataImage({
        dataUrl: area.photoUrl,
        condoId: area.condoId || 'platform',
        category: 'areas',
        filenamePrefix: `area-${area.id || area.name || 'photo'}`
      });
    }
  }

  const marketItems = Array.isArray(newState.core.marketItems) ? newState.core.marketItems : [];
  for (const item of marketItems) {
    if (!Array.isArray(item?.photos)) continue;

    const normalizedPhotos = [];
    for (const photo of item.photos) {
      if (typeof photo === 'string' && photo.startsWith('data:image/')) {
        const persisted = await safePersistDataImage({
          dataUrl: photo,
          condoId: item.condoId || 'platform',
          category: 'marketplace',
          filenamePrefix: `market-${item.id || item.title || 'photo'}`
        });
        normalizedPhotos.push(persisted);
      } else {
        normalizedPhotos.push(photo);
      }
    }

    item.photos = normalizedPhotos;
  }

  const maintenanceRequests = Array.isArray(newState.core.maintenanceRequests)
    ? newState.core.maintenanceRequests
    : [];
  for (const ticket of maintenanceRequests) {
    if (!Array.isArray(ticket?.photos)) continue;

    const normalizedPhotos = [];
    for (const photo of ticket.photos) {
      if (typeof photo === 'string' && photo.startsWith('data:image/')) {
        const persisted = await safePersistDataImage({
          dataUrl: photo,
          condoId: ticket.condoId || 'platform',
          category: 'complaints',
          filenamePrefix: `ticket-${ticket.id || ticket.title || 'photo'}`
        });
        normalizedPhotos.push(persisted);
      } else {
        normalizedPhotos.push(photo);
      }
    }

    ticket.photos = normalizedPhotos;
  }
}

// Helper para ler o estado persistido no arquivo JSON
function createEmptyState() {
  return {
    core: {
      users: [], condos: [], licenseCharges: [], pixConfigs: [], invoices: [],
      deliveries: [], notifications: [], announcements: [], commonAreas: [],
      reservations: [], votes: [], complaints: [], employees: [], documents: [],
      maintenanceRequests: [], accessLogs: [], lostFound: [], supportMessages: [],
      marketItems: []
    },
    settings: {
      gatewayDashboard: {
        pixKey: '00.000.000/0001-00',
        receiverName: 'INOVATECH CONNECT LTDA',
        receiverCity: 'SAO PAULO'
      }
    },
    gatewayConfigs: {},
    marketplaceListings: [],
    supportConversations: [],
    maintenanceTickets: [],
    documentsLibrary: []
  };
}

async function readStateFile(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function getPersistedState() {
  try {
    return await readStateFile(DATA_FILE);
  } catch (mainError) {
    try {
      const backup = await readStateFile(DATA_FILE_BACKUP);
      await fs.writeFile(DATA_FILE, JSON.stringify(backup, null, 2), 'utf8');
      console.warn('state.json invalido; backup restaurado automaticamente.');
      return backup;
    } catch {
      return createEmptyState();
    }
  }
}

async function writePersistedState(newState) {
  const payload = JSON.stringify(newState, null, 2);

  stateWriteQueue = stateWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE_TEMP, payload, 'utf8');

      try {
        await fs.unlink(DATA_FILE_BACKUP);
      } catch {
        // ignora: backup anterior pode nao existir
      }

      try {
        await fs.rename(DATA_FILE, DATA_FILE_BACKUP);
      } catch (renameError) {
        if (renameError?.code !== 'ENOENT') {
          throw renameError;
        }
      }

      try {
        await fs.rename(DATA_FILE_TEMP, DATA_FILE);
      } catch (writeError) {
        try {
          await fs.rename(DATA_FILE_BACKUP, DATA_FILE);
        } catch {
          // sem rollback possivel
        }
        throw writeError;
      }
    });

  return stateWriteQueue;
}

router.get('/state', async (req, res) => {
  try {
    // Carrega apenas os dados persistidos no arquivo JSON
    const persistedState = await getPersistedState();
    
    // Tenta carregar dados do Prisma opcionalmente
    try {
      const condominiums = await prisma.condominium.findMany({
        where: { active: true },
        include: { gatewayConfigs: true }
      });
      const [usersFromPrisma, licenseBillings, legacyLicenseCharges, invoices] = await Promise.all([
        prisma.user.findMany({
          where: { active: true },
          orderBy: { createdAt: 'asc' }
        }),
        prisma.licenseBilling.findMany({
          where: {
            condominium: { active: true }
          },
          include: {
            condominium: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.licenseCharge.findMany({
          where: {
            condominium: { active: true }
          }
        }),
        prisma.invoice.findMany({
          where: {
            condominium: { active: true }
          }
        })
      ]);

      const persistedUsers = Array.isArray(persistedState.core?.users) ? persistedState.core.users : [];
      const persistedUserById = new Map(persistedUsers.map((user) => [user.id, user]));
      const mappedUsers = usersFromPrisma.map((user) => {
        const persisted = persistedUserById.get(user.id) || {};
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          // Mantem password do estado persistido (quando existir) para compatibilidade local.
          password: typeof persisted.password === 'string' ? persisted.password : '',
          role: user.role || 'morador',
          cpf: user.cpf || '',
          birthDate: user.birthDate || '',
          phone: user.phone || '',
          condoId: user.condoId || undefined,
          unit: user.unit || undefined,
          createdAt: user.createdAt.toISOString(),
          active: user.active !== false,
          canViewCharges: user.canViewCharges === true,
          photo: typeof persisted.photo === 'string' ? persisted.photo : undefined,
          avatar: typeof persisted.avatar === 'string' ? persisted.avatar : undefined,
          kinship: typeof persisted.kinship === 'string' ? persisted.kinship : undefined
        };
      });

      const legacyById = new Map(legacyLicenseCharges.map((charge) => [charge.id, charge]));
      const mappedFromBillings = licenseBillings.map((billing) => {
        const legacy = legacyById.get(billing.id);
        return {
          id: billing.id,
          condoId: billing.condoId,
          condoName: billing.condominium?.name || legacy?.condoName || '',
          description: billing.description,
          amount: billing.amount,
          dueDate: billing.dueDate.toISOString().split('T')[0],
          status: normalizeLegacyLicenseStatus(billing.status),
          paidAt: billing.paidAt ? billing.paidAt.toISOString() : null,
          viewedBySindico: legacy?.viewedBySindico === true,
          viewedAt: legacy?.viewedAt ? legacy.viewedAt.toISOString() : null,
          createdAt: billing.createdAt.toISOString(),
          reference: legacy?.reference || buildReferenceFromDate(billing.dueDate)
        };
      });

      const mappedIds = new Set(mappedFromBillings.map((charge) => charge.id));
      const unsyncedLegacy = legacyLicenseCharges
        .filter((charge) => !mappedIds.has(charge.id))
        .map((charge) => ({
          id: charge.id,
          condoId: charge.condoId,
          condoName: charge.condoName || '',
          description: charge.description,
          amount: charge.amount,
          dueDate: charge.dueDate.toISOString().split('T')[0],
          status: normalizeLegacyLicenseStatus(charge.status),
          paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
          viewedBySindico: charge.viewedBySindico === true,
          viewedAt: charge.viewedAt ? charge.viewedAt.toISOString() : null,
          createdAt: charge.createdAt.toISOString(),
          reference: charge.reference || buildReferenceFromDate(charge.dueDate)
        }));

      const mergedLicenseCharges = [...mappedFromBillings, ...unsyncedLegacy]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const condosWithRealCounts = await Promise.all(condominiums.map(async (c) => {
        const userCount = await prisma.user.count({
          where: { condoId: c.id, active: true }
        });
        return {
          id: c.id,
          name: c.name,
          cnpj: c.cnpj,
          email: c.email,
          phone: c.phone,
          address: c.address,
          city: c.city,
          units: c.units,
          residents: userCount,
          sindico: c.sindico,
          sindicoId: c.sindicoId,
          active: c.active,
          blocked: c.blocked,
          monthlyRevenue: c.monthlyRevenue,
          pendingCharges: c.pendingCharges,
          licenseValue: c.licenseValue,
          createdAt: c.createdAt.toISOString()
        };
      }));

      // Injeta os dados do Prisma por cima do estado persistido
      persistedState.core.users = mappedUsers;
      persistedState.core.condos = condosWithRealCounts;
      persistedState.core.licenseCharges = mergedLicenseCharges;
      persistedState.core.invoices = invoices;
      
      persistedState.gatewayConfigs = condominiums.reduce((acc, c) => {
        if (c.gatewayConfigs) {
          c.gatewayConfigs.forEach(gc => {
            acc[gc.provider] = {
              id: gc.id,
              enabled: gc.isActive,
              apiKey: gc.credentials,
              environment: gc.environment
            };
          });
        }
        return acc;
      }, persistedState.gatewayConfigs || {});
    } catch (prismaError) {
      console.warn('[STATE] Prisma indisponivel, usando fallback:', prismaError.message);
      // Continua com dados persistidos apenas
    }

    res.status(200).json(persistedState);
  } catch (error) {
    console.error('[STATE] Erro critico /api/state:', error);
    res.status(500).json({ 
      error: 'Falha ao carregar estado', 
      message: error.message 
    });
  }
});

router.put('/state', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const newState = req.body;
    await normalizeImagesToUploadUrls(newState);
    await writePersistedState(newState);

    // Sincronizar com Prisma (SQLite) de forma silenciosa para nao quebrar o fluxo
    try {
      if (newState.core?.users && Array.isArray(newState.core.users)) {
        const incomingUserIds = new Set();

        for (const user of newState.core.users) {
          if (!user?.id || !user?.email || !user?.name) continue;
          incomingUserIds.add(user.id);

          await prisma.user.upsert({
            where: { id: user.id },
            create: {
              id: user.id,
              name: user.name,
              email: user.email,
              password: user.password || '123456',
              role: normalizeUserRole(user.role),
              cpf: user.cpf || null,
              birthDate: user.birthDate || null,
              phone: user.phone || null,
              condoId: user.condoId || null,
              unit: user.unit || null,
              active: user.active !== false,
              canViewCharges: user.canViewCharges === true,
              createdAt: user.createdAt ? new Date(user.createdAt) : new Date()
            },
            update: {
              name: user.name,
              email: user.email,
              password: user.password || undefined,
              role: normalizeUserRole(user.role),
              cpf: user.cpf || null,
              birthDate: user.birthDate || null,
              phone: user.phone || null,
              condoId: user.condoId || null,
              unit: user.unit || null,
              active: user.active !== false,
              canViewCharges: user.canViewCharges === true
            }
          });
        }

        if (incomingUserIds.size > 0) {
          const staleUsers = await prisma.user.findMany({
            where: {
              active: true,
              id: { notIn: Array.from(incomingUserIds) }
            },
            select: {
              id: true,
              role: true
            }
          });

          for (const staleUser of staleUsers) {
            // Protecao minima contra lockout acidental do ambiente.
            if (staleUser.role === 'admin' || staleUser.role === 'admin-master') {
              continue;
            }

            try {
              await prisma.user.delete({ where: { id: staleUser.id } });
            } catch (removeError) {
              const isForeignKeyConstraint = removeError?.code === 'P2003'
                || String(removeError?.message || '').includes('Foreign key constraint');

              if (!isForeignKeyConstraint) {
                throw removeError;
              }

              // Fallback seguro: se houver dependencias, desativa o usuario.
              await prisma.user.update({
                where: { id: staleUser.id },
                data: { active: false }
              });
            }
          }
        }
      }

      if (newState.core?.condos && Array.isArray(newState.core.condos)) {
        const incomingCondoIds = [];
        const incomingCondoIdSet = new Set();
        const currentlyActiveCondos = await prisma.condominium.findMany({
          where: { active: true },
          select: { id: true }
        });

        for (const condo of newState.core.condos) {
          if (!condo?.id) continue;
          incomingCondoIds.push(condo.id);
          incomingCondoIdSet.add(condo.id);
          await prisma.condominium.upsert({
            where: { id: condo.id },
            create: {
              id: condo.id,
              name: condo.name,
              cnpj: condo.cnpj || null,
              email: condo.email || null,
              phone: condo.phone || null,
              address: condo.address || '',
              city: condo.city || '',
              units: condo.units || 0,
              residents: condo.residents || 0,
              sindico: condo.sindico || '',
              sindicoId: condo.sindicoId || 'u1',
              active: condo.active !== false,
              blocked: condo.blocked === true,
              monthlyRevenue: condo.monthlyRevenue || 0,
              pendingCharges: condo.pendingCharges || 0,
              licenseValue: condo.licenseValue || 0,
              createdAt: condo.createdAt ? new Date(condo.createdAt) : new Date()
            },
            update: {
              name: condo.name,
              cnpj: condo.cnpj || null,
              email: condo.email || null,
              phone: condo.phone || null,
              address: condo.address || '',
              city: condo.city || '',
              units: condo.units || 0,
              sindico: condo.sindico || '',
              sindicoId: condo.sindicoId || 'u1',
              active: condo.active !== false,
              blocked: condo.blocked === true,
              monthlyRevenue: condo.monthlyRevenue || 0,
              pendingCharges: condo.pendingCharges || 0,
              licenseValue: condo.licenseValue || 0
            }
          });
        }

        const removedCondoIds = currentlyActiveCondos
          .map((condo) => condo.id)
          .filter((id) => !incomingCondoIdSet.has(id));

        if (incomingCondoIds.length > 0) {
          await prisma.condominium.updateMany({
            where: {
              id: { notIn: incomingCondoIds },
              active: true
            },
            data: {
              active: false
            }
          });
        } else {
          await prisma.condominium.updateMany({
            where: { active: true },
            data: { active: false }
          });
        }

        if (removedCondoIds.length > 0) {
          await prisma.licenseCharge.deleteMany({
            where: { condoId: { in: removedCondoIds } }
          });
          await prisma.licenseBilling.deleteMany({
            where: { condoId: { in: removedCondoIds } }
          });
          await prisma.invoice.deleteMany({
            where: { condoId: { in: removedCondoIds } }
          });
        }
      }

      if (newState.core?.invoices && Array.isArray(newState.core.invoices)) {
        const incomingInvoiceIds = [];
        for (const inv of newState.core.invoices) {
          if (!inv?.id) continue;
          incomingInvoiceIds.push(inv.id);
          await prisma.invoice.upsert({
            where: { id: inv.id },
            create: {
              id: inv.id,
              condoId: inv.condoId,
              userId: inv.userId || 'u1',
              userName: inv.userName || '',
              unit: inv.unit || '',
              description: inv.description || '',
              amount: inv.amount || 0,
              dueDate: new Date(inv.dueDate || Date.now()),
              status: inv.status || 'pending',
              paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
              createdAt: inv.createdAt ? new Date(inv.createdAt) : new Date()
            },
            update: {
              description: inv.description,
              amount: inv.amount,
              dueDate: new Date(inv.dueDate || Date.now()),
              status: inv.status,
              paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
            }
          });
        }

        if (incomingInvoiceIds.length > 0) {
          await prisma.invoice.deleteMany({
            where: { id: { notIn: incomingInvoiceIds } }
          });
        } else {
          await prisma.invoice.deleteMany();
        }
      }

      if (newState.core?.licenseCharges && Array.isArray(newState.core.licenseCharges)) {
        const incomingLicenseChargeIds = [];
        for (const lc of newState.core.licenseCharges) {
          if (!lc?.id) continue;
          incomingLicenseChargeIds.push(lc.id);
          await prisma.licenseCharge.upsert({
            where: { id: lc.id },
            create: {
              id: lc.id,
              condoId: lc.condoId,
              condoName: lc.condoName || '',
              description: lc.description || '',
              amount: lc.amount || 0,
              dueDate: new Date(lc.dueDate || Date.now()),
              status: lc.status || 'pending',
              paidAt: lc.paidAt ? new Date(lc.paidAt) : null,
              reference: lc.reference || '',
              createdAt: lc.createdAt ? new Date(lc.createdAt) : new Date()
            },
            update: {
              description: lc.description,
              amount: lc.amount,
              dueDate: new Date(lc.dueDate || Date.now()),
              status: lc.status,
              paidAt: lc.paidAt ? new Date(lc.paidAt) : null,
            }
          });

          if (lc.id && (lc.status === 'paid' || lc.status === 'overdue')) {
            await prisma.licenseBilling.updateMany({
              where: { id: lc.id },
              data: {
                status: lc.status,
                paidAt: lc.status === 'paid'
                  ? (lc.paidAt ? new Date(lc.paidAt) : new Date())
                  : null
              }
            });
          }
        }

        if (incomingLicenseChargeIds.length > 0) {
          await prisma.licenseCharge.deleteMany({
            where: { id: { notIn: incomingLicenseChargeIds } }
          });
          await prisma.licenseBilling.deleteMany({
            where: { id: { notIn: incomingLicenseChargeIds } }
          });
        } else {
          await prisma.licenseCharge.deleteMany();
          await prisma.licenseBilling.deleteMany();
        }
      }
    } catch (syncError) {
      console.warn('[STATE] Erro nao-bloqueante ao sincronizar front -> banco:', syncError.message);
    }

    res.json(newState);
  } catch (error) {
    console.error('Erro ao salvar estado:', error);
    res.status(500).json({ error: 'Falha ao persistir estado' });
  }
});

export default router;

