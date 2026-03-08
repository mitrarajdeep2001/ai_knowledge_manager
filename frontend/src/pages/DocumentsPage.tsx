import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, Trash2, File, CheckCircle, Tag } from 'lucide-react'
import { documentsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import ProgressBar from '../components/ProgressBar'

type DocStatus = 'uploaded' | 'processing' | 'completed' | 'failed'

interface Doc {
  id: string
  userId: string
  filename: string
  filePath: string
  mimeType: string
  status: DocStatus
  processedChunks: number
  totalChunks: number
  progress: number
  tags: string[]
  createdAt: string
}

const getFileExtension = (filename: string) => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

const toProgress = (status: DocStatus, processedChunks: number, totalChunks: number): number => {
  if (status === 'completed') return 100
  if (status === 'failed' || status === 'uploaded') return 0
  if (totalChunks <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((processedChunks / totalChunks) * 100)))
}

const mapDoc = (doc: any): Doc => {
  const status = (doc.status ?? 'uploaded') as DocStatus
  const processedChunks = doc.processedChunks ?? 0
  const totalChunks = doc.totalChunks ?? 0

  return {
    id: doc.id,
    userId: doc.userId,
    filename: doc.filename,
    filePath: doc.filePath,
    mimeType: doc.mimeType,
    status,
    processedChunks,
    totalChunks,
    progress: toProgress(status, processedChunks, totalChunks),
    tags: doc.tags ?? [],
    createdAt: doc.createdAt,
  }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const processingDocIds = useMemo(
    () => docs.filter((doc) => doc.status === 'uploaded' || doc.status === 'processing').map((doc) => doc.id),
    [docs],
  )

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await documentsAPI.list()
      const list = Array.isArray(r.data) ? r.data : (r.data?.data ?? [])
      const mapped = Array.isArray(list) ? list.map(mapDoc) : []
      setDocs(mapped)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshStatuses = useCallback(async () => {
    if (processingDocIds.length === 0) return

    try {
      const results = await Promise.all(
        processingDocIds.map(async (id) => {
          const response = await documentsAPI.status(id)
          return { id, ...response.data }
        }),
      )

      setDocs((prev) =>
        prev.map((doc) => {
          const state = results.find((result) => result.id === doc.id)
          if (!state) return doc

          return {
            ...doc,
            status: state.status as DocStatus,
            processedChunks: state.processedChunks,
            totalChunks: state.totalChunks,
            progress: state.progress,
          }
        }),
      )
    } catch {
      // Ignore transient polling errors.
    }
  }, [processingDocIds])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  useEffect(() => {
    if (processingDocIds.length === 0) return

    const timer = setInterval(() => {
      refreshStatuses()
    }, 2000)

    return () => clearInterval(timer)
  }, [processingDocIds.length, refreshStatuses])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        setSelectedFile(accepted[0])
        setUploadTitle(accepted[0].name.replace(/\.[^/.]+$/, ''))
      }
    },
    onDropRejected: () => toast.error('File rejected (max 10MB, PDF/DOCX/TXT/MD only)'),
  })

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('title', uploadTitle || selectedFile.name)
      fd.append('tags', uploadTags)

      const r = await documentsAPI.upload(fd)
      setDocs((prev) => [mapDoc(r.data), ...prev])
      setSelectedFile(null)
      setUploadTitle('')
      setUploadTags('')
      toast.success('Document uploaded and processing started')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return
    try {
      await documentsAPI.delete(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
      toast.success('Document deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const fileTypeIcon = (filename: string) => {
    const ext = getFileExtension(filename)
    const icons: Record<string, string> = { pdf: 'PDF', docx: 'DOC', txt: 'TXT', md: 'MD' }
    return icons[ext] || 'FILE'
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-gray-500 text-sm">Upload PDFs, Word docs, and text files to your knowledge base</p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-400" />
          Upload Document
        </h2>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-brand-500 bg-brand-900/20'
              : selectedFile
                ? 'border-green-600 bg-green-900/10'
                : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
          }`}
        >
          <input {...getInputProps()} />
          {selectedFile ? (
            <div>
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-medium">{selectedFile.name}</p>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {isDragActive ? 'Drop here!' : 'Drag and drop or click to upload'}
              </p>
              <p className="text-gray-600 text-sm mt-1">PDF, DOCX, TXT, MD - Max 10MB</p>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="mt-4 space-y-3">
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="input"
              placeholder="Document title..."
            />
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                className="input pl-10"
                placeholder="Tags (comma-separated)"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelectedFile(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-1 justify-center">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Upload and Process
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-base font-semibold text-white mb-3">Your Documents ({docs.length})</h2>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-12 text-center">
          <File className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No documents yet. Upload your first document above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.id} className="card p-4 flex items-center gap-4 hover:border-gray-700 transition-all">
              <div className="text-xs font-semibold text-gray-300 px-2 py-1 border border-gray-700 rounded">
                {fileTypeIcon(doc.filename)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white truncate">{doc.filename}</h3>
                </div>
                <div className="flex items-center gap-3 mt-1 mb-2">
                  <span className="text-xs text-gray-500">{doc.mimeType}</span>
                  <span className="text-xs text-gray-600">-</span>
                  <span className="text-xs text-gray-500">{doc.processedChunks}/{doc.totalChunks} chunks</span>
                  <span className="text-xs text-gray-600">-</span>
                  <span className="text-xs text-gray-500">{format(new Date(doc.createdAt), 'MMM d, yyyy')}</span>
                </div>

                <ProgressBar
                  progress={doc.progress}
                  status={doc.status}
                  className="mt-1"
                />

                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="badge bg-purple-900/30 text-purple-300 border border-purple-800/40 text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-gray-600 hover:text-red-400 transition-colors p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



