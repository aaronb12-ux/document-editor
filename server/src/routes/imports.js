import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['.txt', '.md']);

const upload = multer({
  storage: multer.memoryStorage(), // nothing is written to disk
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single('file');

// Turn multer's errors into our standard error shape
function receive(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, 'FILE_TOO_LARGE', 'File is too large (2 MB max).'));
      }
      return next(new HttpError(400, 'VALIDATION', 'Upload failed. Send one file in the "file" field.'));
    }
    next(err);
  });
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain text: blank lines separate paragraphs, single newlines become <br>
function textToHtml(text) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

router.post('/', receive, async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'VALIDATION', 'Choose a file to import.');

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED.has(ext)) {
    throw new HttpError(415, 'UNSUPPORTED_TYPE', 'Only .txt and .md files are supported.');
  }
  if (file.buffer.includes(0)) {
    throw new HttpError(415, 'UNSUPPORTED_TYPE', "That file doesn't look like plain text.");
  }

  const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.trim()) throw new HttpError(400, 'VALIDATION', 'That file is empty.');

  // Markdown can contain raw HTML, so sanitize the result either way
  const html = sanitizeHtml(
    ext === '.md' ? marked.parse(text, { async: false }) : textToHtml(text)
  );

  const title =
    path.basename(file.originalname, ext).trim().slice(0, 200) || 'Imported document';

  const { rows } = await query(
    `INSERT INTO documents (owner_id, title, content, source_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title`,
    [req.user.id, title, html, file.originalname.slice(0, 255)]
  );
  res.status(201).json({ document: rows[0], role: 'owner' });
});

export default router;