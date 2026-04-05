import express from 'express';

const router = express.Router();

// Legacy placeholder route kept for backward compatibility.
// The active state API lives in ./state.js and is mounted at /api.
router.get('/state-complete', (_req, res) => {
  res.status(410).json({
    error: 'Rota legada descontinuada.',
    message: 'Use /api/state para consultar o estado atual.'
  });
});

export default router;
