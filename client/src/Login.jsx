import { useState } from 'react'
import { api } from './api.js'

const DEMO = [
  ['alice@test.com', 'Alice'],
  ['bob@test.com', 'Bob'],
  ['carol@test.com', 'Carol'],
]

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  async function submit(e, value = email) {
    e?.preventDefault()
    setError('')
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: { email: value } })
      onLogin(user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="card narrow">
      <h1>Sign in</h1>
      <p className="muted">Demo app: enter a seeded email, or click one below.</p>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="you@test.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Continue</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="demo">
        {DEMO.map(([em, name]) => (
          <button key={em} className="chip" onClick={() => submit(null, em)}>
            {name} ({em})
          </button>
        ))}
      </div>
    </main>
  )
}