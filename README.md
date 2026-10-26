# Lightweight Collaborative Document Editor

A small full stack document editor inspired by Google Docs, built for the Ajaia Full Stack Product Engineer assignment. Users can create, edit, rename, import, delete, and share rich-text documents with other users, with owner / editor / viewer permissions.

**Live app:** `<ADD LIVE URL HERE>`
(Hosted on a free tier. If it has been idle, the first load can take 30-60 seconds to wake up.)

## Test accounts

Login is email-only (a deliberate demo simplification, see "Scope decisions"). Three seeded users exist:

| Name | Email |
|---|---|
| Alice Johnson | alice@test.com |
| Bob Smith | bob@test.com |
| Carol Lee | carol@test.com |

The login screen has one-click buttons for each. To test sharing, log in as Alice in one window and as Bob in a private/incognito window (cookies are shared across normal tabs, so two normal tabs would be the same user).

## Features

- **Documents:** create, rename, edit, autosave, reopen, delete (owner only)
- **Rich text (Tiptap):** bold, italic, underline, headings (H1/H2), bulleted and numbered lists
- **File import:** upload a `.txt` or `.md` file (2 MB max) and it becomes a new editable document. Supported types are shown in the UI.
- **Sharing:** the owner shares by email as **Can edit** or **View only**, changes a role by sharing again, and removes access at any time
- **Owned vs shared:** the dashboard has "My documents" and "Shared with me" tabs. Shared docs show the owner and the role badge.
- **Persistence:** all documents and shares are stored in Postgres, and formatting is preserved as sanitized HTML

### Permissions

| Action | Owner | Editor | Viewer |
|---|---|---|---|
| View | yes | yes | yes |
| Edit content / rename | yes | yes | no |
| Share / change roles / remove access | yes | no | no |
| Delete | yes | no | no |

Viewers get a read-only editor in the UI, and the server independently rejects their writes with a 403.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Vite) + Tiptap + React Router | Tiptap gives usable rich text without building an editor |
| Backend | Node + Express 5 | Small, familiar, async errors flow to one handler |
| Database | PostgreSQL (Neon free tier) | The data is relational (users, documents, shares) and constraints keep it consistent |
| Auth | Signed httpOnly cookie holding the user id | Least code that still demonstrates server-side identity |
| Import | multer (memory storage) + marked + sanitize-html | Parse and discard the file, so no blob storage is needed |
| Tests | Vitest + supertest | Test the access rules through the real HTTP layer |

## Architecture

```
Browser (React + Tiptap)
   |  fetch /api/*  (same-origin, cookie)
   v
Express app
   |-- requireAuth           -> loads req.user from signed cookie
   |-- withDoc(minRole)      -> loads doc + computes caller's role, enforces access
   |-- routes: auth, documents, shares, import
   v
PostgreSQL (users, documents, document_shares)
```

### Project structure

```
client/
  src/
    api.js            fetch wrapper (JSON + FormData, normalized errors)
    App.jsx           session check, routing, header
    Login.jsx         email login with demo user buttons
    Dashboard.jsx     My documents / Shared with me, New, Import, Delete
    EditorPage.jsx    Tiptap editor, title rename, autosave, read-only mode
    ShareDialog.jsx   grant / change / revoke access
server/
  src/
    index.js          starts the server
    app.js            middleware, route mounting, error handler
    db.js             pg pool and query helper
    schema.js         table definitions
    setup.js          applies the schema and seeds users (idempotent)
    errors.js         HttpError class
    middleware/
      auth.js         requireAuth
      access.js       withDoc: the single permission check
    routes/
      auth.js         login, logout, me
      documents.js    list, create, get, patch, delete
      shares.js       list, grant/update, revoke
      imports.js      .txt / .md import
```

### Data model

```
users(id, email UNIQUE, name)
documents(id, owner_id -> users, title, content, source_name, created_at, updated_at)
document_shares(document_id -> documents ON DELETE CASCADE, user_id -> users,
                role CHECK IN ('editor','viewer'), PRIMARY KEY (document_id, user_id))
```

