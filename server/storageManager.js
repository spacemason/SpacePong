// ============================================================
// storageManager.js - The Save File Manager
// ============================================================
// When the server turns off and back on, we don't want to lose
// everyone's scores! This file handles SAVING data to files
// and LOADING it back when the server starts.
//
// HOW IT WORKS:
// We keep two things in memory (the computer's fast brain):
//   - "matches" = a list of all past games and their scores
//   - "players" = each player's wins, losses, and games played
//
// When something changes (like a game ends), we update the
// memory copy AND write it to a JSON file on the hard drive.
// JSON is a way to store data as text that both humans and
// computers can read -- it looks like { "name": "Mason", "wins": 5 }.
//
// When the server starts up, we read those files back into memory.
// This is like loading a save file in a video game!
// ============================================================

// "fs" stands for "file system" -- it lets us read and write files.
// "path" helps us build file paths that work on any computer.
const fs = require('fs');
const path = require('path');

// These are the file paths where we save our data.
// __dirname means "the folder THIS file is in" (the server folder).
const DATA_DIR = path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

// In-memory cache -- these are the "live" copies we read from and write to.
// They're super fast because they live in RAM (the computer's short-term memory).
let matches = [];
let players = {};

// Make sure the "data" folder exists. If not, create it.
// (The first time the server runs, there won't be a data folder yet.)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load saved data from the JSON files when the server starts up.
// "try/catch" means: try to read the file, but if it fails
// (maybe the file doesn't exist yet), just start with empty data.
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

// Load data right away when this file first runs.
loadData();

// --- Flush helpers ---
// "Flushing" means writing the in-memory data to the hard drive.
// We use writeFile (async) so the server doesn't freeze while saving.
// If writing fails, we log an error but keep going.
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

// Get a copy of all players' data.
function getPlayers() {
  return { ...players };
}

// Get one player's data. If they don't exist yet, create a fresh
// entry with 0 wins, 0 losses, and 0 games played.
function getPlayer(username) {
  if (!players[username]) {
    players[username] = { username, wins: 0, losses: 0, gamesPlayed: 0 };
    flushPlayers();
  }
  return { ...players[username] };
}

// Update a player's stats after a game ends.
// "won" is true or false -- did they win?
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

// Save a completed match to our records.
function addMatch(match) {
  // match: { id, player1, player2, score1, score2, winner, timestamp, duration, disconnected }
  matches.push(match);
  flushMatches();
}

// Get the most recent matches (newest first).
// .slice() makes a copy, .reverse() puts newest first,
// then we take only the first "limit" entries.
function getMatches(limit = 50) {
  return matches
    .slice()
    .reverse()
    .slice(0, limit);
}

// Get matches for one specific player (filter by their username).
function getMatchesForPlayer(username, limit = 50) {
  return matches
    .slice()
    .reverse()
    .filter((m) => m.player1 === username || m.player2 === username)
    .slice(0, limit);
}

// --- Leaderboard ---
// Build a ranked list of players sorted by wins (or win rate).
// "winRate" is the percentage of games they won: wins / total games.
function getLeaderboard(sortBy = 'wins') {
  const list = Object.values(players).map((p) => ({
    ...p,
    winRate: p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0
  }));

  // Sort the list so the best players are first.
  // If two players have the same wins, we use win rate as a tiebreaker.
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
