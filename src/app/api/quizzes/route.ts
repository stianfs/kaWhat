import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

// GET /api/quizzes — list quizzes for the logged-in user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const quizzes = readQuizzes().filter((q) => q.userId === userId);
  quizzes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return NextResponse.json(quizzes);
}

// POST /api/quizzes — create a new saved quiz
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id!;
  const userName = session.user.name || undefined;

  const body = await req.json();
  const { title, questions } = body;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Tittel og minst ett spørsmål er påkrevd.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const quiz: SavedQuiz = {
    id: uuidv4(),
    userId,
    userName,
    title,
    questions,
    createdAt: now,
    updatedAt: now,
  };

  const quizzes = readQuizzes();
  quizzes.push(quiz);
  writeQuizzes(quizzes);

  return NextResponse.json(quiz, { status: 201 });
}
