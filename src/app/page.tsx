'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pin.trim();
    if (trimmed.length < 4) {
      setError('Skriv inn en gyldig PIN-kode');
      return;
    }
    router.push(`/play/${trimmed}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sw-gradient px-4 relative">
      {/* Auth corner */}
      <div className="absolute top-4 right-4 animate-fade-in-up">
        {status === 'loading' ? null : session ? (
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full ring-2 ring-indigo-400/30"
              />
            )}
            <span className="text-slate-300 text-sm hidden sm:inline">
              {session.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-slate-500 hover:text-white text-sm transition-colors"
            >
              Logg ut
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="text-slate-400 hover:text-white text-sm transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10"
          >
            Logg inn
          </button>
        )}
      </div>

      <div className="animate-fade-in-up text-center mb-12">
        <h1 className="text-6xl sm:text-8xl font-black text-white tracking-tight mb-3">
          say<span className="text-cyan-400">what</span>
        </h1>
        <p className="text-slate-400 text-lg">Lag og spill quizzer i sanntid</p>
      </div>

      <div className="w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <form onSubmit={handleJoin} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-center text-slate-300 font-semibold text-lg mb-4">Bli med i et spill</h2>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Game PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(''); }}
            className="w-full text-center text-2xl font-bold py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all mb-3"
            maxLength={6}
          />
          {error && <p className="text-rose-400 text-sm text-center mb-2">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl text-lg transition-colors"
          >
            Bli med
          </button>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={() => router.push('/create')}
          className="bg-white/5 hover:bg-white/10 text-slate-200 font-semibold py-3 px-8 rounded-xl text-lg transition-colors border border-white/10 hover:border-white/20"
        >
          Opprett quiz
        </button>
        <button
          onClick={() => router.push('/explore')}
          className="bg-white/5 hover:bg-white/10 text-slate-200 font-semibold py-3 px-8 rounded-xl text-lg transition-colors border border-white/10 hover:border-white/20"
        >
          Utforsk
        </button>
        {session && (
          <button
            onClick={() => router.push('/library')}
            className="bg-white/5 hover:bg-white/10 text-slate-200 font-semibold py-3 px-8 rounded-xl text-lg transition-colors border border-white/10 hover:border-white/20"
          >
            Mine quizzer
          </button>
        )}
      </div>
    </div>
  );
}
