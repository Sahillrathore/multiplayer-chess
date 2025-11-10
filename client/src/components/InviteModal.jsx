// client/src/components/InviteModal.jsx
import React, { useState } from "react";
import { createChallenge } from "../store/services/challenges"; // adjust path if needed
import { FiCopy } from "react-icons/fi";

export default function InviteModal({ open, onClose, tcSeconds }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      const timeControl = `${tcSeconds}+0`;
      const res = await createChallenge({ timeControl });
      setLink(res.link);
    } catch (err) {
      setError(err.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function handleClose() {
    setLink(null);
    setError(null);
    setLoading(false);
    setCopied(false);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900/95 ring-1 ring-white/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Create Challenge</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Create a short invite link to share with a friend. The link will expire in 24 hours.
            </p>
          </div>
          <div>
            <button
              onClick={handleClose}
              className="text-zinc-400 hover:text-white text-sm px-3 py-1 rounded"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-4">
          {!link ? (
            <>
              <div className="text-sm text-zinc-300">Time control</div>
              <div className="mt-2 px-3 py-2 rounded bg-white/3 text-sm w-max font-semibold">
                {tcSeconds}s
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className={`rounded-xl px-4 py-2 font-semibold ${loading ? "bg-white/10" : "bg-emerald-600 hover:bg-emerald-500"}`}
                >
                  {loading ? "Creating…" : "Create Invite"}
                </button>
                <button onClick={handleClose} className="rounded-xl px-4 py-2 bg-white/6">
                  Cancel
                </button>
              </div>

              {error && <div className="mt-3 text-sm text-rose-400">{error}</div>}
            </>
          ) : (
            <>
              <div className="text-sm text-zinc-300">Invite link</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  className="flex-1 rounded px-3 py-2 bg-zinc-800 text-sm text-zinc-100"
                />
                <button onClick={handleCopy} className="rounded px-3 py-2 bg-white/6">
                  <FiCopy />
                </button>
              </div>
              <div className="mt-3 text-xs text-zinc-400">
                {copied ? "Copied to clipboard" : "Share this link with a friend. They can join and the game will start."}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setLink(null)}
                  className="rounded-xl px-4 py-2 bg-white/6 font-semibold"
                >
                  Create another
                </button>
                <button onClick={handleClose} className="rounded-xl px-4 py-2 bg-emerald-600 font-semibold">
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
