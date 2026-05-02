'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { AnswerResultData, LeaderboardEntry } from '@/lib/types';

type PlayerPhase = 'join' | 'lobby' | 'question' | 'answered' | 'result' | 'leaderboard' | 'finished';

interface QuestionData {
  index: number;
  total: number;
  question: string;
  options: string[];
  timeLimit: number;
}

export default function PlayPage() {
  const params = useParams();
  const pin = params.gameId as string;
  const socket = useSocket();

  const [phase, setPhase] = useState<PlayerPhase>('join');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerResult, setAnswerResult] = useState<AnswerResultData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    socket.on('player-joined', (data: { players: string[]; count: number }) => {
      setPlayerCount(data.count);
    });

    socket.on('question', (data: QuestionData) => {
      setPhase('question');
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setTimeLeft(data.timeLimit);
    });

    socket.on('answer-result', (data: AnswerResultData) => {
      setAnswerResult(data);
      setPhase('result');
    });

    socket.on('question-results', () => {
      // If player hasn't answered, they'll get answer-result with timedOut
      if (phase === 'question') {
        setPhase('result');
        setAnswerResult({
          correct: false,
          correctIndex: -1,
          score: 0,
          totalScore: 0,
          streak: 0,
        });
      }
    });

    socket.on('leaderboard', (data: { leaderboard: LeaderboardEntry[] }) => {
      setPhase('leaderboard');
      setLeaderboard(data.leaderboard);
    });

    socket.on('game-over', (data: { leaderboard: LeaderboardEntry[] }) => {
      setPhase('finished');
      setLeaderboard(data.leaderboard);
    });

    return () => {
      socket.off('player-joined');
      socket.off('question');
      socket.off('answer-result');
      socket.off('question-results');
      socket.off('leaderboard');
      socket.off('game-over');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'question' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  const handleJoin = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Skriv inn et kallenavn');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit('join-game', { pin, nickname: nickname.trim() }, (res: { success: boolean; gameId?: string; error?: string; reconnected?: boolean; state?: string }) => {
      if (res.success) {
        if (res.reconnected) {
          // Reconnected mid-game — socket events will set the correct phase
          setPhase('lobby'); // temporary, will be updated by incoming game state events
        } else {
          setPhase('lobby');
        }
      } else {
        setError(res.error || 'Kunne ikke bli med');
      }
      setLoading(false);
    });
  }, [socket, pin, nickname]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
    setPhase('answered');

    socket.emit('answer', { answerIndex }, () => { });
  }, [socket, selectedAnswer]);

  const optionColors = ['bg-rose-500', 'bg-indigo-500', 'bg-amber-500', 'bg-emerald-500'];
  const optionShapes = ['A', 'B', 'C', 'D'];

  // JOIN SCREEN
  if (phase === 'join') {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="text-5xl font-black text-white mb-1">
            say<span className="text-cyan-400">what</span>
          </h1>
          <p className="text-slate-500 text-sm">Game PIN: {pin}</p>
        </div>

        <form onSubmit={handleJoin} className="w-full max-w-sm animate-fade-in-up">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <input
              type="text"
              placeholder="Kallenavn"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setError(''); }}
              className="w-full text-center text-xl font-bold py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all mb-3"
              maxLength={20}
              autoFocus
            />
            {error && <p className="text-rose-400 text-sm text-center mb-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl text-lg transition-colors"
            >
              {loading ? 'Kobler til...' : 'Bli med!'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // LOBBY - WAITING
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <div className="text-6xl mb-6">🎮</div>
          <h2 className="text-3xl font-black text-white mb-2">Du er med!</h2>
          <p className="text-xl text-cyan-400 font-bold mb-4">{nickname}</p>
          <p className="text-slate-400 mb-2">Venter på at verten starter spillet...</p>
          <p className="text-slate-500 text-sm">{playerCount} spillere er klare</p>

          <div className="mt-8">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-slate-400 text-sm">Tilkoblet</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // QUESTION - SELECT ANSWER
  if (phase === 'question' && currentQuestion) {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/20">
          <span className="text-slate-400 text-sm">
            {currentQuestion.index + 1} / {currentQuestion.total}
          </span>
          <span className={`text-2xl font-black ${timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}
          </span>
        </div>

        {/* Timer bar */}
        <div className="w-full h-1.5 bg-white/5">
          <div
            className="h-full bg-cyan-400 transition-all duration-1000 ease-linear"
            style={{ width: `${currentQuestion.timeLimit > 0 ? (timeLeft / currentQuestion.timeLimit) * 100 : 0}%` }}
          />
        </div>

        {/* Question text */}
        <div className="px-4 py-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Answer options */}
        <div className="flex-1 grid grid-cols-2 gap-3 p-4">
          {currentQuestion.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              className={`${optionColors[i]} rounded-xl flex flex-col items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg active:scale-95 transition-transform min-h-[100px]`}
            >
              <span className="text-3xl mb-1 opacity-60">{optionShapes[i]}</span>
              <span className="px-2 text-center text-base sm:text-lg">{opt}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ANSWERED - WAITING FOR RESULTS
  if (phase === 'answered') {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          {selectedAnswer !== null && (
            <div className={`w-24 h-24 ${optionColors[selectedAnswer]} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
              <span className="text-4xl text-white font-bold">{optionShapes[selectedAnswer]}</span>
            </div>
          )}
          <h2 className="text-2xl font-bold text-white mb-2">Svar sendt!</h2>
          <p className="text-slate-400">Venter på resultater...</p>
        </div>
      </div>
    );
  }

  // RESULT
  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          {answerResult?.correct ? (
            <>
              <div className="text-7xl mb-4">✅</div>
              <h2 className="text-3xl font-black text-emerald-400 mb-2">Riktig!</h2>
              <p className="text-5xl font-black text-white mb-2">+{answerResult.score}</p>
              {answerResult.streak > 1 && (
                <p className="text-amber-400 font-bold">🔥 {answerResult.streak} på rad!</p>
              )}
            </>
          ) : (
            <>
              <div className="text-7xl mb-4">❌</div>
              <h2 className="text-3xl font-black text-rose-400 mb-2">Feil</h2>
              <p className="text-slate-400">Bedre lykke neste gang!</p>
            </>
          )}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl px-6 py-3 inline-block">
            <p className="text-slate-400 text-sm">Total poengsum</p>
            <p className="text-2xl font-bold text-white">{(answerResult?.totalScore || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  // LEADERBOARD
  if (phase === 'leaderboard') {
    const myRank = leaderboard.find((e) => e.nickname === nickname);
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <h2 className="text-3xl font-black text-white mb-6">Poengtavle</h2>

        {myRank && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6 text-center w-full max-w-sm">
            <p className="text-slate-400 text-sm">Din plassering</p>
            <p className="text-4xl font-black text-cyan-400">#{myRank.rank}</p>
            <p className="text-white font-bold text-lg">{myRank.score.toLocaleString()} poeng</p>
          </div>
        )}

        <div className="w-full max-w-sm">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div
              key={i}
              className={`flex items-center rounded-xl p-3 mb-2 ${entry.nickname === nickname ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-white/5 border border-white/10'
                }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${i === 0 ? 'bg-amber-400 text-amber-900' :
                i === 1 ? 'bg-slate-300 text-slate-700' :
                  i === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-white/10 text-slate-300'
                }`}>
                {entry.rank}
              </div>
              <div className="flex-1 text-white font-semibold">{entry.nickname}</div>
              <div className="text-cyan-400 font-bold">{entry.score.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-sm mt-6">Neste spørsmål kommer snart...</p>
      </div>
    );
  }

  // FINISHED
  if (phase === 'finished') {
    const myRank = leaderboard.find((e) => e.nickname === nickname);
    const winner = leaderboard[0];
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <p className="text-6xl mb-4">🏆</p>
          <h2 className="text-3xl font-black text-white mb-2">Spillet er over!</h2>
          {winner && (
            <p className="text-xl text-cyan-400 font-bold mb-6">
              Vinner: {winner.nickname}
            </p>
          )}

          {myRank && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 w-full max-w-sm">
              <p className="text-slate-400 text-sm">Ditt resultat</p>
              <p className="text-5xl font-black text-cyan-400 mb-1">#{myRank.rank}</p>
              <p className="text-white font-bold text-xl">{myRank.score.toLocaleString()} poeng</p>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/'}
            className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Spill igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sw-gradient flex items-center justify-center">
      <div className="text-slate-300 text-xl">Laster...</div>
    </div>
  );
}
