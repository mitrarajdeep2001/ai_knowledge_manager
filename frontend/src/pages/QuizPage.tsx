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
  Hash,
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
  const [mode, setMode] = useState<"topic" | "note" | "document">("topic");
  const [form, setForm] = useState({
    topic: "",
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
      if (mode === "topic") {
        await quizAPI.generateByTopic({
          topic: form.topic,
          questionCount: form.questionCount,
        });
      } else {
        const sourceId = mode === "note" ? form.noteId : form.documentId;
        await quizAPI.generate({
          sourceType: mode as "note" | "document",
          sourceId,
          title: form.title || `${mode === "note" ? "Note" : "Document"} Quiz`,
          questionCount: form.questionCount,
          durationSeconds: form.durationSeconds,
        });
      }
      toast.success("Quiz generated!");
      onGenerated();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const isValid =
    mode === "topic"
      ? form.topic.trim()
      : mode === "note"
        ? form.noteId
        : form.documentId;

  const quizModes = [
    // { value: "topic", label: "Topic", icon: Hash },
    { value: "note", label: "Note", icon: FileText },
    { value: "document", label: "Document", icon: Upload },
  ];
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-6 animate-fadeIn">
        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand-400" /> Generate Quiz with AI
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Source</label>
            <div className={`grid grid-cols-${quizModes.length} gap-2`}>
              {quizModes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setMode(value as typeof mode)}
                  className={clsx(
                    "p-3 rounded-xl border text-sm flex flex-col items-center gap-1.5 transition-all",
                    mode === value
                      ? "bg-brand-900/40 border-brand-600 text-brand-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "topic" && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Topic to quiz on
              </label>
              <input
                value={form.topic}
                onChange={(e) =>
                  setForm((f) => ({ ...f, topic: e.target.value }))
                }
                className="input"
                placeholder="e.g., machine learning, React hooks, history..."
              />
            </div>
          )}

          {mode === "note" && (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
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
                <label className="text-sm text-gray-400 mb-2 block">
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
                <label className="text-sm text-gray-400 mb-2 block">
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
                <label className="text-sm text-gray-400 mb-2 block">
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
              <label className="text-sm text-gray-400 mb-2 block">
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
              <label className="text-sm text-gray-400 mb-2 block">
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
  onClose,
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {quizData.title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                Q {current + 1} / {quizData.questions.length}
              </span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full w-32">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all"
                  style={{
                    width: `${((current + 1) / quizData.questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
              timeLeft < 60
                ? "bg-red-900/30 border-red-700 text-red-400"
                : "bg-gray-800 border-gray-700 text-gray-400",
            )}
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-base font-medium text-white leading-relaxed">
            {q.question}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {optionLabels.map((label) => (
            <button
              key={label}
              onClick={() => selectAnswer(label)}
              disabled={submitted}
              className={clsx(
                "w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3",
                answers[q.id] === label
                  ? "bg-brand-900/40 border-brand-600 text-brand-200"
                  : "bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800",
              )}
            >
              <span
                className={clsx(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                  answers[q.id] === label
                    ? "bg-brand-600 text-white"
                    : "bg-gray-700 text-gray-400",
                )}
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
                className={clsx("w-2 h-2 rounded-full transition-all", {
                  "bg-brand-500": i === current,
                  "bg-green-500":
                    answers[quizData.questions[i].id] && i !== current,
                  "bg-gray-700":
                    !answers[quizData.questions[i].id] && i !== current,
                })}
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
              className="btn-primary bg-green-700 hover:bg-green-600"
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 animate-fadeIn">
        <div className="text-center mb-6">
          {results.isTimeExpired && (
            <div className="mb-4">
              <span className="badge bg-yellow-900/30 text-yellow-400 text-sm">
                ⏱️ Time Expired - Auto Submitted
              </span>
            </div>
          )}
          <div
            className={clsx(
              "w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-4",
              pct >= 80
                ? "bg-green-900/30 border-green-600 text-green-300"
                : pct >= 60
                  ? "bg-yellow-900/30 border-yellow-600 text-yellow-300"
                  : "bg-red-900/30 border-red-600 text-red-300",
            )}
          >
            {pct}%
          </div>
          <h2 className="text-xl font-bold text-white">
            {pct >= 80
              ? "Excellent!"
              : pct >= 60
                ? "Good Job!"
                : "Keep Studying!"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
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
          <h1 className="text-2xl font-bold text-white">Quizzes</h1>
          <p className="text-gray-500 text-sm">
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
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {quizSets.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">
                Available Quizzes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizSets.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="card p-5 hover:border-gray-700 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-white line-clamp-2 flex-1 group-hover:text-brand-300 transition-colors">
                        {quiz.title}
                      </h3>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                      >
                        <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-400" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="badge bg-gray-800 text-gray-400">
                        {quiz.questionCount} questions
                      </span>
                      <span className="badge bg-gray-800 text-gray-400 capitalize">
                        {quiz.sourceType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
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
              <h2 className="text-lg font-semibold text-white mb-4">
                Quiz History
              </h2>
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="card p-5 hover:border-gray-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">
                          {item.quizTitle}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            {item.completedAt
                              ? formatDistanceToNow(
                                  new Date(item.completedAt),
                                  { addSuffix: true },
                                )
                              : "In progress"}
                          </span>
                          {item.isTimeExpired && (
                            <span className="badge bg-yellow-900/30 text-yellow-400 text-xs">
                              Time Expired
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div
                            className={clsx(
                              "text-lg font-bold",
                              item.score === 0 ? "text-red-400" : "text-green-400"
                            )}
                          >
                            {item.score}/{item.totalQuestions}
                          </div>
                          <div className="text-xs text-gray-500">score</div>
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
              <HelpCircle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No quizzes yet</p>
              <p className="text-gray-600 text-sm mb-4">
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
