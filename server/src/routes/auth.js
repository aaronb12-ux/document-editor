import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { COOKIE_NAME, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!email) throw new HttpError(400, 'VALIDATION', 'Email is required.');

  const { rows } = await query(
    'SELECT id, email, name FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) throw new HttpError(401, 'UNKNOWN_USER', 'No account with that email.');

  res.cookie(COOKIE_NAME, user.id, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ user });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
