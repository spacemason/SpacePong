const crypto = require('crypto');

// socketId -> { username, status, socketId }
const connectedPlayers = new Map();

// challengeId -> { from, to, fromUsername, toUsername, timestamp }
const pendingChallenges = new Map();

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

function removePlayer(socketId) {
  const player = connectedPlayers.get(socketId);
  if (!player) return null;
  connectedPlayers.delete(socketId);

  // Clean up any challenges involving this player
  for (const [id, challenge] of pendingChallenges) {
    if (challenge.from === socketId || challenge.to === socketId) {
      pendingChallenges.delete(id);
    }
  }

  return player.username;
}

function getPlayer(socketId) {
  return connectedPlayers.get(socketId) || null;
}

function getPlayerByUsername(username) {
  for (const player of connectedPlayers.values()) {
    if (player.username === username) {
      return player;
    }
  }
  return null;
}

function setStatus(socketId, status) {
  const player = connectedPlayers.get(socketId);
  if (player) {
    player.status = status;
  }
}

function getPlayerList() {
  const list = [];
  for (const player of connectedPlayers.values()) {
    list.push({ username: player.username, status: player.status });
  }
  return list;
}

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

function getChallenge(challengeId) {
  return pendingChallenges.get(challengeId) || null;
}

function acceptChallenge(challengeId) {
  const challenge = pendingChallenges.get(challengeId);
  if (!challenge) return null;
  pendingChallenges.delete(challengeId);
  return challenge;
}

function declineChallenge(challengeId) {
  const challenge = pendingChallenges.get(challengeId);
  if (!challenge) return null;
  pendingChallenges.delete(challengeId);
  return challenge;
}

function expireChallenges() {
  const now = Date.now();
  const expired = [];
  for (const [id, challenge] of pendingChallenges) {
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
