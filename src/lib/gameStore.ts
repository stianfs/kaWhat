import { Game, Player, PlayerAnswer, Quiz, QuestionResultsData, LeaderboardEntry, AnswerResultData } from './types';
import { v4 as uuidv4 } from 'uuid';

const games = new Map<string, Game>();

function generatePin(): string {
  let pin: string;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games.has(pin));
  return pin;
}

export function createGame(quiz: Quiz): Game {
  const pin = generatePin();
  const game: Game = {
    id: uuidv4(),
    pin,
    quiz,
    players: new Map(),
    state: 'lobby',
    currentQuestionIndex: -1,
    answers: new Map(),
    questionStartTime: 0,
  };
  games.set(pin, game);
  return game;
}

export function getGameByPin(pin: string): Game | undefined {
  return games.get(pin);
}

export function getGameById(id: string): Game | undefined {
  for (const game of games.values()) {
    if (game.id === id) return game;
  }
  return undefined;
}

export function addPlayer(pin: string, socketId: string, nickname: string): Player | null {
  const game = games.get(pin);
  if (!game || game.state !== 'lobby') return null;

  const existing = Array.from(game.players.values()).find(
    (p) => p.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (existing) return null;

  const player: Player = {
    id: socketId,
    nickname,
    score: 0,
    streak: 0,
  };
  game.players.set(socketId, player);
  return player;
}

export function removePlayer(pin: string, socketId: string): void {
  const game = games.get(pin);
  if (game) {
    game.players.delete(socketId);
  }
}

export function startNextQuestion(game: Game): boolean {
  const nextIndex = game.currentQuestionIndex + 1;
  if (nextIndex >= game.quiz.questions.length) {
    game.state = 'finished';
    return false;
  }
  game.currentQuestionIndex = nextIndex;
  game.state = 'question';
  game.answers = new Map();
  game.questionStartTime = Date.now();
  return true;
}

export function submitAnswer(game: Game, socketId: string, answerIndex: number): AnswerResultData | null {
  if (game.state !== 'question') return null;
  if (game.answers.has(socketId)) return null;

  const player = game.players.get(socketId);
  if (!player) return null;

  const question = game.quiz.questions[game.currentQuestionIndex];
  const timeMs = Date.now() - game.questionStartTime;
  const timeLimitMs = question.timeLimit * 1000;

  if (timeMs > timeLimitMs + 1000) return null; // grace period of 1s

  game.answers.set(socketId, {
    playerId: socketId,
    answerIndex,
    timeMs,
  });

  const correct = answerIndex === question.correctIndex;

  if (correct) {
    player.streak += 1;
    const timeBonus = Math.max(0, 1 - timeMs / timeLimitMs);
    const streakBonus = Math.min(player.streak, 5) * 0.1;
    const points = Math.round(1000 * (0.5 + 0.5 * timeBonus) * (1 + streakBonus));
    player.score += points;

    return {
      correct: true,
      correctIndex: question.correctIndex,
      score: points,
      totalScore: player.score,
      streak: player.streak,
    };
  } else {
    player.streak = 0;
    return {
      correct: false,
      correctIndex: question.correctIndex,
      score: 0,
      totalScore: player.score,
      streak: 0,
    };
  }
}

export function getQuestionResults(game: Game): QuestionResultsData {
  const question = game.quiz.questions[game.currentQuestionIndex];
  const answerCounts = new Array(question.options.length).fill(0);

  for (const answer of game.answers.values()) {
    if (answer.answerIndex >= 0 && answer.answerIndex < answerCounts.length) {
      answerCounts[answer.answerIndex]++;
    }
  }

  return {
    correctIndex: question.correctIndex,
    answerCounts,
    totalAnswers: game.answers.size,
    totalPlayers: game.players.size,
  };
}

export function getLeaderboard(game: Game): LeaderboardEntry[] {
  const players = Array.from(game.players.values());
  players.sort((a, b) => b.score - a.score);

  return players.map((p, i) => ({
    nickname: p.nickname,
    score: p.score,
    rank: i + 1,
  }));
}

export function deleteGame(pin: string): void {
  games.delete(pin);
}

export function getPlayerList(game: Game): string[] {
  return Array.from(game.players.values()).map((p) => p.nickname);
}
