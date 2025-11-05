// matchmaking.js
const queues = new Map();

/**
 * enqueue(timeControl, item)
 * item: { socketId, userId, userDbId, timeControl, ... }
 */
function enqueue(timeControl, item) {
  if (!queues.has(timeControl)) queues.set(timeControl, []);
  const arr = queues.get(timeControl);

  // Prevent duplicate entries for same userId (or socketId)
  const dupIndex = arr.findIndex(x => String(x.userId) === String(item.userId) || x.socketId === item.socketId);
  if (dupIndex !== -1) {
    // optional: replace existing with the new one (refresh)
    arr.splice(dupIndex, 1, item);
    return;
  }

  arr.push(item);
}

/**
 * dequeuePair(timeControl, isValid)
 * - isValid(item) => boolean, optional predicate to ensure the queued item is still valid
 * - returns [a,b] or null
 *
 * Implementation: iterate queue and pick first two items that satisfy isValid.
 * Invalid entries are removed from the queue.
 */
function dequeuePair(timeControl, isValid = () => true) {
  const q = queues.get(timeControl) || [];
  if (q.length === 0) return null;

  const picked = [];
  const remaining = [];

  while (q.length > 0 && picked.length < 2) {
    const item = q.shift();
    if (!item) continue;
    try {
      if (isValid(item)) {
        picked.push(item);
      } else {
        // skip invalid (do not re-queue)
      }
    } catch (e) {
      // if predicate throws, treat as invalid and skip
      console.warn('[matchmaking] isValid threw', e);
    }
  }

  // remaining items in q (not yet inspected) should be kept
  // combine them with those we didn't pick from earlier checks
  // (we already shifted all processed entries out of q)
  // push back leftover q items (the ones not processed yet)
  // note: 'q' is mutated because we used shift in a loop, but we must set queues map to what's left
  const leftover = q.slice(); // any remaining unprocessed items
  // re-create queue: leftover appended to any remaining that were not picked earlier
  const newQueue = leftover;
  queues.set(timeControl, newQueue);

  if (picked.length === 2) return picked;
  // not enough valid players, re-insert any picked (we removed them already)
  // to preserve order, add picked back to start of the queue
  // (they may be picked again later)
  if (picked.length > 0) {
    // put them back (in front) to preserve original order for future dequeues
    const cur = queues.get(timeControl) || [];
    queues.set(timeControl, [...picked, ...cur]);
  }
  return null;
}

/**
 * removeFromQueues(socketIdOrUserId)
 * tries to remove by socketId first, otherwise by userId
 */
function removeFromQueues(id) {
  for (const [tc, arr] of queues.entries()) {
    // find by socketId
    let idx = arr.findIndex(q => q.socketId === id);
    if (idx !== -1) {
      arr.splice(idx, 1);
      queues.set(tc, arr);
      continue;
    }
    // find by userId
    idx = arr.findIndex(q => String(q.userId) === String(id));
    if (idx !== -1) {
      arr.splice(idx, 1);
      queues.set(tc, arr);
    }
  }
}

module.exports = { enqueue, dequeuePair, removeFromQueues };
