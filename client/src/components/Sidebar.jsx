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

    // inside Sidebar component

    // navigate backward/forward
    const handlePrevMove = () => {
        // if we're at live view (-1), start from latest move first
        const lastIndex = movesCount - 1;
        if (movesCount <= 0) return;

        // if currently live, start from lastIndex and go back one step
        if (selectedMoveIndex === -1) {
            const newIdx = lastIndex - 1;
            seekToMoveIndex(newIdx >= 0 ? newIdx : -1);
            return;
        }

        // otherwise, just go one step back
        const prevIndex = selectedMoveIndex - 1;
        seekToMoveIndex(prevIndex >= 0 ? prevIndex : -1);
    };

    const handleNextMove = () => {
        if (movesCount <= 0) return;

        // if currently live, there's no "next"
        if (selectedMoveIndex === -1) return;

        const nextIndex = selectedMoveIndex + 1;
        // if we go past the last move, jump back to live (-1)
        if (nextIndex >= movesCount) {
            seekToMoveIndex(-1);
        } else {
            seekToMoveIndex(nextIndex);
        }
    };


    return (
        <div className="space-y-4">
            <div className="rounded-md h-full bg-[#1f1f1f] ring-1 ring-white/10 p-3 pt-0 px-0 overflow-hidden">
                {/* Tabs */}
                <div className="flex justify-between w-full items-center mb-3">
                    <button
                        onClick={() => dispatch(setSidebarTab('new'))}
                        className={`px-4 py-4 flex flex-row justify-center gap-1 w-full ${sidebarTab === "new" ? "bg-[#1f1f1f]" : "bg-white/5"} hover:text-white transition-colors text-sm font-semibold text-zinc-300`}
                    >
                        <FaRegSquarePlus size={20} />
                        New
                    </button>

                    <button
                        onClick={() => dispatch(setSidebarTab('games'))}
                        className={`px-4 py-4 flex flex-row justify-center gap-1 w-full ${sidebarTab === "games" ? "bg-[#1f1f1f]" : "bg-white/5"} transition-colors text-sm font-semibold hover:text-white text-zinc-300`}
                    >
                        <BiSolidChess size={20} />
                        Games
                    </button>
                </div>

                {/* -------------------- NEW GAME TAB -------------------- */}
                {sidebarTab === 'new' && (
                    <>
                        <div className="flex justify-center w-full mt-2 px-8">
                            <div className="w-full">
                                <TimeControlSelect
                                    tcSeconds={tcSeconds}
                                    isAuthed={isAuthed}
                                    status={status}
                                    isQueueing={isQueueing}
                                    findMatch={findMatch}
                                    cancelQueue={cancelQueue}
                                />
                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => setInviteOpen(true)}
                                        className="w-full rounded-xl px-3 py-2 bg-indigo-600/80 font-semibold text-white hover:bg-indigo-600/90"
                                    >
                                        Create Challenge
                                    </button>
                                </div>
                            </div>
                        </div>


                        {/* Moves list */}
                        <div className="rounded-lg bg-[#1f1f1f] mt-4 p-3 ring-1 mx-8 ring-white/5 max-h-[40vh] overflow-auto">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-zinc-200">Moves</div>
                                <div className="text-xs text-zinc-400">Moves: {movesCount || 0}</div>
                            </div>

                            <ol className="text-sm leading-6 space-y-1">
                                {moveRows.length === 0 && <li className="text-xs text-zinc-400">No moves yet</li>}
                                {moveRows.map((r) => (
                                    <li key={r.moveNo} className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                                        {/* move number */}
                                        <button
                                            onClick={() => seekToMoveIndex(r.whiteIndex)}
                                            className={`text-left text-xs px-2 py-1 rounded ${selectedMoveIndex === r.whiteIndex || selectedMoveIndex === r.blackIndex
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'text-zinc-300 hover:bg-white/5'}`}
                                            title={`Go to move ${r.moveNo}`}
                                        >
                                            {r.moveNo}.
                                        </button>

                                        {/* white move */}
                                        <button
                                            onClick={() => seekToMoveIndex(r.whiteIndex)}
                                            className={`flex items-center gap-2 text-left text-xs px-2 py-1 rounded ${selectedMoveIndex === r.whiteIndex
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'text-zinc-300 hover:bg-white/5'}`}
                                            title={r.white}
                                        >
                                            <span className="w-5 text-sm">{r.whiteGlyph}</span>
                                            <span className="truncate">{r.white || '—'}</span>
                                        </button>

                                        {/* black move */}
                                        <button
                                            onClick={() => seekToMoveIndex(r.blackIndex)}
                                            className={`flex items-center gap-2 text-left text-xs px-2 py-1 rounded ${selectedMoveIndex === r.blackIndex
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'text-zinc-300 hover:bg-white/5'}`}
                                            title={r.black}
                                        >
                                            <span className="w-5 text-sm">{r.blackGlyph}</span>
                                            <span className="truncate">{r.black || '—'}</span>
                                        </button>
                                    </li>
                                ))}
                            </ol>

                            <div className='flex justify-between items-center mt-3'>

                                {/* Navigation Arrows */}
                                {movesCount > 0 && (
                                    <div className="mt-0 flex items-center justify-center gap-3">
                                        <button
                                            onClick={handlePrevMove}
                                            className="flex items-center justify-center p-3 rounded-lg text-xl font-bold bg-white/5 hover:bg-white/10 transition"
                                            title="Previous move"
                                        >
                                            <FaChevronLeft className="text-zinc-300" />
                                        </button>
                                        <button
                                            onClick={handleNextMove}
                                            className="flex items-center justify-center p-3 rounded-lg text-xl font-bold bg-white/5 hover:bg-white/10 transition"
                                            title="Next move"
                                        >
                                            <FaChevronRight className="text-zinc-300" />
                                        </button>
                                    </div>
                                )}

                                <div className="mt-2 text-right">
                                    <button
                                        onClick={() => seekToMoveIndex(-1)}
                                        className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition"
                                    >
                                        Back to live
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Offer Draw / Resign */}
                        <div className={`flex gap-2 mt-4 px-8 ${(!gameId || status !== 'active') ? 'hidden' : ''}`}>
                            <button
                                onClick={offerDraw}
                                disabled={!gameId || status !== 'active'}
                                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                ${!gameId || status !== 'active'
                                        ? 'bg-amber-500/50 cursor-not-allowed'
                                        : 'bg-amber-500 hover:bg-amber-500/90'}`}
                            >
                                Offer Draw
                            </button>

                            <button
                                onClick={resign}
                                disabled={!gameId || status !== 'active'}
                                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                ${!gameId || status !== 'active'
                                        ? 'bg-rose-500/50 cursor-not-allowed'
                                        : 'bg-rose-500 hover:bg-rose-500/90'}`}
                            >
                                Resign
                            </button>
                        </div>
                    </>
                )}

                {/* -------------------- GAMES HISTORY TAB -------------------- */}
                {sidebarTab === 'games' && (
                    <div className="relative rounded-2xl bg-zinc-900/70 ring-1 mx-8 mt-4 ring-white/10 backdrop-blur-xl p-4">
                        <h2 className="mb-2 text-sm font-semibold text-zinc-200">Your Games</h2>
                        {historyLoading && <div className="text-xs text-zinc-400">Loading…</div>}
                        {historyError && <div className="text-xs text-rose-400">Error: {historyError}</div>}
                        <div className="space-y-2 max-h-36 overflow-auto">
                            {history.length === 0 && !historyLoading && (
                                <div className="text-xs text-zinc-400">No games yet.</div>
                            )}
                            {history.map((g) => (
                                <div
                                    key={g._id}
                                    className="flex items-center justify-between gap-2 rounded-md bg-white/2 p-2"
                                >
                                    <div className="text-xs text-zinc-200">
                                        <div className="font-semibold">{g.timeControl}</div>
                                        <div className="text-zinc-400 text-[11px]">
                                            {new Date(g.startedAt).toLocaleString()}
                                        </div>
                                        <div className="text-zinc-400 text-[11px]">
                                            Result: {g.result || '—'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openReviewOnBoard(g)}
                                            className="rounded-md px-3 py-1 text-xs bg-indigo-600/70 font-semibold"
                                        >
                                            Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {reviewing && (
                            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                                Viewing a past game (review mode). Close the review to return to live play.
                            </div>
                        )}
                    </div>
                )}
            </div>
            <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} tcSeconds={tcSeconds} />
        </div>
    );
}
