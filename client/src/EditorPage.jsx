import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { api } from './api.js'
import ShareDialog from './ShareDialog.jsx'

export default function EditorPage() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    setState({ loading: true })
    api(`/documents/${id}`)
      .then((d) => setState({ doc: d.document, role: d.role }))
      .catch((e) => setState({ error: e.message }))
  }, [id])

  if (state.loading) return <p className="center">Loading…</p>
  if (state.error)
    return (
      <main className="card narrow">
        <p className="error">{state.error}</p>
        <Link to="/">Back to documents</Link>
      </main>
    )
  return <EditorBody doc={state.doc} role={state.role} />
}

function EditorBody({ doc, role }) {
  const canEdit = role !== 'viewer'
  const [title, setTitle] = useState(doc.title)
  const [status, setStatus] = useState('saved') // saved | saving | error
  const [sharing, setSharing] = useState(false)
  const savedTitle = useRef(doc.title)
  const timer = useRef(null)
  const pending = useRef(null)

  const save = useCallback(
    async (patch) => {
      setStatus('saving')
      try {
        await api(`/documents/${doc.id}`, { method: 'PATCH', body: patch })
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    },
    [doc.id]
  )

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (pending.current !== null) {
      const content = pending.current
      pending.current = null
      save({ content })
    }
  }, [save])

  // Save any unsaved edits when leaving the page
  useEffect(() => () => flush(), [flush])

  const editor = useEditor({
    extensions: [StarterKit.configure({ underline: false }), Underline],
    content: doc.content,
    editable: canEdit,
    onUpdate: ({ editor }) => {
      pending.current = editor.getHTML()
      setStatus('saving')
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 800)
    },
  })

  function commitTitle() {
    const t = title.trim()
    if (!t) return setTitle(savedTitle.current)
    if (t !== savedTitle.current) {
      savedTitle.current = t
      save({ title: t })
    }
  }

  const btn = (label, active, run, name) => (
    <button
      key={name}
      className={active ? 'tool active' : 'tool'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      aria-label={name}
      title={name}
    >
      {label}
    </button>
  )

  return (
    <main className="card wide">
      <div className="row">
        <Link to="/">← Documents</Link>
        <span className={`status ${status}`}>
          {!canEdit ? 'View only' : status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Saved'}
        </span>
        {role === 'owner' && <button onClick={() => setSharing(true)}>Share</button>}
      </div>

      <input
        className="title"
        value={title}
        disabled={!canEdit}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        maxLength={200}
      />
      {role !== 'owner' && (
        <p className="muted">{canEdit ? 'Shared with you: you can edit.' : 'Shared with you: view only.'}</p>
      )}

      {canEdit && editor && (
        <div className="toolbar">
          {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold')}
          {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic')}
          {btn('U', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline')}
          {btn('H1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1')}
          {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2')}
          {btn('• List', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bulleted list')}
          {btn('1. List', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list')}
        </div>
      )}

      <EditorContent editor={editor} className="editor" />

      {sharing && <ShareDialog docId={doc.id} onClose={() => setSharing(false)} />}
    </main>
  )
}