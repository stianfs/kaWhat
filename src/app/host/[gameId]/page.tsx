'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { QRCodeSVG } from 'qrcode.react';
import { QuestionResultsData, LeaderboardEntry } from '@/lib/types';

type GamePhase = 'lobby' | 'question' | 'results' | 'leaderboard' | 'finished';

interface QuestionData {
  index: number;
  total: number;
  question: string;
  options: string[];
  timeLimit: number;
}

export default function HostPage() {
  const params = useParams();
  const pin = params.gameId as string;
  const socket = useSocket();

  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [players, setPlayers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [answerCount, setAnswerCount] = useState({ count: 0, total: 0 });
  const [questionResults, setQuestionResults] = useState<QuestionResultsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);

  // Try to rejoin as host on mount (handles page refresh)
  useEffect(() => {
    socket.emit('rejoin-host', { pin }, (res: {
      success: boolean; state?: {
        phase: GamePhase;
        players: string[];
        playerCount: number;
        question?: QuestionData;
        answerCount?: { count: number; total: number };
        questionResults?: QuestionResultsData;
        leaderboard?: LeaderboardEntry[];
      }
    }) => {
      if (res.success && res.state) {
        setPlayers(res.state.players || []);
        setPhase(res.state.phase);
        if (res.state.question) {
          setCurrentQuestion(res.state.question);
          setTimeLeft(res.state.question.timeLimit);
        }
        if (res.state.answerCount) {
          setAnswerCount(res.state.answerCount);
        }
        if (res.state.questionResults) {
          setQuestionResults(res.state.questionResults);
        }
        if (res.state.leaderboard) {
          setLeaderboard(res.state.leaderboard);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    socket.on('player-joined', (data: { players: string[]; count: number }) => {
      setPlayers(data.players);
    });

    socket.on('question', (data: QuestionData) => {
      setPhase('question');
      setCurrentQuestion(data);
      setAnswerCount({ count: 0, total: 0 });
      setQuestionResults(null);
      setTimeLeft(data.timeLimit);
    });

    socket.on('answer-count', (data: { count: number; total: number }) => {
      setAnswerCount(data);
    });

    socket.on('question-results', (data: QuestionResultsData) => {
      setPhase('results');
      setQuestionResults(data);
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
      socket.off('answer-count');
      socket.off('question-results');
      socket.off('leaderboard');
      socket.off('game-over');
    };
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

  const handleStartGame = useCallback(() => {
    socket.emit('start-game', () => {
      // handled by events
    });
  }, [socket]);

  const handleNextQuestion = useCallback(() => {
    socket.emit('start-game', () => {
      // handled by events
    });
  }, [socket]);

  const handleShowLeaderboard = useCallback(() => {
    socket.emit('show-leaderboard', () => { });
  }, [socket]);

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/${pin}` : '';

  const PinBadge = () => (
    <div className="fixed top-3 left-3 z-50 bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 border border-white/10">
      <span className="text-slate-400 text-xs">PIN:</span>
      <span className="text-cyan-400 font-bold text-sm tracking-wider">{pin}</span>
    </div>
  );

  const optionColors = ['bg-rose-500', 'bg-indigo-500', 'bg-amber-500', 'bg-emerald-500'];
  const optionShapes = ['A', 'B', 'C', 'D'];

  // LOBBY
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">
            say<span className="text-cyan-400">what</span>
          </h1>
          <p className="text-slate-400 text-sm">Venter på spillere...</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8 text-center animate-fade-in-up max-w-md w-full">
          <p className="text-slate-400 text-sm mb-1">Game PIN:</p>
          <p className="text-5xl font-black text-cyan-400 tracking-widest mb-6">{pin}</p>

          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-xl">
              {joinUrl && <QRCodeSVG value={joinUrl} size={180} level="M" />}
            </div>
          </div>
          <p className="text-xs text-slate-500">Skann QR-koden eller gå til URL-en nedenfor</p>
          <p className="text-xs text-indigo-400 font-mono mt-1 break-all">{joinUrl}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 w-full max-w-md mb-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-200 font-bold">Spillere</h2>
            <span className="bg-indigo-500/20 text-indigo-300 text-sm px-3 py-1 rounded-full font-bold">
              {players.length}
            </span>
          </div>
          {players.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Ingen spillere ennå...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((name, i) => (
                <span
                  key={i}
                  className="bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-full text-sm font-semibold animate-slide-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleStartGame}
          disabled={players.length === 0}
          className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 px-12 rounded-xl text-xl transition-all shadow-lg animate-pulse-glow"
        >
          Start! ({players.length} spillere)
        </button>
      </div>
    );
  }

  // QUESTION
  if (phase === 'question' && currentQuestion) {
    const timerPercent = currentQuestion.timeLimit > 0 ? (timeLeft / currentQuestion.timeLimit) * 100 : 0;
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col">
        <PinBadge />
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-slate-400 text-sm">
            {currentQuestion.index + 1} / {currentQuestion.total}
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-4xl font-black ${timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
              {timeLeft}
            </div>
          </div>
          <div className="text-slate-400 text-sm">
            {answerCount.count} / {answerCount.total || players.length} svar
          </div>
        </div>

        {/* Timer bar */}
        <div className="w-full h-1.5 bg-white/5">
          <div
            className="h-full bg-cyan-400 transition-all duration-1000 ease-linear"
            style={{ width: `${timerPercent}%` }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8 max-w-2xl w-full">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white">
              {currentQuestion.question}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
            {currentQuestion.options.map((opt, i) => (
              <div
                key={i}
                className={`${optionColors[i]} rounded-xl p-6 text-white font-bold text-lg sm:text-xl text-center shadow-lg`}
              >
                <span className="mr-2 opacity-60">{optionShapes[i]}</span> {opt}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // RESULTS
  if (phase === 'results' && questionResults && currentQuestion) {
    const maxCount = Math.max(...questionResults.answerCounts, 1);
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <PinBadge />
        <h2 className="text-3xl font-bold text-white mb-2">{currentQuestion.question}</h2>
        <p className="text-slate-400 mb-8">
          {questionResults.totalAnswers} av {questionResults.totalPlayers} svarte
        </p>

        <div className="w-full max-w-2xl mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentQuestion.options.map((opt, i) => {
              const isCorrect = i === questionResults.correctIndex;
              const count = questionResults.answerCounts[i] || 0;
              const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div
                  key={i}
                  className={`${optionColors[i]} rounded-xl p-4 text-white relative overflow-hidden ${isCorrect ? 'ring-4 ring-cyan-400' : 'opacity-50'
                    }`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <span className="font-bold">
                      {optionShapes[i]} {opt}
                    </span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                      {count}
                    </span>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-white/30"
                    style={{ width: `${barWidth}%` }}
                  />
                  {isCorrect && (
                    <span className="absolute top-2 right-2 text-2xl">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleShowLeaderboard}
            className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Vis poengtavle
          </button>
          <button
            onClick={handleNextQuestion}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Neste spørsmål →
          </button>
        </div>
      </div>
    );
  }

  // LEADERBOARD
  if (phase === 'leaderboard') {
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <PinBadge />
        <h2 className="text-4xl font-black text-white mb-8">Poengtavle</h2>

        <div className="w-full max-w-lg">
          {leaderboard.slice(0, 10).map((entry, i) => (
            <div
              key={i}
              className="flex items-center bg-white/5 border border-white/10 rounded-xl p-4 mb-3 animate-slide-in"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${i === 0 ? 'bg-amber-400 text-amber-900' :
                i === 1 ? 'bg-slate-300 text-slate-700' :
                  i === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-white/10 text-slate-300'
                }`}>
                {entry.rank}
              </div>
              <div className="flex-1 text-white font-semibold text-lg">{entry.nickname}</div>
              <div className="text-cyan-400 font-bold text-xl">{entry.score.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleNextQuestion}
          className="mt-8 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-12 rounded-xl text-xl transition-colors shadow-lg"
        >
          Neste spørsmål →
        </button>
      </div>
    );
  }

  // FINISHED
  if (phase === 'finished') {
    const winner = leaderboard[0];
    return (
      <div className="min-h-screen bg-sw-gradient flex flex-col items-center justify-center px-4">
        <PinBadge />
        <div className="text-center mb-8 animate-fade-in-up">
          <p className="text-6xl mb-4">🏆</p>
          <h2 className="text-4xl font-black text-white mb-2">Quizzen er ferdig!</h2>
          {winner && (
            <p className="text-2xl text-cyan-400 font-bold">
              Vinner: {winner.nickname} ({winner.score.toLocaleString()} poeng)
            </p>
          )}
        </div>

        <div className="w-full max-w-lg mb-8">
          {leaderboard.map((entry, i) => (
            <div
              key={i}
              className="flex items-center bg-white/5 border border-white/10 rounded-xl p-4 mb-3 animate-slide-in"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${i === 0 ? 'bg-amber-400 text-amber-900' :
                i === 1 ? 'bg-slate-300 text-slate-700' :
                  i === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-white/10 text-slate-300'
                }`}>
                {entry.rank}
              </div>
              <div className="flex-1 text-white font-semibold text-lg">{entry.nickname}</div>
              <div className="text-cyan-400 font-bold text-xl">{entry.score.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <button
          onClick={() => window.location.href = '/'}
          className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-8 rounded-xl transition-colors"
        >
          Tilbake til forsiden
        </button>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-sw-gradient flex items-center justify-center">
      <div className="text-slate-300 text-xl">Laster...</div>
    </div>
  );
}
