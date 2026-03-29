import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Loader2,
  FileText,
  Upload,
  Sparkles,
  X,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { searchAPI, type SearchResult } from "../services/api";
import clsx from "clsx";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);

  const handleResultClick = (result: SearchResult) => {
    if (result.sourceType === "note") {
      navigate(`/notes/${result.sourceId}`);
    } else if (result.sourceType === "document") {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      window.open(
        `${baseUrl}/documents/${result.sourceId}/view`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setPage(1);
    try {
      const r = await searchAPI.search({ q: query, limit, page: 1 });
      setResults(r.data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!query.trim()) return;
    setLoading(true);
    setPage(newPage);
    try {
      const r = await searchAPI.search({ q: query, limit, page: newPage });
      setResults(r.data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 0.8) return { color: "#4ade80" };
    if (score >= 0.6) return { color: "#facc15" };
    return { color: "#fb923c" };
  };

  const scoreLabel = (score: number) => {
    if (score >= 0.8) return "High";
    if (score >= 0.6) return "Good";
    return "Low";
  };

  const getSourceIcon = (sourceType: string) => {
    if (sourceType === "note") {
      return <FileText className="w-4 h-4" style={{ color: "#60a5fa" }} />;
    }
    return <Upload className="w-4 h-4" style={{ color: "#a78bfa" }} />;
  };

  const getSourceBg = (sourceType: string) => {
    if (sourceType === "note") {
      return { backgroundColor: "rgba(96, 165, 250, 0.15)" };
    }
    return { backgroundColor: "rgba(167, 139, 250, 0.15)" };
  };

  const getSourceBadge = (sourceType: string) => {
    if (sourceType === "note") {
      return {
        backgroundColor: "rgba(96, 165, 250, 0.15)",
        color: "#60a5fa",
        border: "1px solid rgba(96, 165, 250, 0.3)",
      };
    }
    return {
      backgroundColor: "rgba(167, 139, 250, 0.15)",
      color: "#a78bfa",
      border: "1px solid rgba(167, 139, 250, 0.3)",
    };
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="heading-1 mb-1">Hybrid Search (Semantic + Keyword)</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Search your entire knowledge base using AI-powered vector similarity
          and keyword matching
        </p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search with natural language: 'machine learning concepts', 'project ideas'..."
              className="input pl-12 py-3 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary px-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" /> Search
              </>
            )}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Results:
          </div>
          {[5, 10, 20].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              className="px-3 py-1 rounded-lg text-sm transition-all"
              style={
                limit === n
                  ? {
                      backgroundColor: "var(--accent-glow)",
                      color: "var(--accent-primary)",
                      border: "1px solid var(--border-accent)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              {n}
            </button>
          ))}
        </div>
      </form>

      {/* Starter prompts */}
      {!searched && (
        <div className="mb-8">
          <p
            className="text-xs mb-3 flex items-center gap-1.5"
            style={{ color: "var(--text-faint)" }}
          >
            <Sparkles
              className="w-3.5 h-3.5"
              style={{ color: "var(--accent-primary)" }}
            />
            Try searching for...
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "artificial intelligence",
              "project management",
              "programming concepts",
              "scientific research",
              "business strategy",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setQuery(prompt);
                }}
                className="px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="skeleton w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <div className="skeleton-text w-1/2" />
                    <div className="skeleton-text w-20" />
                  </div>
                  <div className="skeleton-text w-full" />
                  <div className="skeleton-text w-4/5" />
                  <div className="flex gap-2">
                    <div className="skeleton-text w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="card p-12 text-center">
          <Search
            className="w-12 h-12 mx-auto mb-3"
            style={{ color: "var(--text-faint)" }}
          />
          <p style={{ color: "var(--text-muted)" }}>
            No results found for "{query}"
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-faint)" }}>
            Try different search terms or add more content to your knowledge
            base
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Found{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {results.length}
            </span>{" "}
            results for
            <span style={{ color: "var(--accent-primary)" }}> "{query}"</span>
          </p>
          {results.map((result, idx) => (
            <div
              key={`${result.sourceType}-${result.sourceId}`}
              className="card p-5 transition-all block animate-fadeIn"
              style={{ animationDelay: `${idx * 50}ms`, cursor: "pointer" }}
              onClick={() => handleResultClick(result)}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={getSourceBg(result.sourceType)}
                >
                  {getSourceIcon(result.sourceType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className="font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {result.sourceType === "note" ? "Note" : "Document"} -{" "}
                      {result.sourceId.slice(0, 8)}
                    </h3>
                    <span
                      className="text-xs font-medium shrink-0"
                      style={scoreColor(result.similarity)}
                    >
                      {scoreLabel(result.similarity)} match (
                      {(result.similarity * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <p
                    className="text-sm line-clamp-3 mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {result.content}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="badge text-xs capitalize"
                      style={getSourceBadge(result.sourceType)}
                    >
                      {result.sourceType}
                    </span>
                    {result.sourceType === "document" && (
                      <span
                        className="badge text-xs"
                        style={{
                          backgroundColor: "transparent",
                          color: "var(--text-muted)",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <ExternalLink className="w-3 h-3" /> Open in new tab
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {/* Pagination */}
          {results.length >= limit && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-secondary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span
                className="flex items-center px-4"
                style={{ color: "var(--text-muted)" }}
              >
                Page {page}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={results.length < limit}
                className="btn-secondary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
