import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2, Trash2, File, CheckCircle, AlertCircle, Tag } from 'lucide-react'
import { documentsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'

interface Doc {
  id: number
  title: string
  filename: string
  file_type: string
  file_size: number
  tags: string[]
  is_processed: boolean
  created_at: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await documentsAPI.list()
      setDocs(r.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

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
    onDropRejected: () => toast.error('File rejected (max 10MB, PDF/DOCX/TXT only)'),
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
      setDocs((prev) => [r.data, ...prev])
      setSelectedFile(null)
      setUploadTitle('')
      setUploadTags('')
      toast.success('Document uploaded & processing started!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this document?')) return
    try {
      await documentsAPI.delete(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
      toast.success('Document deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const fileTypeIcon = (type: string) => {
    const icons: Record<string, string> = { pdf: '📄', docx: '📝', txt: '📃', md: '📋' }
    return icons[type] || '📁'
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-gray-500 text-sm">Upload PDFs, Word docs, and text files to your knowledge base</p>
      </div>

      {/* Upload Zone */}
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
              <p className="text-gray-500 text-sm">{formatBytes(selectedFile.size)}</p>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {isDragActive ? 'Drop here!' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-gray-600 text-sm mt-1">PDF, DOCX, TXT, MD • Max 10MB</p>
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
                placeholder="Tags (comma-separated, or blank for AI auto-tagging)"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelectedFile(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-1 justify-center">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Upload className="w-4 h-4" /> Upload & Process</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Documents List */}
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
              <div className="text-2xl">{fileTypeIcon(doc.file_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white truncate">{doc.title}</h3>
                  {doc.is_processed ? (
                    <span className="badge bg-green-900/40 text-green-300 border border-green-800/50">
                      <CheckCircle className="w-3 h-3 mr-1" /> Indexed
                    </span>
                  ) : (
                    <span className="badge bg-yellow-900/40 text-yellow-300 border border-yellow-800/50 animate-pulse-slow">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500">{doc.filename}</span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-xs text-gray-500">{formatBytes(doc.file_size)}</span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-xs text-gray-500">{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                </div>
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
