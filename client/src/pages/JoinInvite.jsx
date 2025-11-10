// client/src/pages/JoinInvite.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setToken, setUser } from "../store/slices/authSlice";
import { joinChallenge, authGuest, fetchGameDetails } from "../store/services/challenges"; // <-- fetchGameDetails added
import { setTimeControl, setSidebarTab, setReviewing, queueStart, queueStop, resumeGame } from '../store/slices/gameSlice';

export default function JoinInvite() {
    const { token } = useParams(); // the invite token from /join/:token
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { token: storedToken, user } = useSelector((s) => s.auth);

    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // parse timeControl like "300+0" -> base seconds
    const parseTcMs = (tcStr) => {
        try {
            if (!tcStr) return 300000;
            const base = Number(tcStr.split("+")[0]) || 300;
            return base * 1000;
        } catch {
            return 300000;
        }
    };

    // fetch invite preview for UI: GET /challenges/:token
    useEffect(() => {
        let aborted = false;
        async function loadPreview() {
            setLoadingPreview(true);
            setError(null);
            try {
                const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
                const res = await fetch(`${API_BASE}/challenges/${encodeURIComponent(token)}`);
                const json = await res.json();
                console.log("invite preview", json);

                if (!res.ok) throw new Error(json.error || "Invite not found");
                if (aborted) return;
                setPreview(json); // { inviteToken, inviterEmail, timeControl, expiresAt }
            } catch (err) {
                if (!aborted) setError(err.message || "Failed to load invite");
            } finally {
                if (!aborted) setLoadingPreview(false);
            }
        }
        loadPreview();
        return () => { aborted = true; };
    }, [token]);

    // helper to initialize the UI after join: fetch game's persisted state and dispatch resumeGame
    async function initGameFromServer(gameId, opPayload) {
        try {
            const g = await fetchGameDetails(gameId);
            // server returns startFEN, moves (array), timeControl, youAre, etc.
            const baseMs = parseTcMs(g.timeControl || preview?.timeControl);
            const payload = {
                gameId,
                color: opPayload?.yourColor ?? g.youAre ?? null,
                fen: g.startFEN || (g.moves && g.moves.length ? g.moves[g.moves.length - 1].fen : 'start'),
                moves: g.moves || [],
                clocks: { w: baseMs, b: baseMs },
                turn: 'w',
                status: 'active',
                opponent: opPayload?.opponent ?? { id: (g.youAre === 'w' ? g.blackId : g.whiteId) || null, email: null }
            };
            // dispatch to populate UI immediately
            dispatch(resumeGame(payload));
        } catch (e) {
            console.warn("[initGameFromServer] failed to fetch game details", e);
            // fallback: nothing — the socket events may still bring state
        }
    }

    // attempt join (assumes there's a token stored in localStorage or dispatch stored token)
    const handleJoin = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await joinChallenge({ token });
            console.log("join response", res);

            // roomId is the in-memory socket room id (used for /play/:roomId)
            const roomId = res.gameId;
            // gameDbId is the Mongo _id of the persisted Game (used for GET /games/:id)
            const gameDbId = res.gameDbId || roomId; // fallback to roomId if server didn't return DB id

            // fetch persisted game doc and initialize UI from it
            await initGameFromServer(gameDbId, res);

            // navigate to the room page that the socket server uses
            navigate(`/play/${encodeURIComponent(roomId)}`);
        } catch (err) {
            console.error("[handleJoin] error", err);
            setError(err.message || "Failed to join invite");
        } finally {
            setBusy(false);
        }
    };

    const handleGuest = async () => {
        setBusy(true);
        setError(null);
        try {
            const guest = await authGuest();
            dispatch(setToken(guest.token));
            if (guest.user) dispatch(setUser(guest.user));

            // Now call join
            const res = await joinChallenge({ token });

            const roomId = res.gameId;
            const gameDbId = res.gameDbId || roomId;

            // fetch and initialize from server using DB id
            await initGameFromServer(gameDbId, res);

            // navigate to room id for sockets to work
            navigate(`/play/${encodeURIComponent(roomId)}`);
        } catch (err) {
            console.error("[handleGuest] error", err);
            setError(err.message || "Guest join failed");
        } finally {
            setBusy(false);
        }
    };

    // const handleSignInRedirect = () => {
    //     // before: window.location.href = `${API_BASE}/auth/google`;
    //     const intended = `/join/${encodeURIComponent(token)}`; // or just `/join/${token}`
    //     window.location.href = `${import.meta.env.VITE_API_BASE}/auth/google?redirect=${encodeURIComponent(intended)}`;

    // };

    // e.g. in AuthPage.jsx or JoinInvite.jsx where you call googleSignIn
    const handleSignInRedirect = (optionalRedirect) => {
        const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
        // allow caller to pass a redirect (e.g. `/join/${token}`); otherwise use ?redirect= in URL or default '/'
        const params = new URLSearchParams(window.location.search);
        const redirectFromQuery = params.get("redirect");
        const redirectPath = `/join/${token}` || redirectFromQuery || "/";
        const url = `${API_BASE}/auth/google?redirect=${encodeURIComponent(redirectPath)}`;
        window.location.href = url;
    };

    return (
        <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl rounded-2xl bg-zinc-900/80 ring-1 ring-white/8 p-8">
                <h2 className="text-2xl font-bold">Join challenge</h2>
                <p className="text-sm text-zinc-400 mt-1">Use this page to accept an invite link and start the game with your friend.</p>

                <div className="mt-6">
                    {loadingPreview ? (
                        <div className="text-sm text-zinc-400">Loading invite…</div>
                    ) : error ? (
                        <div className="text-sm text-rose-400">{error}</div>
                    ) : preview ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-xs text-zinc-400">Inviter</div>
                                    <div className="text-sm font-semibold">{preview.inviterEmail || "Unknown"}</div>
                                </div>

                                <div>
                                    <div className="text-xs text-zinc-400">Time control</div>
                                    <div className="text-sm font-semibold">{preview.timeControl}</div>
                                </div>

                                <div>
                                    <div className="text-xs text-zinc-400">Expires</div>
                                    <div className="text-sm">
                                        {preview.expiresAt ? new Date(preview.expiresAt).toLocaleString() : "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4">
                                {storedToken ? (
                                    <>
                                        <div className="text-xs text-zinc-400">Signed in as</div>
                                        <div className="text-sm font-semibold">{user?.email || "You"}</div>

                                        <div className="mt-4 flex gap-3">
                                            <button
                                                onClick={handleJoin}
                                                disabled={busy}
                                                className="rounded-xl px-4 py-2 bg-emerald-600 font-semibold"
                                            >
                                                {busy ? "Joining…" : "Join Challenge"}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleSignInRedirect();
                                                }}
                                                className="rounded-xl px-4 py-2 bg-white/6"
                                            >
                                                Sign in as different user
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-sm text-zinc-300">You are not signed in.</div>
                                        <div className="mt-5 flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={handleSignInRedirect}
                                                className="flex-1 rounded-xl px-4 py-3 bg-white text-zinc-900 font-semibold"
                                            >
                                                Sign in with Google
                                            </button>

                                            {/* <button
                                                onClick={handleGuest}
                                                disabled={busy}
                                                className="flex-1 rounded-xl px-4 py-3 bg-indigo-600 font-semibold"
                                            >
                                                {busy ? "Creating guest…" : "Continue as Guest"}
                                            </button> */}
                                        </div>

                                        <div className="text-xs text-zinc-400 mt-3">
                                            Join WeChess to accept the challenge and play online with friends.
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-400">No invite found.</div>
                    )}
                </div>

                <div className="mt-6 text-right">
                    <button
                        onClick={() => navigate("/")}
                        className="rounded px-3 py-2 bg-white/6"
                    >
                        Back to home
                    </button>
                </div>
            </div>
        </div>
    );
}
