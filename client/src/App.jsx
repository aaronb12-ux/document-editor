import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { api } from './api.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import EditorPage from './EditorPage.jsx'

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking

  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null))
  }, [])

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  if (user === undefined) return <p className="center">Loading…</p>
  if (!user) return <Login onLogin={setUser} />

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Docs</Link>
        <span>
          {user.name} <button className="link" onClick={logout}>Log out</button>
        </span>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/docs/:id" element={<EditorPage />} />
      </Routes>
    </>
  )
}