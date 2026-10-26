import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { withDoc } from '../middleware/access.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Who has access (owner only)
router.get('/', withDoc('owner'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, s.role
       FROM document_shares s
       JOIN users u ON u.id = s.user_id
      WHERE s.document_id = $1
      ORDER BY u.name`,
    [req.doc.id]
  );
  res.json({ shares: rows });
});

// Grant access, or update the role if already shared (owner only)
router.post('/', withDoc('owner'), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const role = req.body?.role ?? 'editor';

  if (!email) throw new HttpError(400, 'VALIDATION', 'Email is required.');
  if (!['editor', 'viewer'].includes(role)) {
    throw new HttpError(400, 'VALIDATION', 'Role must be editor or viewer.');
  }

  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  const target = rows[0];
  if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'No user with that email.');
  if (target.id === req.user.id) {
    throw new HttpError(400, 'VALIDATION', 'You already own this document.');
  }

  await query(
    `INSERT INTO document_shares (document_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.doc.id, target.id, role]
  );
  res.status(201).json({ ok: true });
});

// Revoke access (owner only)
router.delete('/:userId', withDoc('owner'), async (req, res) => {
  if (!UUID_RE.test(req.params.userId)) {
    throw new HttpError(400, 'VALIDATION', 'Invalid user id.');
  }
  await query(
    'DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2',
    [req.doc.id, req.params.userId]
  );
  res.json({ ok: true });
});

export default router;