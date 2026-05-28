// ============================================================
// lobbyManager.js - The Waiting Room Manager
// ============================================================
// Before players start a game, they hang out in a "lobby" --
// like a waiting room. This file keeps track of:
//
// - WHO is online (a list of connected players)
// - WHAT they're doing (idle, in-game, or spectating)
// - THE CHALLENGE SYSTEM: When Player A wants to play Player B,
//   they send a "challenge" (like raising your hand and saying
//   "Wanna play?"). Player B can accept or decline. If nobody
//   responds for 30 seconds, the challenge expires automatically.
//
// Think of this like the front desk at a bowling alley -- it
// knows who's here, who's waiting, and who's already playing.
// ============================================================

// crypto helps us create unique IDs for challenges.
const crypto = require('crypto');

// "connectedPlayers" is a Map (like a dictionary) that stores every
// online player. The key is their socket ID, and the value has their
// username, status (idle/in-game/spectating), and socket ID.
const connectedPlayers = new Map();

// "pendingChallenges" stores challenge invitations that haven't been
// accepted or declined yet. Each one knows who sent it and who it's for.
const pendingChallenges = new Map();

// Add a new player to the lobby when they pick a username and join.
// Returns false if someone else already has that username.
function addPlayer(socketId, username) {
  // Check if username is already taken by another socket
  for (const [sid, player] of connectedPlayers) {
    if (player.username === username && sid !== socketId) {
      return false;
    }
  }
  connectedPlayers.set(socketId, { username, status: 'idle', socketId });
  return true;
}

// Remove a player when they disconnect.
// Also cleans up any challenges they were involved in.
function removePlayer(socketId) {
  const player = connectedPlayers.get(socketId);
  if (!player) return null;
  connectedPlayers.delete(socketId);

  // Clean up any challenges involving this player
  // (no point keeping a challenge if one person left!)
  for (const [id, challenge] of pendingChallenges) {
    if (challenge.from === socketId || challenge.to === socketId) {
      pendingChallenges.delete(id);
    }
  }

  return player.username;
}

// Look up a player by their socket ID.
function getPlayer(socketId) {
  return connectedPlayers.get(socketId) || null;
}

// Look up a player by their username (searches through everyone).
function getPlayerByUsername(username) {
  for (const player of connectedPlayers.values()) {
    if (player.username === username) {
      return player;
    }
  }
  return null;
}

// Change a player's status (like changing a sign on their desk
// from "Available" to "In a Game").
function setStatus(socketId, status) {
  const player = connectedPlayers.get(socketId);
  if (player) {
    player.status = status;
  }
}

// Get a list of all online players (sent to browsers so they
// can see who's in the lobby).
function getPlayerList() {
  const list = [];
  for (const player of connectedPlayers.values()) {
    list.push({ username: player.username, status: player.status, socketId: player.socketId });
  }
  return list;
}

// --- THE CHALLENGE SYSTEM ---

// Create a new challenge from one player to another.
// Both players must be "idle" (not already in a game).
// Returns a unique challenge ID, or null if it can't be created.
function createChallenge(fromSocketId, toSocketId) {
  const from = connectedPlayers.get(fromSocketId);
  const to = connectedPlayers.get(toSocketId);
  if (!from || !to) return null;
  if (from.status !== 'idle' || to.status !== 'idle') return null;

  const challengeId = crypto.randomUUID();
  pendingChallenges.set(challengeId, {
    from: fromSocketId,
    to: toSocketId,
    fromUsername: from.username,
    toUsername: to.username,
    timestamp: Date.now()
  });
  return challengeId;
}

// Look up a challenge by its ID.
function getChallenge(challengeId) {
  return pendingChallenges.get(challengeId) || null;
}

// Player B says "Yes!" -- remove the challenge from pending and return it
// so server.js can start the game.
function acceptChallenge(challengeId) {
  const challenge = pendingChallenges.get(challengeId);
  if (!challenge) return null;
  pendingChallenges.delete(challengeId);
  return challenge;
}

// Player B says "No thanks" -- remove the challenge from pending
// so server.js can tell Player A they were declined.
function declineChallenge(challengeId) {
  const challenge = pendingChallenges.get(challengeId);
  if (!challenge) return null;
  pendingChallenges.delete(challengeId);
  return challenge;
}

// Check for challenges that have been waiting longer than 30 seconds.
// If nobody responded in time, we expire them (throw them away)
// and return the list so server.js can notify both players.
function expireChallenges() {
  const now = Date.now();
  const expired = [];
  for (const [id, challenge] of pendingChallenges) {
    // 30000 milliseconds = 30 seconds
    if (now - challenge.timestamp > 30000) {
      expired.push({ id, ...challenge });
      pendingChallenges.delete(id);
    }
  }
  return expired;
}

module.exports = {
  addPlayer,
  removePlayer,
  getPlayer,
  getPlayerByUsername,
  setStatus,
  getPlayerList,
  createChallenge,
  getChallenge,
  acceptChallenge,
  declineChallenge,
  expireChallenges
};
