const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory game store
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
    hostSocketId: null,        // current host socket id
    players: new Map(),       // visibleId -> player (visibleId = current socketId)
    nickToPlayer: new Map(),   // lowercase nickname -> player reference
    state: 'lobby',
    currentQuestionIndex: -1,
    answers: new Map(),        // visibleId -> answer
    questionStartTime: 0,
    timers: {},
  };
  games.set(pin, game);
  return game;
}

function getGameByPin(pin) {
  return games.get(pin);
}

function addPlayer(game, socketId, nickname) {
  if (game.state !== 'lobby') return null;
  const nickLower = nickname.toLowerCase();
  if (game.nickToPlayer.has(nickLower)) return null;
  const player = { id: socketId, nickname, score: 0, streak: 0, connected: true };
  game.players.set(socketId, player);
  game.nickToPlayer.set(nickLower, player);
  return player;
}

// Reconnect: find disconnected player by nickname, reassign to new socketId
function reconnectPlayer(game, socketId, nickname) {
  const nickLower = nickname.toLowerCase();
  const player = game.nickToPlayer.get(nickLower);
  if (!player) return null;
  if (player.connected) return null; // already connected with another socket

  // Remove old socketId mapping
  game.players.delete(player.id);
  // Also remove old socketId from answers if present (keep answer data)

  // Update to new socketId
  player.id = socketId;
  player.connected = true;
  game.players.set(socketId, player);
  return player;
}

function getConnectedPlayers(game) {
  return Array.from(game.players.values()).filter((p) => p.connected);
}

function getAllPlayers(game) {
  return Array.from(game.players.values());
}

function getPlayerList(game) {
  return Array.from(game.players.values()).map((p) => ({
    nickname: p.nickname,
    connected: p.connected,
  }));
}

function getPlayerNicknames(game) {
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
  if (!player || !player.connected) return null;

  const question = game.quiz.questions[game.currentQuestionIndex];
  const timeMs = Date.now() - game.questionStartTime;
  const timeLimitMs = question.timeLimit * 1000;

  if (timeMs > timeLimitMs + 2000) return null; // 2s grace for network lag

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
    totalPlayers: getAllPlayers(game).length,
  };
}

