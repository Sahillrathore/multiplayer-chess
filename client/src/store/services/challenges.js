// client/src/services/challenges.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/**
 * helper to get current bearer token from localStorage (your authSlice sets it there)
 */
function getAuthHeaders() {
  const t = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

/**
 * createChallenge({ timeControl })
 * returns { inviteToken, link, expiresAt }
 */
export async function createChallenge({ timeControl }) {
  const res = await fetch(`${API_BASE}/challenges`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ timeControl }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create challenge");
  return json;
}

/**
 * joinChallenge({ token })
 * returns { gameId, gameDbId } per server implementation
 */
export async function joinChallenge({ token }) {
  const res = await fetch(`${API_BASE}/challenges/${token}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to join challenge");
  return json;
}

/**
 * fetchGameDetails(gameId)
 * GET /games/:id — returns the full game detail (your server already has this).
 */
export async function fetchGameDetails(gameId) {
  const res = await fetch(`${API_BASE}/games/${gameId}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch game details");
  return json;
}

/**
 * authGuest() — create a guest account and return { token, user }
 * Server expected endpoint: POST /auth/guest
 */
export async function authGuest() {
  const res = await fetch(`${API_BASE}/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}), // no payload
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create guest account");
  return json;
}
