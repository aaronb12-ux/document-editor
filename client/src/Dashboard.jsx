import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from './api.js'

const fmt = (d) => new Date(d).toLocaleString()
const MAX_BYTES = 2 * 1024 * 1024

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('owned')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInput = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    api('/documents').then(setData).catch((e) => setError(e.message))
  }, [])

  async function createDoc() {
    try {
      const { document } = await api('/documents', { method: 'POST', body: {} })
      navigate(`/docs/${document.id}`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setError('')
    if (!/\.(txt|md)$/i.test(file.name)) {
      return setError('Only .txt and .md files are supported.')
    }
    if (file.size > MAX_BYTES) {
      return setError('File is too large (2 MB max).')
    }
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { document } = await api('/documents/import', { method: 'POST', body: form })
      navigate(`/docs/${document.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const list = data ? data[tab] : []

  return (
    <main className="card">
      <div className="row">
        <h1>Documents</h1>
        <div className="row">
          <button onClick={() => fileInput.current.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import file'}
          </button>
          <button onClick={createDoc}>+ New document</button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.md"
        onChange={importFile}
        style={{ display: 'none' }}
      />
      <p className="muted">Import supports .txt and .md files up to 2 MB. Each file becomes a new editable document.</p>
      {error && <p className="error">{error}</p>}

      <div className="tabs">
        <button className={tab === 'owned' ? 'active' : ''} onClick={() => setTab('owned')}>
          My documents{data ? ` (${data.owned.length})` : ''}
        </button>
        <button className={tab === 'shared' ? 'active' : ''} onClick={() => setTab('shared')}>
          Shared with me{data ? ` (${data.shared.length})` : ''}
        </button>
      </div>

      {!data ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">
          {tab === 'owned' ? 'No documents yet. Create or import one to get started.' : 'Nothing has been shared with you yet.'}
        </p>
      ) : (
        <ul className="doclist">
          {list.map((d) => (
            <li key={d.id}>
              <Link to={`/docs/${d.id}`}>{d.title}</Link>
              <span className="muted">
                {tab === 'shared' && (
                  <>
                    {d.owner_name} · <span className="badge">{d.role === 'editor' ? 'Can edit' : 'View only'}</span> ·{' '}
                  </>
                )}
                {tab === 'owned' && d.source_name && <>Imported from {d.source_name} · </>}
                {fmt(d.updated_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}