import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Save, Loader2, ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { notesAPI } from '../services/api'
import toast from 'react-hot-toast'

interface Note {
  id: string
  userId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })

  useEffect(() => {
    if (!id) return

    notesAPI.get(id)
      .then((r) => {
        setNote(r.data)
        setForm({ title: r.data.title, content: r.data.content })
      })
      .catch(() => {
        toast.error('Note not found')
        navigate('/notes')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSave = async () => {
    if (!id) return

    setSaving(true)
    try {
      const r = await notesAPI.update(id, form)
      setNote(r.data)
      setEditing(false)
      toast.success('Note saved')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Delete this note permanently?')) return

    try {
      await notesAPI.delete(id)
      toast.success('Note deleted')
      navigate('/notes')
    } catch {
      toast.error('Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
        <button onClick={() => navigate('/notes')} className="btn-ghost">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          {editing ? (
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input text-lg font-semibold py-1"
            />
          ) : (
            <h1 className="text-lg font-semibold text-white">{note?.title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save</>}
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
              <FileText className="w-4 h-4" /> Edit
            </button>
          )}
          <button onClick={handleDelete} className="btn-danger text-sm">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {editing ? (
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="textarea min-h-[60vh] font-mono text-sm leading-relaxed"
            />
          ) : (
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note?.content || ''}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
