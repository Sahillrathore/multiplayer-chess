import React from 'react';

/**
 * Simple overlay prompt to let the user choose promotion piece.
 * `onChoose` will be called with one of 'q','r','b','n'
 */
export default function PromotionPrompt({ onChoose, onCancel, visible, color }) {
  if (!visible) return null;
  const pieces = ['q', 'r', 'b', 'n'];
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 p-4 rounded-xl ring-1 ring-white/10 text-center">
        <div className="mb-3 text-sm text-zinc-200">Promote pawn to:</div>
        <div className="flex items-center gap-3">
          {pieces.map((p) => (
            <button
              key={p}
              onClick={() => onChoose(p)}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold"
            >
              {color === 'w' ? {
                q: '♕', r: '♖', b: '♗', n: '♘'
              }[p] : {
                q: '♛', r: '♜', b: '♝', n: '♞'
              }[p]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button onClick={onCancel} className="text-xs text-zinc-400 hover:underline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
