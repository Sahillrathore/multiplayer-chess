// server/src/game/socketUtils.js
// small utility: in-memory map userId -> socketId and helper to emit
// sockets.js will call setUserSocket / removeUserSocket on connect/disconnect
// and other server modules (HTTP routes) can use getSocketIdForUser/emitToSocketId

let ioRef = null; // set by attachSocketServer if you want, or we can access via require cycle if needed

const userSockets = new Map();

function setIo(io) {
  ioRef = io;
}

function setUserSocket(userId, socketId) {
  if (!userId) return;
  userSockets.set(String(userId), socketId);
}

function removeUserSocket(userId) {
  if (!userId) return;
  userSockets.delete(String(userId));
}

function getSocketIdForUser(userId) {
  if (!userId) return null;
  return userSockets.get(String(userId)) || null;
}

function emitToSocketId(socketId, event, payload) {
  if (!ioRef) {
    // io not set; nothing to emit
    return;
  }
  if (!socketId) return;
  try {
    ioRef.to(socketId).emit(event, payload);
  } catch (e) {
    console.warn("[socketUtils.emitToSocketId] emit failed", e && e.message);
  }
}

module.exports = { setIo, setUserSocket, removeUserSocket, getSocketIdForUser, emitToSocketId };
