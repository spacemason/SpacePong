const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

// In-memory cache
let matches = [];
let players = {};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load data synchronously on startup
function loadData() {
  try {
    matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf-8'));
  } catch {
    matches = [];
  }
  try {
    players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
  } catch {
    players = {};
  }
}

loadData();

// Async flush helpers
function flushMatches() {
  fs.writeFile(MATCHES_FILE, JSON.stringify(matches, null, 2), (err) => {
    if (err) console.error('Failed to write matches.json:', err);
  });
}

function flushPlayers() {
  fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2), (err) => {
    if (err) console.error('Failed to write players.json:', err);
  });
}

// --- Player operations ---

function getPlayers() {
  return { ...players };
}

function getPlayer(username) {
  if (!players[username]) {
    players[username] = { username, wins: 0, losses: 0, gamesPlayed: 0 };
    flushPlayers();
  }
  return { ...players[username] };
}

function updatePlayer(username, won) {
  if (!players[username]) {
    players[username] = { username, wins: 0, losses: 0, gamesPlayed: 0 };
  }
  if (won) {
    players[username].wins++;
  } else {
    players[username].losses++;
  }
  players[username].gamesPlayed++;
  flushPlayers();
}

// --- Match operations ---

function addMatch(match) {
  // match: { id, player1, player2, score1, score2, winner, timestamp, duration, disconnected }
  matches.push(match);
  flushMatches();
}

function getMatches(limit = 50) {
  return matches
    .slice()
    .reverse()
    .slice(0, limit);
}

function getMatchesForPlayer(username, limit = 50) {
  return matches
    .slice()
    .reverse()
    .filter((m) => m.player1 === username || m.player2 === username)
    .slice(0, limit);
}

// --- Leaderboard ---

function getLeaderboard(sortBy = 'wins') {
  const list = Object.values(players).map((p) => ({
    ...p,
    winRate: p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0
  }));

  if (sortBy === 'winRate') {
    list.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  } else {
    list.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
  }

  return list;
}

module.exports = {
  getPlayers,
  getPlayer,
  updatePlayer,
  addMatch,
  getMatches,
  getMatchesForPlayer,
  getLeaderboard
};
