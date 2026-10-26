export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData
  const res = await fetch('/api' + path, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Something went wrong.')
    err.status = res.status
    throw err
  }
  return data
}