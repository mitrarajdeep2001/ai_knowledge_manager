import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Loader2,
  FileText,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react'
import { notesAPI, tagsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import ProgressBar from '../components/ProgressBar'
import { useTaskStatus } from '../hooks/useTaskStatus'

interface Note {
  id: string
  title: string
  content: string
  userId: string
  createdAt: string
  updatedAt: string
  tags?: string[]
  embeddingStatus?: 'queued' | 'processing' | 'ready' | 'failed'
  embeddingProgress?: number
}

interface NotesPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface NotesListResponse {
  data: Note[]
  pagination: NotesPagination
}

const DEFAULT_LIMIT = 10

const normalizeTags = (rawTags: string[]): string[] =>
  [...new Set(rawTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]

const getStatusMessage = (note: Note): string => {
  const status = note.embeddingStatus || 'queued'
  return status[0].toUpperCase() + status.slice(1)
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<NotesPagination>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 0,
  })
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', tags: '' })

  const hasPendingTasks = notes.some(
    (note) => note.embeddingStatus === 'queued' || note.embeddingStatus === 'processing',
  )

  const loadAvailableTags = useCallback(async () => {
    try {
      const response = await tagsAPI.list()
      const tags = Array.isArray(response.data?.tags) ? response.data.tags : []
      setAvailableTags(tags)
    } catch {
      setAvailableTags([])
    }
  }, [])

  const loadNotes = useCallback(
    async (
      targetPage: number,
      targetSearch: string,
      targetTags: string[],
      options?: { silent?: boolean },
    ) => {
      const silent = options?.silent ?? false

      if (!silent) {
        setLoading(true)
      }

      try {
        const r = await notesAPI.list({
          page: targetPage,
          limit: DEFAULT_LIMIT,
          search: targetSearch || undefined,
          tags: targetTags.length > 0 ? targetTags.join(',') : undefined,
        })

        if (Array.isArray(r.data)) {
          setNotes(r.data)
          setPagination({
            page: targetPage,
            limit: DEFAULT_LIMIT,
            total: r.data.length,
            totalPages: 1,
          })
          return
        }

        const payload = r.data as NotesListResponse
        setNotes(Array.isArray(payload?.data) ? payload.data : [])
        setPagination(
          payload?.pagination ?? {
            page: targetPage,
            limit: DEFAULT_LIMIT,
            total: 0,
            totalPages: 0,
          },
        )
      } catch {
        if (!silent) {
          toast.error('Failed to load notes')
        }
        setNotes([])
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    loadAvailableTags()
  }, [loadAvailableTags])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotes(page, search, selectedTags)
    }, 350)

    return () => clearTimeout(timer)
  }, [loadNotes, page, search, selectedTags])

  useEffect(() => {
    setPage(1)
  }, [search, selectedTags])

  useTaskStatus({
    enabled: hasPendingTasks,
    pollIntervalMs: 3000,
    throttleMs: 900,
    refresh: async () => {
      await loadNotes(page, search, selectedTags, { silent: true })
    },
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const tags = normalizeTags(form.tags.split(','))
      await notesAPI.create({
        title: form.title,
        content: form.content,
        tags,
      })

      setShowCreate(false)
      setForm({ title: '', content: '', tags: '' })
      setPage(1)
      toast.success('Note created. Embedding in progress...')
      await Promise.all([
        loadNotes(1, search, selectedTags),
        loadAvailableTags(),
      ])
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
      toast.success('Note deleted')
      await loadNotes(page, search, selectedTags)
      await loadAvailableTags()
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    )
  }

  const clearTagFilters = () => setSelectedTags([])

  const canPrev = page > 1
  const canNext = pagination.totalPages > 0 && page < pagination.totalPages

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="heading-1">Notes</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {pagination.total} notes in your knowledge base
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Note
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes by title or content..."
          className="input pl-12"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      <div 
        className="mb-6 rounded-2xl p-4"
        style={{ 
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)'
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Filter by tags</p>
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={clearTagFilters}
              className="ml-auto text-xs"
              style={{ color: 'var(--accent-primary)' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {availableTags.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No tags available yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagFilter(tag)}
                  className="badge"
                  style={{
                    backgroundColor: active ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border-primary)'}`,
                  }}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="card w-full max-w-2xl p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <h2 className="heading-2">New Note</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
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
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  className="input pl-12"
                  placeholder="Tags (comma-separated): react, fastify, drizzle"
                />
              </div>
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
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton-text w-3/4" />
              <div className="skeleton-text w-full" />
              <div className="skeleton-text w-5/6" />
              <div className="flex gap-2 mt-4">
                <div className="skeleton-text w-16" />
                <div className="skeleton-text w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-faint)' }} />
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
            {search || selectedTags.length > 0 ? 'No notes match your filters' : 'No notes yet'}
          </p>
          {!search && selectedTags.length === 0 && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> Create your first note
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <Link
                key={note.id}
                to={`/notes/${note.id}`}
                className="card p-5 hover:border-gray-700 transition-all group cursor-pointer flex flex-col"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 
                    className="font-semibold line-clamp-1 flex-1 group-hover:opacity-80 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {note.title}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm line-clamp-3 flex-1 mb-3" style={{ color: 'var(--text-muted)' }}>
                  {note.content.slice(0, 200)}
                </p>
                {Array.isArray(note.tags) && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {note.tags.slice(0, 4).map((tag) => (
                      <span 
                        key={tag} 
                        className="badge"
                        style={{ 
                          backgroundColor: 'var(--accent-glow)',
                          color: 'var(--accent-primary)',
                          border: '1px solid var(--border-accent)'
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                    {note.tags.length > 4 && (
                      <span 
                        className="badge"
                        style={{ 
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-primary)'
                        }}
                      >
                        +{note.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <ProgressBar
                  progress={note.embeddingProgress ?? 0}
                  status={note.embeddingStatus || 'queued'}
                  message={getStatusMessage(note)}
                  className="mb-3"
                />

                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {formatDistanceToNow(new Date(note.updatedAt))} ago
                </p>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={!canPrev}
              className="btn-secondary disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm px-2" style={{ color: 'var(--text-muted)' }}>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!canNext}
              className="btn-secondary disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
