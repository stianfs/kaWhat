import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQuizById, updateQuiz, deleteQuiz } from '@/lib/quizRepo';

async function getAuthUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as { id?: string }).id || null;
}

// GET /api/quizzes/[id] — get a single quiz (public or own)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const quiz = getQuizById(params.id);
  if (!quiz) {
    return NextResponse.json({ error: 'Quiz ikke funnet.' }, { status: 404 });
  }

  if (quiz.isPublic) {
    return NextResponse.json(quiz);
  }

  const userId = await getAuthUserId();
  if (!userId || quiz.userId !== userId) {
    return NextResponse.json({ error: 'Quiz ikke funnet.' }, { status: 404 });
  }
  return NextResponse.json(quiz);
}

// PUT /api/quizzes/[id] — update a saved quiz
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 });
  }

  const body = await req.json();
  const { title, questions } = body;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Tittel og minst ett spørsmål er påkrevd.' }, { status: 400 });
  }

  const updated = updateQuiz(params.id, userId, { title, questions });
  if (!updated) {
    return NextResponse.json({ error: 'Quiz ikke funnet.' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/quizzes/[id] — delete a saved quiz
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 });
  }

  const deleted = deleteQuiz(params.id, userId);
  if (!deleted) {
    return NextResponse.json({ error: 'Quiz ikke funnet.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
