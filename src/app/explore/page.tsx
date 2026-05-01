'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { SavedQuiz } from '@/lib/types';

export default function ExplorePage() {
  const router = useRouter();
  const socket = useSocket();
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: 'public' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/quizzes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setQuizzes(data);
    } catch {
      console.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#46178f]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-white/70 hover:text-white transition-colors text-sm"
          >
            ← Tilbake
          </button>
          <h1 className="text-2xl font-bold text-white">Utforsk quizzer 🌍</h1>
          <button
            onClick={() => router.push('/create')}
            className="text-sm bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Ny quiz
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Søk etter quizzer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/10 text-white placeholder-white/40 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/30 text-lg"
          />
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="text-white/60 text-lg">Laster quizzer...</div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 animate-fade-in-up">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {debouncedSearch ? 'Ingen treff' : 'Ingen offentlige quizzer ennå'}
            </h2>
            <p className="text-white/60 mb-6">
              {debouncedSearch
                ? 'Prøv et annet søkeord'
                : 'Bli den første til å lage en offentlig quiz!'}
            </p>
            <button
              onClick={() => router.push('/create')}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-xl text-lg transition-colors"
            >
              Opprett quiz
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz, i) => (
              <div
                key={quiz.id}
                className="bg-white rounded-xl shadow-lg p-5 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">{quiz.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {quiz.questions.length} spørsmål
                      {quiz.userName && ` · av ${quiz.userName}`}
                      {' · '}{formatDate(quiz.createdAt)}
                    </p>
                  </div>

                  <button
                    onClick={() => handlePlay(quiz)}
                    disabled={startingId === quiz.id}
                    className="text-sm bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white px-4 py-2 rounded-lg transition-colors font-bold shrink-0"
                  >
                    {startingId === quiz.id ? 'Starter...' : 'Spill ▶'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
