import { useEffect, useState } from 'react'
import {
  HelpCircle, Plus, Loader2, Trash2, Play,
  CheckCircle, XCircle, Trophy, Brain, FileText, Upload, Hash, ChevronRight
} from 'lucide-react'
import { quizAPI, notesAPI, documentsAPI } from '../services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'

interface Quiz {
  id: number
  title: string
  description?: string
  source_type: string
  difficulty: string
  questions: any[]
  created_at: string
}

interface QuizAttemptResult {
  quiz_id: number
  score: number
  total_questions: number
  correct_answers: number
  results: any[]
}

function GenerateModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: (q: Quiz) => void }) {
  const [notes, setNotes] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [form, setForm] = useState({
    source_type: 'topic',
    source_id: '',
    topic: '',
    difficulty: 'medium',
    num_questions: 5,
  })
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    notesAPI.list().then((r) => setNotes(r.data))
    documentsAPI.list().then((r) => setDocs(r.data))
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const payload: any = {
        source_type: form.source_type,
        difficulty: form.difficulty,
        num_questions: form.num_questions,
      }
      if (form.source_type === 'topic') payload.topic = form.topic
      else payload.source_id = parseInt(form.source_id)

      const r = await quizAPI.generate(payload)
      toast.success('Quiz generated!')
      onGenerated(r.data)
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-6 animate-fadeIn">
        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand-400" /> Generate Quiz with AI
        </h2>
        
        <div className="space-y-4">
          {/* Source type */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Source</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'topic', label: 'Topic', icon: Hash },
                { value: 'note', label: 'Note', icon: FileText },
                { value: 'document', label: 'Document', icon: Upload },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm((f) => ({ ...f, source_type: value, source_id: '' }))}
                  className={clsx(
                    'p-3 rounded-xl border text-sm flex flex-col items-center gap-1.5 transition-all',
                    form.source_type === value
                      ? 'bg-brand-900/40 border-brand-600 text-brand-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.source_type === 'topic' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Topic to quiz on</label>
              <input
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                className="input"
                placeholder="e.g., machine learning, React hooks, history..."
              />
            </div>
          )}

          {form.source_type === 'note' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Select Note</label>
              <select
                value={form.source_id}
                onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
                className="input"
              >
                <option value="">Choose a note...</option>
                {notes.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>
          )}

          {form.source_type === 'document' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Select Document</label>
              <select
                value={form.source_id}
                onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
                className="input"
              >
                <option value="">Choose a document...</option>
                {docs.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                className="input"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Questions</label>
              <input
                type="number"
                min={3}
                max={20}
                value={form.num_questions}
                onChange={(e) => setForm((f) => ({ ...f, num_questions: parseInt(e.target.value) }))}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={generating || (form.source_type === 'topic' && !form.topic) || (form.source_type !== 'topic' && !form.source_id)}
            className="btn-primary"
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Brain className="w-4 h-4" /> Generate Quiz</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuizRunner({ quiz, onFinish, onClose }: { quiz: Quiz; onFinish: (r: QuizAttemptResult) => void; onClose: () => void }) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<number[]>(new Array(quiz.questions.length).fill(-1))
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startTime] = useState(Date.now())

  const q = quiz.questions[current]

  const selectAnswer = (idx: number) => {
    if (submitted) return
    setAnswers((prev) => { const a = [...prev]; a[current] = idx; return a })
  }

  const handleSubmit = async () => {
    if (answers.some((a) => a === -1)) {
      toast.error('Please answer all questions')
      return
    }
    setSubmitting(true)
    try {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000)
      const r = await quizAPI.submitAttempt(quiz.id, { answers, time_taken: timeTaken })
      setSubmitted(true)
      onFinish(r.data)
    } catch {
      toast.error('Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const optionLabels = ['A', 'B', 'C', 'D']

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">{quiz.title}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">Q {current + 1} / {quiz.questions.length}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full w-32">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all"
                  style={{ width: `${((current + 1) / quiz.questions.length) * 100}%` }}
                />
              </div>
              <span className={clsx('badge', {
                'bg-green-900/40 text-green-300': quiz.difficulty === 'easy',
                'bg-yellow-900/40 text-yellow-300': quiz.difficulty === 'medium',
                'bg-red-900/40 text-red-300': quiz.difficulty === 'hard',
              })}>
                {quiz.difficulty}
              </span>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-base font-medium text-white leading-relaxed">{q.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {q.options.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              className={clsx(
                'w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3',
                answers[current] === i
                  ? 'bg-brand-900/40 border-brand-600 text-brand-200'
                  : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
              )}
            >
              <span className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                answers[current] === i ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-400'
              )}>
                {optionLabels[i]}
              </span>
              <span className="text-sm">{opt}</span>
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="btn-secondary disabled:opacity-40"
          >
            Previous
          </button>
          
          <div className="flex gap-1">
            {quiz.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={clsx('w-2 h-2 rounded-full transition-all', {
                  'bg-brand-500': i === current,
                  'bg-green-500': answers[i] !== -1 && i !== current,
                  'bg-gray-700': answers[i] === -1 && i !== current,
                })}
              />
            ))}
          </div>

          {current < quiz.questions.length - 1 ? (
            <button onClick={() => setCurrent((c) => c + 1)} className="btn-primary">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary bg-green-700 hover:bg-green-600">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trophy className="w-4 h-4" /> Submit</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultsPanel({ results, quiz, onClose }: { results: QuizAttemptResult; quiz: Quiz; onClose: () => void }) {
  const pct = Math.round(results.score)
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Score */}
        <div className="text-center mb-6">
          <div className={clsx(
            'w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-4',
            pct >= 80 ? 'bg-green-900/30 border-green-600 text-green-300'
            : pct >= 60 ? 'bg-yellow-900/30 border-yellow-600 text-yellow-300'
            : 'bg-red-900/30 border-red-600 text-red-300'
          )}>
            {pct}%
          </div>
          <h2 className="text-xl font-bold text-white">
            {pct >= 80 ? '🎉 Excellent!' : pct >= 60 ? '👍 Good Job!' : '📚 Keep Studying!'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {results.correct_answers} / {results.total_questions} correct
          </p>
        </div>

        {/* Results breakdown */}
        <div className="space-y-3">
          {results.results.map((r: any, i: number) => (
            <div key={i} className={clsx(
              'p-4 rounded-xl border',
              r.is_correct ? 'bg-green-900/10 border-green-800/40' : 'bg-red-900/10 border-red-800/40'
            )}>
              <div className="flex items-start gap-2 mb-2">
                {r.is_correct
                  ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                }
                <p className="text-sm text-white">{r.question}</p>
              </div>
              <div className="ml-6 space-y-1 text-xs">
                {!r.is_correct && (
                  <p className="text-red-400">Your answer: {r.options?.[r.user_answer]}</p>
                )}
                <p className="text-green-400">Correct: {r.options?.[r.correct_answer]}</p>
                {r.explanation && (
                  <p className="text-gray-500 mt-1">{r.explanation}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="btn-primary w-full justify-center mt-6">
          Done
        </button>
      </div>
    </div>
  )
}

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  const [results, setResults] = useState<QuizAttemptResult | null>(null)

  useEffect(() => {
    quizAPI.list()
      .then((r) => setQuizzes(r.data))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this quiz?')) return
    await quizAPI.delete(id)
    setQuizzes((prev) => prev.filter((q) => q.id !== id))
    toast.success('Quiz deleted')
  }

  const diffColor = (d: string) => ({
    easy: 'bg-green-900/40 text-green-300 border-green-800/50',
    medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50',
    hard: 'bg-red-900/40 text-red-300 border-red-800/50',
  }[d] || '')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Quizzes</h1>
          <p className="text-gray-500 text-sm">Test your knowledge with AI-generated quizzes</p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Generate Quiz
        </button>
      </div>

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onGenerated={(q) => setQuizzes((prev) => [q, ...prev])}
        />
      )}

      {activeQuiz && !results && (
        <QuizRunner
          quiz={activeQuiz}
          onFinish={(r) => setResults(r)}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      {results && activeQuiz && (
        <ResultsPanel
          results={results}
          quiz={activeQuiz}
          onClose={() => { setResults(null); setActiveQuiz(null) }}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-36 animate-pulse" />)}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="card p-16 text-center">
          <HelpCircle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No quizzes yet</p>
          <p className="text-gray-600 text-sm mb-4">Generate a quiz from your notes or documents</p>
          <button onClick={() => setShowGenerate(true)} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Generate Your First Quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="card p-5 hover:border-gray-700 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white line-clamp-2 flex-1 group-hover:text-brand-300 transition-colors">
                  {quiz.title}
                </h3>
                <button onClick={() => handleDelete(quiz.id)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-400" />
                </button>
              </div>
              {quiz.description && (
                <p className="text-gray-500 text-sm line-clamp-2 mb-3">{quiz.description}</p>
              )}
              <div className="flex items-center gap-2 mb-4">
                <span className={`badge border ${diffColor(quiz.difficulty)}`}>{quiz.difficulty}</span>
                <span className="badge bg-gray-800 text-gray-400 border border-gray-700">
                  {quiz.questions.length} questions
                </span>
                <span className="badge bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                  {quiz.source_type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  {formatDistanceToNow(new Date(quiz.created_at))} ago
                </span>
                <button onClick={() => setActiveQuiz(quiz)} className="btn-primary text-sm py-1.5">
                  <Play className="w-3.5 h-3.5" /> Take Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
