'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';
import { SavedQuiz } from '@/lib/types';

export default function LibraryPage() {
  const router = useRouter();
  const { status } = useSession();
  const socket = useSocket();
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/library');
    }
  }, [status, router]);

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch('/api/quizzes');
      if (!res.ok) return;
      const data = await res.json();
      setQuizzes(data);
    } catch {
      console.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handlePlay = useCallback((quiz: SavedQuiz) => {
    setStartingId(quiz.id);
    socket.emit(
      'create-game',
      { title: quiz.title, questions: quiz.questions },
      (res: { success: boolean; pin?: string; error?: string }) => {
        if (res.success && res.pin) {
          router.push(`/host/${res.pin}`);
        } else {
          alert(res.error || 'Kunne ikke starte spillet');
          setStartingId(null);
        }
      }
    );
  }, [socket, router]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      setDeleteConfirm(null);
    } catch {
      alert('Kunne ikke slette quizzen');
    }
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-sw-gradient">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← Tilbake
          </button>
          <h1 className="text-2xl font-bold text-white">Mine Quizzer</h1>
          <button
            onClick={() => router.push('/create')}
            className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-4 py-2 rounded-lg transition-colors"
          >
            + Ny quiz
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="text-slate-400 text-lg">Laster quizzer...</div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 animate-fade-in-up">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold text-white mb-2">Ingen lagrede quizzer</h2>
            <p className="text-slate-400 mb-6">Opprett din første quiz for å komme i gang!</p>
            <button
              onClick={() => router.push('/create')}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
            >
              Opprett quiz
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz, i) => (
              <div
                key={quiz.id}
                className="bg-white/5 border border-white/10 rounded-xl p-5 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{quiz.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {quiz.questions.length} spørsmål · Oppdatert {formatDate(quiz.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/create?edit=${quiz.id}`)}
                      className="text-sm bg-white/10 hover:bg-white/15 text-slate-200 px-3 py-2 rounded-lg transition-colors font-medium"
                    >
                      Rediger
                    </button>

                    {deleteConfirm === quiz.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(quiz.id)}
                          className="text-sm bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-lg transition-colors font-medium"
                        >
                          Slett
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-sm bg-white/10 hover:bg-white/15 text-slate-200 px-3 py-2 rounded-lg transition-colors font-medium"
                        >
                          Avbryt
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(quiz.id)}
                        className="text-sm text-rose-400 hover:text-rose-300 px-2 py-2 transition-colors"
                        title="Slett quiz"
                      >
                        🗑
                      </button>
                    )}

                    <button
                      onClick={() => handlePlay(quiz)}
                      disabled={startingId === quiz.id}
                      className="text-sm bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-bold"
                    >
                      {startingId === quiz.id ? 'Starter...' : 'Spill ▶'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
