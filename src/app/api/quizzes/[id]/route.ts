import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs';
import path from 'path';
import { SavedQuiz } from '@/lib/types';
import { authOptions } from '@/lib/auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(QUIZZES_FILE)) {
    fs.writeFileSync(QUIZZES_FILE, '[]', 'utf-8');
  }
}

function readQuizzes(): SavedQuiz[] {
  ensureDataDir();
  const raw = fs.readFileSync(QUIZZES_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeQuizzes(quizzes: SavedQuiz[]) {
  ensureDataDir();
  fs.writeFileSync(QUIZZES_FILE, JSON.stringify(quizzes, null, 2), 'utf-8');
}

async function getAuthUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as { id?: string }).id || null;
}

// GET /api/quizzes/[id] — get a single quiz (public or own)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const quizzes = readQuizzes();
  const quiz = quizzes.find((q) => q.id === params.id);
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

  const quizzes = readQuizzes();
  const index = quizzes.findIndex((q) => q.id === params.id && q.userId === userId);
  if (index === -1) {
    return NextResponse.json({ error: 'Quiz ikke funnet.' }, { status: 404 });
  }

  quizzes[index] = {
    ...quizzes[index],
    title,
    questions,
    updatedAt: new Date().toISOString(),
  };
  writeQuizzes(quizzes);

  return NextResponse.json(quizzes[index]);
}

// DELETE /api/quizzes/[id] — delete a saved quiz
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 });
  }

  const quizzes = readQuizzes();
  const index = quizzes.findIndex((q) => q.id === params.id && q.userId === userId);
  if (index === -1) {
    return NextResponse.json({ error: 'Quiz ikke funnet.' }, { status: 404 });
  }

  quizzes.splice(index, 1);
  writeQuizzes(quizzes);

  return NextResponse.json({ success: true });
}
