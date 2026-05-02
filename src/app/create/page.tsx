'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';
import { QuizQuestion, SavedQuiz } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

const emptyQuestion = (): QuizQuestion => ({
  id: uuidv4(),
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimit: 20,
});

function CreateQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { status } = useSession();
  const isLoggedIn = status === 'authenticated';
  const socket = useSocket();

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQuestion()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(editId);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadingQuiz, setLoadingQuiz] = useState(!!editId);

  // Load existing quiz if editing
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/quizzes/${editId}`)
      .then((res) => res.json())
      .then((quiz: SavedQuiz) => {
        setTitle(quiz.title);
        // Ensure each question has 4 option slots for editing
        const padded = quiz.questions.map((q) => ({
          ...q,
          options: [...q.options, ...Array(4 - q.options.length).fill('')].slice(0, 4),
        }));
        setQuestions(padded);
        setSavedId(quiz.id);
      })
      .catch(() => setError('Kunne ikke laste quizzen'))
      .finally(() => setLoadingQuiz(false));
  }, [editId]);

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: unknown) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[oIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const cleanQuestions = () => {
    return questions.map((q) => ({
      ...q,
      options: q.options.map((o) => o.trim()).filter((o) => o),
      correctIndex: Math.min(q.correctIndex, q.options.filter((o) => o.trim()).length - 1),
    }));
  };

  const validate = (): boolean => {
    setError('');
    if (!title.trim()) {
      setError('Gi quizzen en tittel');
      return false;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        setError(`Spørsmål ${i + 1} mangler tekst`);
        return false;
      }
      const filledOptions = q.options.filter((o) => o.trim());
      if (filledOptions.length < 2) {
        setError(`Spørsmål ${i + 1} trenger minst 2 svaralternativer`);
        return false;
      }
    }
    return true;
  };

  // Save quiz to library (without starting)
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveMessage('');

    const payload = { title: title.trim(), questions: cleanQuestions() };

    try {
      let res: Response;
      if (savedId) {
        res = await fetch(`/api/quizzes/${savedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Kunne ikke lagre quizzen');
        return;
      }

      const quiz: SavedQuiz = await res.json();
      setSavedId(quiz.id);
      setSaveMessage('Lagret!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setError('Nettverksfeil — kunne ikke lagre');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, questions, savedId]);

  // Save and start game
  const handleSaveAndStart = useCallback(async () => {
    if (!validate()) return;
    setStarting(true);

    const payload = { title: title.trim(), questions: cleanQuestions() };

    try {
      // Save first
      let res: Response;
      if (savedId) {
        res = await fetch(`/api/quizzes/${savedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Kunne ikke lagre quizzen');
        setStarting(false);
        return;
      }

      const quiz: SavedQuiz = await res.json();
      setSavedId(quiz.id);

      // Now start game via socket
      socket.emit(
        'create-game',
        { title: quiz.title, questions: quiz.questions },
        (socketRes: { success: boolean; pin?: string; error?: string }) => {
          if (socketRes.success && socketRes.pin) {
            router.push(`/host/${socketRes.pin}`);
          } else {
            setError(socketRes.error || 'Kunne ikke starte spillet');
            setStarting(false);
          }
        }
      );
    } catch {
      setError('Nettverksfeil');
      setStarting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, questions, savedId, socket, router]);

  const optionColors = ['bg-rose-500', 'bg-indigo-500', 'bg-amber-500', 'bg-emerald-500'];
  const optionShapes = ['A', 'B', 'C', 'D'];

  if (loadingQuiz) {
    return (
      <div className="min-h-screen bg-sw-gradient flex items-center justify-center">
        <div className="text-slate-300 text-xl">Laster quiz...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sw-gradient">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push(editId ? '/library' : '/')}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← Tilbake
          </button>
          <h1 className="text-2xl font-bold text-white">
            {editId ? 'Rediger Quiz' : 'Opprett Quiz'}
          </h1>
          <div className="w-16" />
        </div>

        <div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <input
              type="text"
              placeholder="Quiz-tittel..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white text-2xl font-bold placeholder-slate-500 py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
            />
            {!isLoggedIn && !editId && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-200">
                Denne quizzen blir <strong>offentlig</strong> og synlig for alle.{' '}
                <Link href="/login?callbackUrl=/create" className="underline hover:text-white">
                  Logg inn
                </Link>{' '}
                for å lagre private quizzer.
              </div>
            )}
          </div>

          {questions.map((q, qIndex) => (
            <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-6 mb-4 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full">
                  Spørsmål {qIndex + 1}
                </span>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-400">Tid:</label>
                  <select
                    value={q.timeLimit}
                    onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                    className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1 text-sm focus:outline-none"
                  >
                    {[5, 10, 15, 20, 30, 45, 60].map((t) => (
                      <option key={t} value={t}>{t}s</option>
                    ))}
                  </select>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="text-rose-400 hover:text-rose-300 text-sm"
                    >
                      Slett
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                placeholder="Skriv spørsmålet her..."
                value={q.question}
                onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                className="w-full text-lg font-semibold py-2 px-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all mb-4"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuestion(qIndex, 'correctIndex', oIndex)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0 transition-all ${q.correctIndex === oIndex
                        ? `${optionColors[oIndex]} ring-4 ring-offset-2 ring-offset-[#0f172a] ring-emerald-400 scale-110`
                        : `${optionColors[oIndex]} opacity-50 hover:opacity-75`
                        }`}
                      title={q.correctIndex === oIndex ? 'Riktig svar' : 'Klikk for å markere som riktig'}
                    >
                      {optionShapes[oIndex]}
                    </button>
                    <input
                      type="text"
                      placeholder={`Alternativ ${oIndex + 1}`}
                      value={opt}
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                      className="flex-1 py-2 px-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-sm transition-all"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Klikk på farge-knappen for å markere riktig svar. Minst 2 alternativer kreves.</p>
            </div>
          ))}

          <button
            type="button"
            onClick={addQuestion}
            className="w-full border-2 border-dashed border-white/10 text-slate-400 hover:text-white hover:border-white/30 rounded-xl py-4 mb-6 transition-colors font-semibold"
          >
            + Legg til spørsmål
          </button>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-lg p-3 mb-4 text-center">
              {error}
            </div>
          )}

          {saveMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 rounded-lg p-3 mb-4 text-center font-semibold">
              ✓ {saveMessage}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || starting}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:bg-white/5 text-white font-bold py-4 rounded-xl text-lg transition-colors border border-white/10"
            >
              {saving ? 'Lagrer...' : savedId ? 'Lagre endringer 💾' : isLoggedIn ? 'Lagre quiz 💾' : 'Lagre offentlig quiz 🌍'}
            </button>
            <button
              type="button"
              onClick={handleSaveAndStart}
              disabled={saving || starting}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg"
            >
              {starting ? 'Starter...' : 'Lagre og start! 🚀'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateQuizPage() {
  return (
    <Suspense>
      <CreateQuizContent />
    </Suspense>
  );
}
