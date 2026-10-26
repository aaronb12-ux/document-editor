import { Router } from 'express';
import sanitizeHtml from 'sanitize-html';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { withDoc } from '../middleware/access.js';

const router = Router();
router.use(requireAuth);

const MAX_TITLE = 200;

function cleanTitle(value) {
  const title = String(value ?? '').trim();
  if (!title) throw new HttpError(400, 'VALIDATION', 'Title cannot be empty.');
  if (title.length > MAX_TITLE) {
    throw new HttpError(400, 'VALIDATION', `Title must be ${MAX_TITLE} characters or fewer.`);
  }
  return title;
}

// List: owned + shared with me (summaries only)
router.get('/', async (req, res) => {
  const owned = await query(
    `SELECT id, title, source_name, updated_at
       FROM documents WHERE owner_id = $1
      ORDER BY updated_at DESC`,
    [req.user.id]
  );
  const shared = await query(
    `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, s.role
       FROM document_shares s
       JOIN documents d ON d.id = s.document_id
       JOIN users u ON u.id = d.owner_id
      WHERE s.user_id = $1
      ORDER BY d.updated_at DESC`,
    [req.user.id]
  );
  res.json({ owned: owned.rows, shared: shared.rows });
});

// Create a blank doc
router.post('/', async (req, res) => {
  const title = req.body?.title ? cleanTitle(req.body.title) : 'Untitled document';
  const { rows } = await query(
    'INSERT INTO documents (owner_id, title) VALUES ($1, $2) RETURNING *',
    [req.user.id, title]
  );
  res.status(201).json({ document: rows[0], role: 'owner' });
});

// Open a doc (any role)
router.get('/:id', withDoc('viewer'), (req, res) => {
  res.json({ document: req.doc, role: req.role });
});

// Rename and/or save content (editor or owner)
router.patch('/:id', withDoc('editor'), async (req, res) => {
  const { title, content } = req.body ?? {};
  if (title === undefined && content === undefined) {
    throw new HttpError(400, 'VALIDATION', 'Nothing to update.');
  }

  const newTitle = title === undefined ? req.doc.title : cleanTitle(title);
  let newContent = req.doc.content;
  if (content !== undefined) {
    if (typeof content !== 'string') {
      throw new HttpError(400, 'VALIDATION', 'Content must be a string.');
    }
    newContent = sanitizeHtml(content);
  }

  const { rows } = await query(
    `UPDATE documents
        SET title = $1, content = $2, updated_at = now()
      WHERE id = $3
      RETURNING id, title, updated_at`,
    [newTitle, newContent, req.doc.id]
  );
  res.json({ document: rows[0] });
});

export default router;