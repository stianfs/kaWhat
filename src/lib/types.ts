export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  timeLimit: number; // seconds
}

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export interface SavedQuiz {
  id: string;
  userId?: string;
  userName?: string;
  isPublic: boolean;
  title: string;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  id: string; // socket id
  nickname: string;
  score: number;
  streak: number;
}

export interface PlayerAnswer {
  playerId: string;
  answerIndex: number;
  timeMs: number; // how fast they answered in ms
}

export interface Game {
  id: string;
  pin: string;
  quiz: Quiz;
  players: Map<string, Player>;
  state: GameState;
  currentQuestionIndex: number;
  answers: Map<string, PlayerAnswer>; // answers for current question
  questionStartTime: number;
}

export type GameState = 'lobby' | 'question' | 'results' | 'leaderboard' | 'finished';

export interface QuestionResultsData {
  correctIndex: number;
  answerCounts: number[]; // count per option
  totalAnswers: number;
  totalPlayers: number;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  rank: number;
}

export interface AnswerResultData {
  correct: boolean;
  correctIndex: number;
  score: number;
  totalScore: number;
  streak: number;
}