function getLeaderboard(game) {
  const players = getAllPlayers(game);
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
    pingInterval: 10000,   // ping every 10s (default 25s)
    pingTimeout: 30000,    // wait 30s before considering disconnected (default 20s)
    maxHttpBufferSize: 1e6,
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Host creates a game
    socket.on('create-game', (quiz, callback) => {
      try {
        const game = createGame(quiz);
        game.hostSocketId = socket.id;
        socket.join(game.pin);
        socketGameMap.set(socket.id, { pin: game.pin, role: 'host' });
        callback({ success: true, gameId: game.id, pin: game.pin });
        console.log(`Game created: PIN=${game.pin}, title="${quiz.title}"`);
      } catch (err) {
        callback({ success: false, error: 'Failed to create game' });
      }
    });

    // Player joins a game (lobby only, new player)
    socket.on('join-game', ({ pin, nickname }, callback) => {
      try {
        const game = getGameByPin(pin);
        if (!game) {
          callback({ success: false, error: 'Spill ikke funnet. Sjekk PIN-koden.' });
          return;
        }

        // If game is in progress, try reconnect
        if (game.state !== 'lobby') {
          const player = reconnectPlayer(game, socket.id, nickname);
          if (player) {
            socket.join(pin);
            socketGameMap.set(socket.id, { pin, role: 'player' });
            callback({ success: true, gameId: game.id, reconnected: true, state: game.state });

            // Send current game state to reconnected player
            if (game.state === 'question') {
              const q = game.quiz.questions[game.currentQuestionIndex];
              const elapsed = Math.floor((Date.now() - game.questionStartTime) / 1000);
              const remaining = Math.max(0, q.timeLimit - elapsed);
              socket.emit('question', {
                index: game.currentQuestionIndex,
                total: game.quiz.questions.length,
                question: q.question,
                options: q.options,
                timeLimit: remaining,
              });
            } else if (game.state === 'results') {
              socket.emit('question-results', getQuestionResults(game));
            } else if (game.state === 'leaderboard') {
              socket.emit('leaderboard', { leaderboard: getLeaderboard(game) });
            }

            // Notify host of reconnection
            io.to(pin).emit('player-joined', {
              players: getPlayerNicknames(game),
              count: getAllPlayers(game).length,
            });
            console.log(`Player "${nickname}" reconnected to game PIN=${pin}`);
            return;
          }
          callback({ success: false, error: 'Spillet har allerede startet. Sjekk at du bruker samme kallenavn.' });
          return;
        }

        const player = addPlayer(game, socket.id, nickname);
        if (!player) {
          callback({ success: false, error: 'Kallenavnet er allerede tatt.' });
          return;
        }

        socket.join(pin);
        socketGameMap.set(socket.id, { pin, role: 'player' });
        callback({ success: true, gameId: game.id });

        // Notify host
        io.to(pin).emit('player-joined', {
          players: getPlayerNicknames(game),
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
        io.to(game.pin).emit('game-over', { leaderboard: getLeaderboard(game) });
        if (callback) callback({ success: true, finished: true });
        return;
      }

      const q = game.quiz.questions[game.currentQuestionIndex];
      const gamePin = game.pin; // capture pin for timer closure
      io.to(gamePin).emit('question', {
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
          io.to(gamePin).emit('question-results', results);

          // Send individual results to connected players who didn't answer
          for (const [sid, player] of game.players) {
            if (!game.answers.has(sid) && player.connected) {
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

      // Notify host of answer count — count vs connected players
      const connectedCount = getConnectedPlayers(game).length;
      io.to(game.pin).emit('answer-count', {
        count: game.answers.size,
        total: connectedCount,
      });

      // If all connected players have answered, auto-show results
      if (game.answers.size >= connectedCount) {
        if (game.timers.questionTimer) clearTimeout(game.timers.questionTimer);
        game.state = 'results';
        const results = getQuestionResults(game);
        io.to(game.pin).emit('question-results', results);
      }

      if (callback) callback({ success: true });
    });

    // Host reconnects after refresh
    socket.on('rejoin-host', ({ pin }, callback) => {
      try {
        const game = getGameByPin(pin);
        if (!game) {
          if (callback) callback({ success: false, error: 'Spill ikke funnet.' });
          return;
        }

        // Reclaim host role
        game.hostSocketId = socket.id;
        socket.join(pin);
        socketGameMap.set(socket.id, { pin, role: 'host' });

        // Build full state snapshot
        const state = {
          phase: game.state,
          players: getPlayerNicknames(game),
          playerCount: getAllPlayers(game).length,
          currentQuestionIndex: game.currentQuestionIndex,
          totalQuestions: game.quiz.questions.length,
        };

        if (game.state === 'question' && game.currentQuestionIndex >= 0) {
          const q = game.quiz.questions[game.currentQuestionIndex];
          const elapsed = Math.floor((Date.now() - game.questionStartTime) / 1000);
          const remaining = Math.max(0, q.timeLimit - elapsed);
          state.question = {
            index: game.currentQuestionIndex,
            total: game.quiz.questions.length,
            question: q.question,
            options: q.options,
            timeLimit: remaining,
          };
          state.answerCount = { count: game.answers.size, total: getConnectedPlayers(game).length };
        } else if (game.state === 'results' && game.currentQuestionIndex >= 0) {
          const q = game.quiz.questions[game.currentQuestionIndex];
          state.question = {
            index: game.currentQuestionIndex,
            total: game.quiz.questions.length,
            question: q.question,
            options: q.options,
            timeLimit: q.timeLimit,
          };
          state.questionResults = getQuestionResults(game);
        } else if (game.state === 'leaderboard' || game.state === 'finished') {
          state.leaderboard = getLeaderboard(game);
        }

        if (callback) callback({ success: true, state });
        console.log(`Host reconnected to game PIN=${pin}, phase=${game.state}`);
      } catch (err) {
        if (callback) callback({ success: false, error: 'Kunne ikke koble til spillet igjen.' });
      }
    });

    // Host requests leaderboard
    socket.on('show-leaderboard', (callback) => {
      const mapping = socketGameMap.get(socket.id);
      if (!mapping || mapping.role !== 'host') return;
      const game = getGameByPin(mapping.pin);
      if (!game) return;

      game.state = 'leaderboard';
      const leaderboard = getLeaderboard(game);
      io.to(game.pin).emit('leaderboard', { leaderboard });
      if (callback) callback({ success: true });
    });

    // Disconnect — mark player as disconnected, don't remove. Keep game alive for host reconnect.
    socket.on('disconnect', () => {
      const mapping = socketGameMap.get(socket.id);
      if (mapping) {
        const game = getGameByPin(mapping.pin);
        if (game) {
          if (mapping.role === 'player') {
            const player = game.players.get(socket.id);
            if (player) {
              player.connected = false;
              console.log(`Player "${player.nickname}" disconnected from PIN=${mapping.pin} (kept in game)`);
            }
            io.to(mapping.pin).emit('player-joined', {
              players: getPlayerNicknames(game),
              count: getAllPlayers(game).length,
            });
          } else if (mapping.role === 'host') {
            console.log(`Host disconnected from PIN=${mapping.pin} (game preserved for reconnect)`);
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
