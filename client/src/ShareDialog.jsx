import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

export default function ShareDialog({ docId, onClose }) {
  const [shares, setShares] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api(`/documents/${docId}/shares`)
      setShares(d.shares)
    } catch (e) {
      setError(e.message)
    }
  }, [docId])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      await api(`/documents/${docId}/shares`, { method: 'POST', body: { email, role } })
      setEmail('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(userId) {
    try {
      await api(`/documents/${docId}/shares/${userId}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2>Share document</h2>
          <button className="link" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={add} className="row">
          <input type="email" placeholder="bob@test.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </select>
          <button type="submit">Share</button>
        </form>
        {error && <p className="error">{error}</p>}
        <ul className="doclist">
          {shares.length === 0 && <li className="muted">Not shared with anyone yet.</li>}
          {shares.map((s) => (
            <li key={s.id}>
              <span>{s.name} <span className="muted">({s.email})</span> · <span className="badge">{s.role === 'editor' ? 'Can edit' : 'View only'}</span></span>
              <button className="link" onClick={() => remove(s.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}