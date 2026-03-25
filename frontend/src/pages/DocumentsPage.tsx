import { useEffect, useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  Loader2,
  Trash2,
  File,
  CheckCircle,
  Tag,
  Eye,
  Download,
} from "lucide-react";
import { documentsAPI } from "../services/api";
import toast from "react-hot-toast";
import { format } from "date-fns";
import ProgressBar from "../components/ProgressBar";

type DocStatus = "uploaded" | "processing" | "completed" | "failed";

interface Doc {
  id: string;
  userId: string;
  filename: string;
  filePath: string;
  mimeType: string;
  status: DocStatus;
  processedChunks: number;
  totalChunks: number;
  progress: number;
  tags: string[];
  createdAt: string;
}

const getFileExtension = (filename: string) => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

const toProgress = (
  status: DocStatus,
  processedChunks: number,
  totalChunks: number,
): number => {
  if (status === "completed") return 100;
  if (status === "failed" || status === "uploaded") return 0;
  if (totalChunks <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((processedChunks / totalChunks) * 100)),
  );
};

const mapDoc = (doc: any): Doc => {
  const status = (doc.status ?? "uploaded") as DocStatus;
  const processedChunks = doc.processedChunks ?? 0;
  const totalChunks = doc.totalChunks ?? 0;

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
  };
};

const parseFilenameFromDisposition = (
  contentDisposition?: string,
): string | null => {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const processingDocIds = useMemo(
    () =>
      docs
        .filter(
          (doc) => doc.status === "uploaded" || doc.status === "processing",
        )
        .map((doc) => doc.id),
    [docs],
  );

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await documentsAPI.list();
      const list = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
      const mapped = Array.isArray(list) ? list.map(mapDoc) : [];
      setDocs(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatuses = useCallback(async () => {
    if (processingDocIds.length === 0) return;

    try {
      const results = await Promise.all(
        processingDocIds.map(async (id) => {
          const response = await documentsAPI.status(id);
          return { id, ...response.data };
        }),
      );

      setDocs((prev) =>
        prev.map((doc) => {
          const state = results.find((result) => result.id === doc.id);
          if (!state) return doc;

          return {
            ...doc,
            status: state.status as DocStatus,
            processedChunks: state.processedChunks,
            totalChunks: state.totalChunks,
            progress: state.progress,
          };
        }),
      );
    } catch {
      // Ignore transient polling errors.
    }
  }, [processingDocIds]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (processingDocIds.length === 0) return;

    const timer = setInterval(() => {
      refreshStatuses();
    }, 2000);

    return () => clearInterval(timer);
  }, [processingDocIds.length, refreshStatuses]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        setSelectedFile(accepted[0]);
        setUploadTitle(accepted[0].name.replace(/\.[^/.]+$/, ""));
      }
    },
    onDropRejected: () =>
      toast.error("File rejected (max 10MB, PDF/DOCX/TXT/MD only)"),
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("title", uploadTitle || selectedFile.name);
      fd.append("tags", uploadTags);

      const r = await documentsAPI.upload(fd);
      setDocs((prev) => [mapDoc(r.data), ...prev]);
      setSelectedFile(null);
      setUploadTitle("");
      setUploadTags("");
      toast.success("Document uploaded and processing started");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await documentsAPI.delete(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success("Document deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleView = (id: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
    window.open(`${baseUrl}/documents/${id}/view`, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async (id: string, fallbackFilename: string) => {
    try {
      const response = await documentsAPI.download(id);
      const blob = response.data as Blob;
      const contentDisposition = response.headers["content-disposition"] as
        | string
        | undefined;
      const resolvedName =
        parseFilenameFromDisposition(contentDisposition) || fallbackFilename;

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = resolvedName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Unable to download document");
    }
  };

  const fileTypeIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    const icons: Record<string, string> = {
      pdf: "PDF",
      docx: "DOC",
      txt: "TXT",
      md: "MD",
    };
    return icons[ext] || "FILE";
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="heading-1">Documents</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Upload PDFs, Word docs, and text files to your knowledge base
        </p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="heading-3 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          Upload Document
        </h2>

        <div
          {...getRootProps()}
          className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all"
          style={{
            borderColor: isDragActive
              ? 'var(--accent-primary)'
              : selectedFile
                ? 'var(--success)'
                : 'var(--border-primary)',
            backgroundColor: isDragActive
              ? 'var(--accent-glow)'
              : selectedFile
                ? 'rgba(34, 197, 94, 0.05)'
                : 'transparent',
          }}
        >
          <input {...getInputProps()} />
          {selectedFile ? (
            <div>
              <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--success)' }} />
              <p className="font-medium" style={{ color: 'var(--success)' }}>{selectedFile.name}</p>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                {isDragActive
                  ? "Drop here!"
                  : "Drag and drop or click to upload"}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                PDF, DOCX, TXT, MD - Max 10MB
              </p>
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
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                className="input pl-12"
                placeholder="Tags (comma-separated)"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedFile(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary flex-1 justify-center"
              >
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

      <h2 className="heading-3 mb-3">
        Your Documents ({docs.length})
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-4">
                <div className="skeleton w-12 h-6" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-text w-1/2" />
                  <div className="skeleton-text w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-12 text-center">
          <File className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p style={{ color: 'var(--text-muted)' }}>
            No documents yet. Upload your first document above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="card p-4 flex items-center gap-4 transition-all"
              style={{ cursor: 'pointer' }}
            >
              <div 
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{ 
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-tertiary)'
                }}
              >
                {fileTypeIcon(doc.filename)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {doc.filename}
                  </h3>
                </div>
                <div className="flex items-center gap-3 mt-1 mb-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{doc.mimeType}</span>
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>-</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {doc.processedChunks}/{doc.totalChunks} chunks
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>-</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {format(new Date(doc.createdAt), "MMM d, yyyy")}
                  </span>
                </div>

                <ProgressBar
                  progress={doc.progress}
                  status={doc.status}
                  className="mt-1"
                />

                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="badge"
                        style={{ 
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          color: '#a855f7',
                          border: '1px solid rgba(168, 85, 247, 0.3)'
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleView(doc.id)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(doc.id, doc.filename)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-faint)' }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
