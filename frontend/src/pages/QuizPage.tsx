import { useEffect, useState, useRef } from "react";
import {
  HelpCircle,
  Plus,
  Loader2,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Trophy,
  Brain,
  FileText,
  Upload,
  ChevronRight,
  Clock,
} from "lucide-react";
import { quizAPI, notesAPI, documentsAPI } from "../services/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";

interface QuizHistory {
  id: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  startedAt: string;
  completedAt: string | null;
  isTimeExpired: boolean;
}

interface QuizSet {
  id: string;
  title: string;
  sourceType: string;
  sourceId: string | null;
  durationSeconds: number;
  questionCount: number;
  createdAt: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  options: Record<string, string>;
}

interface QuizStartResponse {
  attemptId: string;
  title: string;
  durationSeconds: number;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
  questions: QuizQuestion[];
}

interface QuizSubmitResponse {
  attemptId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string | null;
  isTimeExpired: boolean;
}

function GenerateModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [notes, setNotes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [mode, setMode] = useState<"note" | "document">("note");
  const [form, setForm] = useState({
    noteId: "",
    documentId: "",
    title: "",
    questionCount: 5,
    durationSeconds: 300,
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    notesAPI.list({ limit: 100 }).then((r) => setNotes(r.data.data || []));
    documentsAPI.list().then((r) => setDocs(r.data.data || []));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const sourceId = mode === "note" ? form.noteId : form.documentId;
      await quizAPI.generate({
        sourceType: mode as "note" | "document",
        sourceId,
        title: form.title || `${mode === "note" ? "Note" : "Document"} Quiz`,
        questionCount: form.questionCount,
        durationSeconds: form.durationSeconds,
      });
      toast.success("Quiz generated!");
      onGenerated();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const isValid = mode === "note" ? form.noteId : form.documentId;

  const quizModes = [
    { value: "note", label: "Note", icon: FileText },
    { value: "document", label: "Document", icon: Upload },
  ];
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div className="card w-full max-w-lg p-6 animate-fadeIn">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Brain className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /> Generate Quiz with AI
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>Source</label>
            <div className={`grid grid-cols-${quizModes.length} gap-2`}>
              {quizModes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setMode(value as typeof mode)}
                  className="p-3 rounded-xl transition-all text-sm flex flex-col items-center gap-1.5"
                  style={
                    mode === value
                      ? { 
                          backgroundColor: 'var(--accent-glow)', 
                          border: '1px solid var(--accent-primary)',
                          color: 'var(--accent-primary)'
                        }
                      : { 
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-muted)'
                        }
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "note" && (
            <>
              <div>
                <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  Select Note
                </label>
                <select
                  value={form.noteId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, noteId: e.target.value }))
                  }
                  className="input"
                >
                  <option value="">Choose a note...</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  Quiz Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="input"
                  placeholder="My Quiz"
                />
              </div>
            </>
          )}

          {mode === "document" && (
            <>
              <div>
                <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  Select Document
                </label>
                <select
                  value={form.documentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, documentId: e.target.value }))
                  }
                  className="input"
                >
                  <option value="">Choose a document...</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  Quiz Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="input"
                  placeholder="My Quiz"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Questions
              </label>
              <input
                type="number"
                min={3}
                max={20}
                value={form.questionCount}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    questionCount: parseInt(e.target.value),
                  }))
                }
                className="input"
              />
            </div>
            <div>
              <label className="text-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Duration (seconds)
              </label>
              <input
                type="number"
                min={60}
                max={3600}
                value={form.durationSeconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    durationSeconds: parseInt(e.target.value),
                  }))
                }
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !isValid}
            className="btn-primary"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" /> Generate Quiz
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuizRunner({
  quizData,
  onFinish,
}: {
  quizData: QuizStartResponse;
  onFinish: (r: QuizSubmitResponse) => void;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = quizData.questions[current];

  useEffect(() => {
    const expiresAt = new Date(quizData.expiresAt).getTime();
    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining === 0 && !submitted && !submitting) {
        handleSubmitOnExpire();
      }
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quizData.expiresAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const selectAnswer = (answer: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [q.id]: answer }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = quizData.questions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] || "",
      }));
      const r = await quizAPI.submit({
        attemptId: quizData.attemptId,
        answers: formattedAnswers,
      });
      setSubmitted(true);
      onFinish(r.data);
    } catch (err: any) {
      if (timeLeft === 0) {
        toast.error("Time expired - submitting your quiz");
        try {
          const formattedAnswers = quizData.questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] || "",
          }));
          const r = await quizAPI.submit({
            attemptId: quizData.attemptId,
            answers: formattedAnswers,
          });
          setSubmitted(true);
          onFinish(r.data);
        } catch {
          toast.error("Failed to submit quiz");
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to submit");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitOnExpire = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = quizData.questions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] || "",
      }));
      const r = await quizAPI.submit({
        attemptId: quizData.attemptId,
        answers: formattedAnswers,
      });
      setSubmitted(true);
      onFinish(r.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to auto-submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const optionLabels = Object.keys(q.options || {});

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="card w-full max-w-2xl p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {quizData.title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Q {current + 1} / {quizData.questions.length}
              </span>
              <div className="flex-1 h-1.5 rounded-full w-32" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${((current + 1) / quizData.questions.length) * 100}%`,
                    backgroundColor: 'var(--accent-primary)'
                  }}
                />
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={
              timeLeft < 60
                ? { backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error)' }
                : { backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-muted)' }
            }
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {q.question}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {optionLabels.map((label) => (
            <button
              key={label}
              onClick={() => selectAnswer(label)}
              disabled={submitted}
              className="w-full text-left p-4 rounded-xl transition-all flex items-center gap-3"
              style={
                answers[q.id] === label
                  ? { backgroundColor: 'var(--accent-glow)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }
                  : { backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }
              }
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={answers[q.id] === label ? { backgroundColor: 'var(--accent-primary)', color: 'white' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                {label}
              </span>
              <span className="text-sm">{(q.options as any)[label]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="btn-secondary disabled:opacity-40"
          >
            Previous
          </button>

          <div className="flex gap-1">
            {quizData.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: i === current ? 'var(--accent-primary)' : 
                    answers[quizData.questions[i].id] ? 'var(--success)' : 'var(--text-faint)'
                }}
              />
            ))}
          </div>

          {current < quizData.questions.length - 1 ? (
            <button
              onClick={() => setCurrent((c) => c + 1)}
              className="btn-primary"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || timeLeft === 0}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trophy className="w-4 h-4" /> Submit
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({
  results,
  onClose,
}: {
  results: QuizSubmitResponse;
  onClose: () => void;
}) {
  const pct =
    results.totalQuestions > 0
      ? Math.round((results.correctAnswers / results.totalQuestions) * 100)
      : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="card w-full max-w-md p-6 animate-fadeIn">
        <div className="text-center mb-6">
          {results.isTimeExpired && (
            <div className="mb-4">
              <span 
                className="badge"
                style={{ 
                  backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                  color: 'var(--warning)',
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}
              >
                Time Expired - Auto Submitted
              </span>
            </div>
          )}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-4"
            style={
              pct >= 80
                ? { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'var(--success)', color: 'var(--success)' }
                : pct >= 60
                  ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'var(--warning)', color: 'var(--warning)' }
                  : { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--error)', color: 'var(--error)' }
            }
          >
            {pct}%
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {pct >= 80
              ? "Excellent!"
              : pct >= 60
                ? "Good Job!"
                : "Keep Studying!"}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {results.correctAnswers} / {results.totalQuestions} correct
          </p>
        </div>

        <button onClick={onClose} className="btn-primary w-full justify-center">
          Done
        </button>
      </div>
    </div>
  );
}

export default function QuizPage() {
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [history, setHistory] = useState<QuizHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [quizData, setQuizData] = useState<QuizStartResponse | null>(null);
  const [results, setResults] = useState<QuizSubmitResponse | null>(null);

  const loadData = () => {
    Promise.all([
      quizAPI.list().then((r) => setQuizSets(r.data.data || [])),
      quizAPI.listHistory().then((r) => setHistory(r.data.data || [])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartQuiz = async (quizId: string) => {
    try {
      const r = await quizAPI.start(quizId);
      setQuizData(r.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to start quiz");
    }
  };

  const handleFinish = (result: QuizSubmitResponse) => {
    setResults(result);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this quiz and all its history?")) return;
    await quizAPI.delete(id);
    loadData();
    toast.success("Quiz deleted successfully");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="heading-1">Quizzes</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Test your knowledge with AI-generated quizzes
          </p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Generate Quiz
        </button>
      </div>

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onGenerated={loadData}
        />
      )}

      {quizData && !results && (
        <QuizRunner
          quizData={quizData}
          onFinish={handleFinish}
          onClose={() => setQuizData(null)}
        />
      )}

      {results && (
        <ResultsPanel
          results={results}
          onClose={() => {
            setResults(null);
            setQuizData(null);
          }}
        />
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="skeleton-text w-2/3" />
                  <div className="flex gap-2">
                    <div className="skeleton-text w-20" />
                    <div className="skeleton-text w-16" />
                  </div>
                </div>
                <div className="skeleton w-24 h-8" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {quizSets.length > 0 && (
            <div className="mb-8">
              <h2 className="heading-2 mb-4">
                Available Quizzes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizSets.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="card p-5 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold line-clamp-2 flex-1" style={{ color: 'var(--text-primary)' }}>
                        {quiz.title}
                      </h3>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <span 
                        className="badge"
                        style={{ 
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-primary)'
                        }}
                      >
                        {quiz.questionCount} questions
                      </span>
                      <span 
                        className="badge capitalize"
                        style={{ 
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-primary)'
                        }}
                      >
                        {quiz.sourceType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {formatDistanceToNow(new Date(quiz.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      <button
                        onClick={() => handleStartQuiz(quiz.id)}
                        className="btn-primary text-sm py-1.5"
                      >
                        <Play className="w-3.5 h-3.5" /> Take Quiz
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h2 className="heading-2 mb-4">
                Quiz History
              </h2>
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="card p-5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.quizTitle}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {item.completedAt
                              ? formatDistanceToNow(
                                  new Date(item.completedAt),
                                  { addSuffix: true },
                                )
                              : "In progress"}
                          </span>
                          {item.isTimeExpired && (
                            <span 
                              className="badge"
                              style={{ 
                                backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                                color: 'var(--warning)',
                                border: '1px solid rgba(245, 158, 11, 0.3)'
                              }}
                            >
                              Time Expired
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div
                            className="text-lg font-bold"
                            style={{ color: item.score === 0 ? 'var(--error)' : 'var(--success)' }}
                          >
                            {item.score}/{item.totalQuestions}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>score</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {quizSets.length === 0 && history.length === 0 && (
            <div className="card p-16 text-center">
              <HelpCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-faint)' }} />
              <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No quizzes yet</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>
                Generate a quiz from your notes, documents, or a topic
              </p>
              <button
                onClick={() => setShowGenerate(true)}
                className="btn-primary mx-auto"
              >
                <Plus className="w-4 h-4" /> Generate Your First Quiz
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
