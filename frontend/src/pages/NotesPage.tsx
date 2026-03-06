import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Loader2, FileText, Trash2, X } from 'lucide-react'
import { notesAPI } from '../services/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

interface Note {
  id: string
  title: string
  content: string
  userId: string
  createdAt: string
  updatedAt: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const navigate = useNavigate()

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notesAPI.list()
      setNotes(r.data)
    } catch {
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const r = await notesAPI.create(form)
      setNotes((prev) => [r.data, ...prev])
      setShowCreate(false)
      setForm({ title: '', content: '' })
      toast.success('Note created')
      navigate(`/notes/${r.data.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create note')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this note?')) return

    try {
      await notesAPI.delete(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      toast.success('Note deleted')
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="text-gray-500 text-sm">{notes.length} notes in your knowledge base</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Note
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter notes by title or content..."
          className="input pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">New Note</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-gray-500 hover:text-gray-300" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input"
                placeholder="Note title..."
                required
              />
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="textarea"
                rows={10}
                placeholder="Write your note here..."
                required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create Note</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">{search ? 'No notes match your search' : 'No notes yet'}</p>
          {!search && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> Create your first note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              className="card p-5 hover:border-gray-700 transition-all group cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors line-clamp-1 flex-1">
                  {note.title}
                </h3>
                <button
                  onClick={(e) => handleDelete(note.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-500 text-sm line-clamp-3 flex-1 mb-3">{note.content.slice(0, 200)}</p>
              <p className="text-xs text-gray-600">
                {formatDistanceToNow(new Date(note.updatedAt))} ago
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
