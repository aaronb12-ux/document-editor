import { query } from '../db.js';
import { HttpError } from '../errors.js';

const RANK = { viewer: 1, editor: 2, owner: 3 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const withDoc = (minRole) => async (req, _res, next) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) throw new HttpError(404, 'NOT_FOUND', 'Document not found.');

  const { rows } = await query(
    `SELECT d.*, s.role AS share_role
       FROM documents d
       LEFT JOIN document_shares s
         ON s.document_id = d.id AND s.user_id = $2
      WHERE d.id = $1`,
    [id, req.user.id]
  );
  const row = rows[0];
  const role = row && (row.owner_id === req.user.id ? 'owner' : row.share_role);

  // No access at all -> 404 (don't reveal the doc exists)
  if (!role) throw new HttpError(404, 'NOT_FOUND', 'Document not found.');
  // Has access but not enough -> 403
  if (RANK[role] < RANK[minRole]) {
    throw new HttpError(403, 'FORBIDDEN', "You don't have permission to do that.");
  }

  const { share_role, ...doc } = row;
  req.doc = doc;
  req.role = role;
  next();
};