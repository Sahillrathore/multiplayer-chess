// GameReview.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const pad2 = (n) => (n < 10 ? "0"+n : ""+n);

export default function GameReview({ token, gameMeta, onClose }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [moveIndex, setMoveIndex] = useState(-1); // -1 = start position
  const [playing, setPlaying] = useState(false);

  // load the game detail
  useEffect(() => {
    let abort = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/games/${gameMeta._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load game");
        if (!abort) { setDetail(data); setMoveIndex(-1); }
      } catch (e) {
        if (!abort) setDetail(null);
      } finally {
        if (!abort) setLoading(false);
      }
    }
    run();
    return () => { abort = true; };
  }, [token, gameMeta]);

  // figure current FEN
  const fen = useMemo(() => {
    if (!detail) return "start";
    if (moveIndex < 0) {
      return detail.startFEN && detail.startFEN !== "startpos" ? detail.startFEN : "start";
    }
    const m = detail.moves[moveIndex];
    return m?.fen || "start";
  }, [detail, moveIndex]);

  // auto-play
  useEffect(() => {
    if (!playing || !detail) return;
    if (moveIndex >= detail.moves.length - 1) { setPlaying(false); return; }
    const id = setTimeout(() => setMoveIndex((i) => Math.min(i + 1, detail.moves.length - 1)), 700);
    return () => clearTimeout(id);
  }, [playing, moveIndex, detail]);

  if (loading) return <div className="text-xs text-zinc-400">Loading…</div>;
  if (!detail) return <div className="text-xs text-rose-400">Failed to load game.</div>;

  const total = detail.moves.length;
  const orient = detail.youAre === "b" ? "black" : "white";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between ">
        <div className="text-sm text-zinc-300">
          {new Date(detail.startedAt).toLocaleString()} · {detail.timeControl} · {detail.result || "—"}
        </div>
        <button
          className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="grid gap-4 ">
        <div className="rounded-2xl bg-zinc-900/90 ring-1 ring-white/10 p-3">
          <Chessboard
            position={fen}
            arePiecesDraggable={false}
            boardOrientation={orient}
            animationDuration={200}
            customBoardStyle={{ borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}
            customDarkSquareStyle={{ backgroundColor: "#769656" }}
            customLightSquareStyle={{ backgroundColor: "#eeeed2" }}
          />

          {/* controls */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-mini" onClick={() => { setPlaying(false); setMoveIndex(-1); }}>&laquo; First</button>
            <button className="btn-mini" onClick={() => { setPlaying(false); setMoveIndex((i)=>Math.max(-1, i-1)); }}>&lsaquo; Prev</button>
            <button
              className="btn-mini"
              onClick={() => setPlaying(p => !p)}
              disabled={total === 0}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button className="btn-mini" onClick={() => { setPlaying(false); setMoveIndex((i)=>Math.min(total-1, i+1)); }}>Next &rsaquo;</button>
            <button className="btn-mini" onClick={() => { setPlaying(false); setMoveIndex(total-1); }}>Last &raquo;</button>

            <div className="ml-auto text-xs text-zinc-400">
              Move {Math.max(0, moveIndex + 1)} / {total}
            </div>
          </div>

          {/* slider */}
          <input
            type="range"
            min={-1}
            max={Math.max(-1, total - 1)}
            value={moveIndex}
            onChange={(e) => { setPlaying(false); setMoveIndex(parseInt(e.target.value, 10)); }}
            className="mt-2 w-full"
          />
        </div>

        {/* move list */}
        <div className="rounded-2xl bg-zinc-900/90 ring-1 ring-white/10 p-3 max-h-[520px] overflow-y-auto">
          <div className="text-sm text-zinc-300 mb-2">Moves</div>
          <ol className="text-sm leading-6">
            {detail.moves.map((m, i) => (
              <li key={i}>
                <button
                  className={`rounded px-2 ${i===moveIndex ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-300 hover:bg-white/10"}`}
                  onClick={() => { setPlaying(false); setMoveIndex(i); }}
                >
                  {Math.floor(i/2) + 1}. {m.san}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
