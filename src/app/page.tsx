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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#46178f] px-4 relative">
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
                className="rounded-full border-2 border-white/30"
              />
            )}
            <span className="text-white/80 text-sm hidden sm:inline">
              {session.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              Logg ut
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="text-white/70 hover:text-white text-sm transition-colors bg-white/10 px-4 py-2 rounded-lg"
          >
            Logg inn
          </button>
        )}
      </div>

      <div className="animate-fade-in-up text-center mb-12">
        <h1 className="text-6xl sm:text-8xl font-extrabold text-white tracking-tight mb-2">
          ka<span className="text-yellow-300">What</span>
        </h1>
        <p className="text-white/70 text-lg">Lag og spill quizzer i sanntid</p>
      </div>

      <div className="w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <form onSubmit={handleJoin} className="bg-white rounded-lg shadow-2xl p-6 mb-6">
          <h2 className="text-center text-gray-700 font-bold text-lg mb-4">Bli med i et spill</h2>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Game PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(''); }}
            className="w-full text-center text-2xl font-bold py-3 px-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#46178f] transition-colors mb-3"
            maxLength={6}
          />
          {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[#333] hover:bg-black text-white font-bold py-3 rounded-lg text-lg transition-colors"
          >
            Bli med!
          </button>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={() => router.push('/create')}
          className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors border-2 border-white/30"
        >
          Opprett ny quiz
        </button>
        <button
          onClick={() => router.push('/explore')}
          className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors border-2 border-white/30"
        >
          Utforsk quizzer 🌍
        </button>
        {session && (
          <button
            onClick={() => router.push('/library')}
            className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors border-2 border-white/30"
          >
            Mine quizzer 📚
          </button>
        )}
      </div>
    </div>
  );
}
