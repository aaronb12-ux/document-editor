import { query } from '../db.js';
import { HttpError } from '../errors.js';

export const COOKIE_NAME = 'uid';

export async function requireAuth(req, _res, next) {
  const id = req.signedCookies?.[COOKIE_NAME];
  if (!id) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in.');

  const { rows } = await query(
    'SELECT id, email, name FROM users WHERE id = $1',
    [id]
  );
  if (!rows[0]) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in.');

  req.user = rows[0];
  next();
}
