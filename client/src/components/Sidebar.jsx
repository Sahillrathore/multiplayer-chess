import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaRegSquarePlus } from "react-icons/fa6";
import { BiSolidChess } from "react-icons/bi";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import TimeControlSelect from '../components/TimeControlSelect';
import { setSidebarTab } from '../../src/store/slices/gameSlice';
import InviteModal from '../components/InviteModal';

export default function Sidebar({
    tcSeconds, isAuthed, status, isQueueing, findMatch, cancelQueue,
    moveRows = [], movesCount = 0,
    selectedMoveIndex, seekToMoveIndex,
    history = [], historyLoading, historyError, openReviewOnBoard, reviewing,
    resign, offerDraw, gameId
}) {
    const dispatch = useDispatch();
    const [inviteOpen, setInviteOpen] = React.useState(false);
    const sidebarTab = useSelector((s) => s.game.sidebarTab);

    // navigate backward/forward
    const handlePrevMove = () => {
        const lastIndex = movesCount - 1;
        if (movesCount <= 0) return;

        if (selectedMoveIndex === -1) {
            const newIdx = lastIndex - 1;
            seekToMoveIndex(newIdx >= 0 ? newIdx : -1);
            return;
        }

        const prevIndex = selectedMoveIndex - 1;
        seekToMoveIndex(prevIndex >= 0 ? prevIndex : -1);
    };

    const handleNextMove = () => {
        if (movesCount <= 0) return;
        if (selectedMoveIndex === -1) return;

        const nextIndex = selectedMoveIndex + 1;
        if (nextIndex >= movesCount) {
            seekToMoveIndex(-1);
        } else {
            seekToMoveIndex(nextIndex);
        }
    };

    return (
        <div className="space-y-4 w-full">
            <div className="relative h-full rounded-xl bg-gradient-to-b from-[#111111] via-[#050509] to-black p-[1px] shadow-[0_0_40px_rgba(0,0,0,0.7)]">
                {/* subtle inner glass card */}
                <div className="h-full rounded-xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 px-0 pt-3 pb-4 overflow-hidden flex flex-col">
                    
                    {/* Header */}
                    <div className="px-4 pb-3 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/80 via-purple-500/80 to-emerald-500/80 shadow-[0_0_20px_rgba(79,70,229,0.6)]">
                                <BiSolidChess className="text-white text-lg" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-100">Game Panel</h2>
                                <p className="text-[11px] text-zinc-400">
                                    Create games, review moves & history
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-3 pt-3">
                        <div className="flex items-center gap-1 rounded-xl bg-zinc-900/70 p-1 ring-1 ring-white/5">
                            <button
                                onClick={() => dispatch(setSidebarTab('new'))}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all
                                    ${sidebarTab === "new"
                                        ? "bg-gradient-to-r from-indigo-500/90 to-purple-500/90 text-white shadow-[0_0_24px_rgba(129,140,248,0.7)]"
                                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                <FaRegSquarePlus size={16} />
                                <span>New Game</span>
                            </button>

                            <button
                                onClick={() => dispatch(setSidebarTab('games'))}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all
                                    ${sidebarTab === "games"
                                        ? "bg-gradient-to-r from-emerald-500/90 to-cyan-500/90 text-white shadow-[0_0_24px_rgba(34,197,94,0.7)]"
                                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                <BiSolidChess size={16} />
                                <span>Games</span>
                            </button>
                        </div>
                    </div>

                    {/* -------------------- NEW GAME TAB -------------------- */}
                    {sidebarTab === 'new' && (
                        <div className="mt-3 flex-1 flex flex-col">
                            <div className="flex justify-center w-full px-4">
                                <div className="w-full rounded-2xl bg-zinc-950/70 ring-1 ring-white/5 p-3">
                                    <TimeControlSelect
                                        tcSeconds={tcSeconds}
                                        isAuthed={isAuthed}
                                        status={status}
                                        isQueueing={isQueueing}
                                        findMatch={findMatch}
                                        cancelQueue={cancelQueue}
                                    />
                                    <div className="mt-2 flex gap-2">
                                        <button
                                            onClick={() => setInviteOpen(true)}
                                            disabled={!isAuthed || status === "active" || isQueueing}
                                            className="w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-white
                                                bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
                                                shadow-[0_0_25px_rgba(129,140,248,0.7)]
                                                hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(236,72,153,0.7)]
                                                disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:scale-100
                                                transition-all duration-150"
                                        >
                                            Create Challenge
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Moves list */}
                            <div className="rounded-2xl bg-zinc-950/80 mt-4 mx-4 p-3 ring-1 ring-white/5 max-h-[40vh] overflow-auto shadow-inner">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-zinc-200 tracking-wide">Moves</div>
                                    <div className="text-[11px] text-zinc-400">
                                        Total: <span className="font-semibold text-zinc-200">{movesCount || 0}</span>
                                    </div>
                                </div>

                                <ol className="text-sm leading-6 space-y-1">
                                    {moveRows.length === 0 && (
                                        <li className="text-[11px] text-zinc-500 italic">
                                            No moves yet. Start a game to see moves here.
                                        </li>
                                    )}
                                    {moveRows.map((r) => (
                                        <li
                                            key={r.moveNo}
                                            className="grid grid-cols-[40px_1fr_1fr] gap-1.5 items-center text-[11px]"
                                        >
                                            {/* move number */}
                                            <button
                                                onClick={() => seekToMoveIndex(r.whiteIndex)}
                                                className={`text-left px-2 py-1 rounded-md border border-transparent transition
                                                    ${selectedMoveIndex === r.whiteIndex || selectedMoveIndex === r.blackIndex
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                                                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                                                    }`}
                                                title={`Go to move ${r.moveNo}`}
                                            >
                                                {r.moveNo}.
                                            </button>

                                            {/* white move */}
                                            <button
                                                onClick={() => seekToMoveIndex(r.whiteIndex)}
                                                className={`flex items-center gap-1.5 text-left px-2 py-1 rounded-md border border-transparent transition
                                                    ${selectedMoveIndex === r.whiteIndex
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                                                        : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                                                    }`}
                                                title={r.white}
                                            >
                                                <span className="w-4 text-xs">{r.whiteGlyph}</span>
                                                <span className="truncate">{r.white || '—'}</span>
                                            </button>

                                            {/* black move */}
                                            <button
                                                onClick={() => seekToMoveIndex(r.blackIndex)}
                                                className={`flex items-center gap-1.5 text-left px-2 py-1 rounded-md border border-transparent transition
                                                    ${selectedMoveIndex === r.blackIndex
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                                                        : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                                                    }`}
                                                title={r.black}
                                            >
                                                <span className="w-4 text-xs">{r.blackGlyph}</span>
                                                <span className="truncate">{r.black || '—'}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ol>

                                <div className="flex justify-between items-center mt-3">
                                    {/* Navigation Arrows */}
                                    {movesCount > 0 && (
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={handlePrevMove}
                                                className="flex items-center justify-center h-9 w-9 rounded-xl text-lg font-bold
                                                    bg-zinc-900/80 ring-1 ring-white/10 hover:bg-zinc-800/90
                                                    hover:ring-emerald-400/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.7)]
                                                    transition-all"
                                                title="Previous move"
                                            >
                                                <FaChevronLeft className="text-zinc-200" />
                                            </button>
                                            <button
                                                onClick={handleNextMove}
                                                className="flex items-center justify-center h-9 w-9 rounded-xl text-lg font-bold
                                                    bg-zinc-900/80 ring-1 ring-white/10 hover:bg-zinc-800/90
                                                    hover:ring-emerald-400/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.7)]
                                                    transition-all"
                                                title="Next move"
                                            >
                                                <FaChevronRight className="text-zinc-200" />
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-0 text-right">
                                        <button
                                            onClick={() => seekToMoveIndex(-1)}
                                            className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-900/80 ring-1 ring-white/10
                                                hover:bg-zinc-800 hover:ring-emerald-400/60 hover:text-emerald-200
                                                transition-all"
                                        >
                                            Back to live
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Offer Draw / Resign */}
                            <div className={`flex gap-2 mt-4 px-4 ${(!gameId || status !== 'active') ? 'hidden' : ''}`}>
                                <button
                                    onClick={offerDraw}
                                    disabled={!gameId || status !== 'active'}
                                    className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all
                                        ${!gameId || status !== 'active'
                                            ? 'bg-amber-500/40 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-[0_0_18px_rgba(245,158,11,0.7)] hover:scale-[1.01]'
                                        }`}
                                >
                                    Offer Draw
                                </button>

                                <button
                                    onClick={resign}
                                    disabled={!gameId || status !== 'active'}
                                    className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all
                                        ${!gameId || status !== 'active'
                                            ? 'bg-rose-500/40 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-rose-500 to-red-500 hover:shadow-[0_0_18px_rgba239,68,68,0.7)] hover:scale-[1.01]'
                                        }`}
                                >
                                    Resign
                                </button>
                            </div>
                        </div>
                    )}

                    {/* -------------------- GAMES HISTORY TAB -------------------- */}
                    {sidebarTab === 'games' && (
                        <div className="mt-4 flex-1 px-4">
                            <div className="relative rounded-2xl bg-zinc-950/80 ring-1 ring-white/10 backdrop-blur-xl p-3 shadow-inner">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-xs font-semibold text-zinc-100 tracking-wide">
                                        Your Games
                                    </h2>
                                    <span className="text-[11px] text-zinc-500">
                                        {history.length > 0 ? `${history.length} games` : ''}
                                    </span>
                                </div>

                                {historyLoading && (
                                    <div className="mt-1 text-[11px] text-zinc-400">
                                        Loading…
                                    </div>
                                )}
                                {historyError && (
                                    <div className="mt-1 text-[11px] text-rose-400">
                                        Error: {historyError}
                                    </div>
                                )}

                                <div className="mt-2 space-y-2 max-h-40 overflow-auto pr-1">
                                    {history.length === 0 && !historyLoading && (
                                        <div className="text-[11px] text-zinc-500 italic">
                                            No games yet. Your finished games will appear here.
                                        </div>
                                    )}

                                    {history.map((g) => (
                                        <div
                                            key={g._id}
                                            className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900/70 ring-1 ring-white/5 px-3 py-2 hover:ring-indigo-400/60 hover:bg-zinc-900 transition-all"
                                        >
                                            <div className="text-[11px] text-zinc-200">
                                                <div className="font-semibold text-xs text-zinc-100">
                                                    {g.timeControl}
                                                </div>
                                                <div className="text-zinc-400 text-[10px]">
                                                    {new Date(g.startedAt).toLocaleString()}
                                                </div>
                                                <div className="text-zinc-400 text-[10px]">
                                                    Result: <span className="text-zinc-100">{g.result || '—'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openReviewOnBoard(g)}
                                                    className="rounded-lg px-3 py-1.5 text-[11px] font-semibold
                                                        bg-gradient-to-r from-indigo-500/80 to-purple-500/80
                                                        hover:from-indigo-500 hover:to-purple-500
                                                        shadow-[0_0_12px_rgba(129,140,248,0.7)]
                                                        transition-all"
                                                >
                                                    Review
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {reviewing && (
                                    <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-200">
                                        Viewing a past game (review mode). Close the review to return to live play.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} tcSeconds={tcSeconds} />
        </div>
    );
}