- The **owner lives on the document** and shares live in a join table, so "owned vs shared" is two simple queries.
- The composite primary key prevents duplicate shares, and sharing again updates the role instead.
- `ON DELETE CASCADE` removes a document's shares when the document is deleted.
- Content is stored as **HTML** in one text column. That is what Tiptap emits and what the import path produces, so one format covers everything.
- `source_name` records the original filename for imported documents ("Imported from notes.md").

### Access control

All permission logic lives in one middleware, `withDoc(minRole)`. Every document route declares the minimum role it needs, for example `withDoc('editor')` on PATCH and `withDoc('owner')` on share and delete.

1. The middleware fetches the document and the caller's share row in one query.
2. The caller's role is `owner` if they own it, otherwise their share role, otherwise none.
3. **No access at all returns 404**, so the API does not reveal that a document exists.
4. **Access but insufficient role returns 403.**

Ownership always comes from the session, never from the request body, and PATCH only accepts `title` and `content`.

### API

| Method and path | Role needed | Purpose |
|---|---|---|
| `POST /api/auth/login` | none | Body `{ email }`, sets the session cookie |
| `POST /api/auth/logout` | none | Clears the cookie |
| `GET /api/auth/me` | logged in | Current user |
| `GET /api/documents` | logged in | `{ owned, shared }` summaries |
| `POST /api/documents` | logged in | Create a blank document |
| `POST /api/documents/import` | logged in | Multipart upload (`file`), `.txt` / `.md` only |
| `GET /api/documents/:id` | viewer | Document plus the caller's role |
| `PATCH /api/documents/:id` | editor | Update `title` and/or `content` |
| `DELETE /api/documents/:id` | owner | Delete |
| `GET /api/documents/:id/shares` | owner | List who has access |
| `POST /api/documents/:id/shares` | owner | Body `{ email, role }`, grants or updates |
| `DELETE /api/documents/:id/shares/:userId` | owner | Revoke access |

Errors use one shape everywhere: `{ "error": { "code": "FORBIDDEN", "message": "..." } }`. Status codes used: 400 validation, 401 not logged in, 403 forbidden, 404 not found, 413 file too large, 415 unsupported file type.

### Validation and security

- Document HTML is sanitized with `sanitize-html` on every save and on import, since users supply markup
- Title length is capped and must be non-empty; content must be a string
- Uploads: 2 MB limit, extension allowlist (`.txt`, `.md`), rejects binary content and empty files, and the file is held in memory and never written to disk
- Share targets must be existing users, and you cannot share with yourself
- Secrets live in environment variables, and `.env` is gitignored

### Autosave

The editor debounces changes (about 800 ms after typing stops), sends only the changed field, and shows **Saving / Saved / Save failed**. Pending edits are flushed when the user navigates away.

## Run locally

**Prerequisites:** Node 20+ and a Postgres database. A free [Neon](https://neon.tech) project works well.

```bash
# 1. Server
cd server
npm install
```

Create `server/.env`:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=verify-full
SESSION_SECRET=<output of: openssl rand -hex 32>
PORT=3001
```

```bash
npm run setup     # creates tables and seeds the three users
npm run dev       # API on http://localhost:3001
```

```bash
# 2. Client (in a second terminal)
cd client
npm install
npm run dev       # app on http://localhost:5173
```

Vite proxies `/api` to the Express server, so cookies work without any CORS setup. Open http://localhost:5173 and log in with a seeded email.

## Tests

```bash
cd server
npm test
```

## Scope decisions

Deliberate cuts, made to go deep on the core loop within the timebox:

- **Login is email-only with seeded users.** There are no passwords, so this is not real authentication. Production would use proper auth (OAuth or passwords with sessions).
- **Import is `.txt` and `.md` only.** The original file is parsed and discarded, so there are no attachments, no file table, and no blob storage. `.docx` import is a small addition (`mammoth` is already a dependency).
- **No real-time collaboration.** Saves are last-write-wins, so two people editing the same document at once can overwrite each other. The dashboard also does not live-update.
- **No version history, comments, or PDF export.**
- **Roles are limited to owner, editor, and viewer**, with no per-document permission customization.
- **Not designed for scale:** large documents, many users, backups, and availability SLAs were out of scope.
