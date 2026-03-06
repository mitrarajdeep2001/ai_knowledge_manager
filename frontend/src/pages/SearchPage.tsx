import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Loader2, FileText, Upload, Sparkles, X, SlidersHorizontal } from 'lucide-react'
import { searchAPI } from '../services/api'
import clsx from 'clsx'

interface SearchResult {
  id: number
  chunk_id: number
  type: 'note' | 'document'
  title: string
  content: string
  score: number
  tags: string[]
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [limit, setLimit] = useState(10)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const r = await searchAPI.search({ query, limit, search_type: 'semantic' })
      setResults(r.data.results)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400'
    if (score >= 0.6) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const scoreLabel = (score: number) => {
    if (score >= 0.8) return 'High'
    if (score >= 0.6) return 'Good'
    return 'Low'
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Semantic Search</h1>
        <p className="text-gray-500 text-sm">Search your entire knowledge base using AI-powered vector similarity</p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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
                onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
          <button type="submit" disabled={loading || !query.trim()} className="btn-primary px-6">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-4 h-4" /> Search</>}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SlidersHorizontal className="w-4 h-4" />
            Results:
          </div>
          {[5, 10, 20].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm transition-all',
                limit === n ? 'bg-brand-900/40 text-brand-300 border border-brand-700' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </form>

      {/* Starter prompts */}
      {!searched && (
        <div className="mb-8">
          <p className="text-xs text-gray-600 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            Try searching for...
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              'artificial intelligence',
              'project management',
              'programming concepts',
              'scientific research',
              'business strategy',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setQuery(prompt); }}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 text-sm transition-all border border-gray-700"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No results found for "{query}"</p>
          <p className="text-gray-600 text-sm mt-1">Try different search terms or add more content to your knowledge base</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Found <span className="text-white font-medium">{results.length}</span> results for
            <span className="text-brand-400"> "{query}"</span>
          </p>
          {results.map((result, idx) => (
            <Link
              key={`${result.type}-${result.chunk_id}`}
              to={result.type === 'note' ? `/notes/${result.id}` : '/documents'}
              className="card p-5 hover:border-gray-700 transition-all block animate-fadeIn group"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  result.type === 'note' ? 'bg-blue-900/40' : 'bg-purple-900/40'
                )}>
                  {result.type === 'note'
                    ? <FileText className="w-4 h-4 text-blue-400" />
                    : <Upload className="w-4 h-4 text-purple-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white group-hover:text-brand-300 transition-colors truncate">
                      {result.title}
                    </h3>
                    <span className={`text-xs font-medium shrink-0 ${scoreColor(result.score)}`}>
                      {scoreLabel(result.score)} match ({(result.score * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-3 mb-2">
                    {result.content}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`badge ${result.type === 'note' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'} text-xs capitalize`}>
                      {result.type}
                    </span>
                    {result.tags?.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="badge bg-gray-800 text-gray-500 text-xs">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
