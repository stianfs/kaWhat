import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listPublicQuizzes, listQuizzesByUser, createQuiz } from '@/lib/quizRepo';

// GET /api/quizzes?scope=public|mine&search=...
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope') || 'mine';
  const search = req.nextUrl.searchParams.get('search') || '';

  if (scope === 'public') {
    const quizzes = listPublicQuizzes(search || undefined);
    return NextResponse.json(quizzes);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id!;
  const quizzes = listQuizzesByUser(userId);
  return NextResponse.json(quizzes);
}

// POST /api/quizzes — create a new saved quiz (public if not logged in)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  const userName = session?.user?.name || undefined;

  const body = await req.json();
  const { title, questions } = body;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Tittel og minst ett spørsmål er påkrevd.' }, { status: 400 });
  }

  const isPublic = !userId || body.isPublic === true;

  const quiz = createQuiz({ userId, userName, isPublic, title, questions });
  return NextResponse.json(quiz, { status: 201 });
}
