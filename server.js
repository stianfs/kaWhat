const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory game store (duplicated logic from gameStore for server-side JS)
const { v4: uuidv4 } = require('uuid');

const games = new Map();

function generatePin() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games.has(pin));
  return pin;
}

function createGame(quiz) {
  const pin = generatePin();
  const game = {
    id: uuidv4(),
    pin,
    quiz,
    players: new Map(),
    state: 'lobby',
    currentQuestionIndex: -1,
    answers: new Map(),
    questionStartTime: 0,
    timers: {},
  };
  games.set(pin, game);
  return game;
}

function getGameByPin(pin) {
  return games.get(pin);
}

function getGameById(id) {
  for (const game of games.values()) {
    if (game.id === id) return game;
  }
  return undefined;
}

function addPlayer(pin, socketId, nickname) {
  const game = games.get(pin);
  if (!game || game.state !== 'lobby') return null;
  const existing = Array.from(game.players.values()).find(
    (p) => p.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (existing) return null;
  const player = { id: socketId, nickname, score: 0, streak: 0 };
  game.players.set(socketId, player);
  return player;
}

function removePlayer(game, socketId) {
  game.players.delete(socketId);
}

function getPlayerList(game) {
  return Array.from(game.players.values()).map((p) => p.nickname);
}

function startNextQuestion(game) {
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

function submitAnswer(game, socketId, answerIndex) {
  if (game.state !== 'question') return null;
  if (game.answers.has(socketId)) return null;
  const player = game.players.get(socketId);
  if (!player) return null;

  const question = game.quiz.questions[game.currentQuestionIndex];
  const timeMs = Date.now() - game.questionStartTime;
  const timeLimitMs = question.timeLimit * 1000;

  if (timeMs > timeLimitMs + 1000) return null;

  game.answers.set(socketId, { playerId: socketId, answerIndex, timeMs });

  const correct = answerIndex === question.correctIndex;
  if (correct) {
    player.streak += 1;
    const timeBonus = Math.max(0, 1 - timeMs / timeLimitMs);
    const streakBonus = Math.min(player.streak, 5) * 0.1;
    const points = Math.round(1000 * (0.5 + 0.5 * timeBonus) * (1 + streakBonus));
    player.score += points;
    return { correct: true, correctIndex: question.correctIndex, score: points, totalScore: player.score, streak: player.streak };
  } else {
    player.streak = 0;
    return { correct: false, correctIndex: question.correctIndex, score: 0, totalScore: player.score, streak: 0 };
  }
}

function getQuestionResults(game) {
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

function getLeaderboard(game) {
  const players = Array.from(game.players.values());
  players.sort((a, b) => b.score - a.score);
  return players.map((p, i) => ({ nickname: p.nickname, score: p.score, rank: i + 1 }));
}

// Socket-to-game mapping
const socketGameMap = new Map(); // socketId -> { pin, role }

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Host creates a game
    socket.on('create-game', (quiz, callback) => {
      try {
        const game = createGame(quiz);
        socket.join(game.pin);
        socketGameMap.set(socket.id, { pin: game.pin, role: 'host' });
        callback({ success: true, gameId: game.id, pin: game.pin });
        console.log(`Game created: PIN=${game.pin}, title="${quiz.title}"`);
      } catch (err) {
        callback({ success: false, error: 'Failed to create game' });
      }
    });

    // Player joins a game
    socket.on('join-game', ({ pin, nickname }, callback) => {
      try {
        const game = getGameByPin(pin);
        if (!game) {
          callback({ success: false, error: 'Spill ikke funnet. Sjekk PIN-koden.' });
          return;
        }
        if (game.state !== 'lobby') {
          callback({ success: false, error: 'Spillet har allerede startet.' });
          return;
        }
        const player = addPlayer(pin, socket.id, nickname);
        if (!player) {
          callback({ success: false, error: 'Kallenavnet er allerede tatt.' });
          return;
        }

        socket.join(pin);
        socketGameMap.set(socket.id, { pin, role: 'player' });
        callback({ success: true, gameId: game.id });

        // Notify host
        io.to(pin).emit('player-joined', {
          players: getPlayerList(game),
          count: game.players.size,
        });
        console.log(`Player "${nickname}" joined game PIN=${pin}`);
      } catch (err) {
        callback({ success: false, error: 'Kunne ikke bli med i spillet.' });
      }
    });

    // Host starts the game / next question
    socket.on('start-game', (callback) => {
      const mapping = socketGameMap.get(socket.id);
      if (!mapping || mapping.role !== 'host') {
        if (callback) callback({ success: false, error: 'Not authorized' });
        return;
      }
      const game = getGameByPin(mapping.pin);
      if (!game) {
        if (callback) callback({ success: false, error: 'Game not found' });
        return;
      }

      const hasNext = startNextQuestion(game);
      if (!hasNext) {
        game.state = 'finished';
        io.to(mapping.pin).emit('game-over', { leaderboard: getLeaderboard(game) });
        if (callback) callback({ success: true, finished: true });
        return;
      }

      const q = game.quiz.questions[game.currentQuestionIndex];
      io.to(mapping.pin).emit('question', {
        index: game.currentQuestionIndex,
        total: game.quiz.questions.length,
        question: q.question,
        options: q.options,
        timeLimit: q.timeLimit,
      });

      // Auto-end question after time limit
      if (game.timers.questionTimer) clearTimeout(game.timers.questionTimer);
      game.timers.questionTimer = setTimeout(() => {
        if (game.state === 'question') {
          game.state = 'results';
          const results = getQuestionResults(game);
          io.to(mapping.pin).emit('question-results', results);

          // Also send individual results to players who didn't answer
          for (const [sid, player] of game.players) {
            if (!game.answers.has(sid)) {
              io.to(sid).emit('answer-result', {
                correct: false,
                correctIndex: q.correctIndex,
                score: 0,
                totalScore: player.score,
                streak: 0,
                timedOut: true,
              });
            }
          }
        }
      }, (q.timeLimit + 1) * 1000);

      if (callback) callback({ success: true, finished: false });
    });

    // Player submits answer
    socket.on('answer', ({ answerIndex }, callback) => {
      const mapping = socketGameMap.get(socket.id);
      if (!mapping || mapping.role !== 'player') {
        if (callback) callback({ success: false });
        return;
      }
      const game = getGameByPin(mapping.pin);
      if (!game) {
        if (callback) callback({ success: false });
        return;
      }

      const result = submitAnswer(game, socket.id, answerIndex);
      if (!result) {
        if (callback) callback({ success: false });
        return;
      }

      // Send result back to the player
      socket.emit('answer-result', result);

      // Notify host of answer count
      io.to(mapping.pin).emit('answer-count', {
        count: game.answers.size,
        total: game.players.size,
      });

      // If all players have answered, auto-show results
      if (game.answers.size >= game.players.size) {
        if (game.timers.questionTimer) clearTimeout(game.timers.questionTimer);
        game.state = 'results';
        const results = getQuestionResults(game);
        io.to(mapping.pin).emit('question-results', results);
      }

      if (callback) callback({ success: true });
    });

    // Host requests leaderboard
    socket.on('show-leaderboard', (callback) => {
      const mapping = socketGameMap.get(socket.id);
      if (!mapping || mapping.role !== 'host') return;
      const game = getGameByPin(mapping.pin);
      if (!game) return;

      game.state = 'leaderboard';
      const leaderboard = getLeaderboard(game);
      io.to(mapping.pin).emit('leaderboard', { leaderboard });
      if (callback) callback({ success: true });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const mapping = socketGameMap.get(socket.id);
      if (mapping) {
        const game = getGameByPin(mapping.pin);
        if (game) {
          if (mapping.role === 'player') {
            removePlayer(game, socket.id);
            io.to(mapping.pin).emit('player-joined', {
              players: getPlayerList(game),
              count: game.players.size,
            });
          }
        }
        socketGameMap.delete(socket.id);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> kaWhat ready on http://${hostname}:${port}`);
  });
});
