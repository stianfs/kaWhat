'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  return (
    <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-5xl sm:text-7xl font-extrabold text-white tracking-tight mb-2">
          ka<span className="text-yellow-300">What</span>
        </h1>
        <p className="text-white/70 text-lg">Logg inn for å lage og administrere quizzer</p>
      </div>

      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-center text-gray-700 font-bold text-lg mb-6">Logg inn</h2>

        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Logg inn med Google
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Du trenger kun å logge inn for å opprette og lagre quizzer. Deltakere trenger ikke å logge inn.
        </p>
      </div>

      <button
        onClick={() => (window.location.href = '/')}
        className="mt-6 text-white/50 hover:text-white/80 text-sm transition-colors animate-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
        ← Tilbake til forsiden
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
