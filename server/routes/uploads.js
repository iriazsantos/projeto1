import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authMiddleware from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_CATEGORIES = [
  'users_photos',
  'marketplace',
  'areas',
  'documents',
  'reservations',
  'announcements',
  'complaints',
  'votes',
  'deliveries',
  'chat',
  'support',
  'other'
];

const MASTER_ROLES = new Set(['admin', 'admin-master']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_BASE);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }

    cb(new Error('Tipo de arquivo nao permitido'));
  }
});

function getCondoFolder(condoId) {
  return path.join(UPLOADS_BASE, 'condos', condoId);
}

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function getCategoryFolder(condoId, category) {
  const condoFolder = getCondoFolder(condoId);
  const categoryFolder = path.join(condoFolder, category);
  ensureFolder(categoryFolder);
  return categoryFolder;
}

function resolveCondoIdForRequest(user, req) {
  if (req.params?.category === 'support' && !user?.condoId && MASTER_ROLES.has(String(user?.role || '').toLowerCase())) {
    const explicitCondoId = req.body?.condoId || req.query?.condoId || req.headers['x-condo-id'];
    if (!explicitCondoId) {
      return 'platform';
    }
  }

  if (user?.condoId) {
    return String(user.condoId);
  }

  if (!MASTER_ROLES.has(String(user?.role || '').toLowerCase())) {
    return null;
  }

  const bodyCondoId = req.body?.condoId;
  const queryCondoId = req.query?.condoId;
  const headerCondoId = req.headers['x-condo-id'];
  const headerValue = Array.isArray(headerCondoId) ? headerCondoId[0] : headerCondoId;

  const rawCondoId = bodyCondoId || queryCondoId || headerValue;
  if (!rawCondoId) return null;

  const normalized = String(rawCondoId).trim();
  return normalized.length > 0 ? normalized : null;
}

router.post('/create-condo-folder/:condoId', authMiddleware, async (req, res) => {
  try {
    const { condoId } = req.params;
    const user = req.user;

    if (!MASTER_ROLES.has(String(user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Apenas Admin Master pode criar pastas' });
    }

    const condo = await prisma.condominium.findUnique({ where: { id: condoId } });
    if (!condo) {
      return res.status(404).json({ error: 'Condominio nao encontrado' });
    }

    const condoFolder = getCondoFolder(condoId);

    ALLOWED_CATEGORIES.forEach((category) => {
      ensureFolder(path.join(condoFolder, category));
    });

    const sampleReadme = `# Pasta do Condominio: ${condo.name}\n# Created: ${new Date().toISOString()}\n`;
    fs.writeFileSync(path.join(condoFolder, 'README.txt'), sampleReadme);

    res.json({
      success: true,
      message: `Pasta criada para condominio ${condo.name}`,
      path: condoFolder
    });
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload/:category', authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;
    const user = req.user;

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Categoria invalida' });
    }

    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const condoId = resolveCondoIdForRequest(user, req);
      if (!condoId) {
        return res.status(400).json({ error: 'Condominio nao informado para upload' });
      }

      const categoryFolder = getCategoryFolder(condoId, category);
      const originalFilename = req.file.originalname;
      const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalPath = path.join(categoryFolder, safeFilename);

      fs.renameSync(req.file.path, finalPath);

      const relativePath = `/uploads/condos/${condoId}/${category}/${safeFilename}`;

      res.json({
        success: true,
        filename: safeFilename,
        originalName: originalFilename,
        size: req.file.size,
        url: relativePath,
        path: finalPath
      });
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload-base64/:category', authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;
    const { data, filename, extension } = req.body;
    const user = req.user;

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Categoria invalida' });
    }

    const condoId = resolveCondoIdForRequest(user, req);
    if (!condoId) {
      return res.status(400).json({ error: 'Condominio nao informado para upload' });
    }

    if (!data) {
      return res.status(400).json({ error: 'Dados da imagem nao fornecidos' });
    }

    const categoryFolder = getCategoryFolder(condoId, category);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeFilename = `${filename || 'photo'}-${uniqueSuffix}.${extension || 'jpg'}`;
    const finalPath = path.join(categoryFolder, safeFilename);

    const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(finalPath, buffer);

    const relativePath = `/uploads/condos/${condoId}/${category}/${safeFilename}`;

    res.json({
      success: true,
      filename: safeFilename,
      url: relativePath,
      path: finalPath
    });
  } catch (error) {
    console.error('Erro no upload base64:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/files/:category', authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;
    const user = req.user;

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Categoria invalida' });
    }

    const condoId = resolveCondoIdForRequest(user, req);
    if (!condoId) {
      return res.status(400).json({ error: 'Condominio nao informado' });
    }

    const categoryFolder = getCategoryFolder(condoId, category);

    if (!fs.existsSync(categoryFolder)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(categoryFolder).map((filename) => {
      const filePath = path.join(categoryFolder, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `/uploads/condos/${condoId}/${category}/${filename}`
      };
    });

    res.json({ files });
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/files/:category/:filename', authMiddleware, async (req, res) => {
  try {
    const { category, filename } = req.params;
    const user = req.user;

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Categoria invalida' });
    }

    const condoId = resolveCondoIdForRequest(user, req);
    if (!condoId) {
      return res.status(400).json({ error: 'Condominio nao informado' });
    }

    const filePath = path.join(getCondoFolder(condoId), category, filename);
    if (!filePath.startsWith(getCondoFolder(condoId))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: 'Arquivo deletado' });
  } catch (error) {
    console.error('Erro ao deletar:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/condo-folders', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!MASTER_ROLES.has(String(user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Apenas Admin Master pode ver pastas' });
    }

    const condosFolder = path.join(UPLOADS_BASE, 'condos');

    if (!fs.existsSync(condosFolder)) {
      return res.json({ folders: [] });
    }

    const folders = fs.readdirSync(condosFolder).map((folderName) => {
      const folderPath = path.join(condosFolder, folderName);
      const stats = fs.statSync(folderPath);
      return {
        name: folderName,
        path: folderPath,
        created: stats.birthtime,
        categories: fs.existsSync(folderPath) ? fs.readdirSync(folderPath) : []
      };
    });

    res.json({ folders });
  } catch (error) {
    console.error('Erro ao listar pastas:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
