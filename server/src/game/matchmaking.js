const queues = new Map();
function enqueue(timeControl, item) {
  if (!queues.has(timeControl)) queues.set(timeControl, []);
  queues.get(timeControl).push(item);
}
function dequeuePair(timeControl) {
  const q = queues.get(timeControl) || [];
  if (q.length >= 2) { const a = q.shift(); const b = q.shift(); return [a, b]; }
  return null;
}
function removeFromQueues(socketId) {
  for (const [, arr] of queues) {
    const idx = arr.findIndex(q => q.socketId === socketId);
    if (idx !== -1) arr.splice(idx, 1);
  }
}
module.exports = { enqueue, dequeuePair, removeFromQueues };
