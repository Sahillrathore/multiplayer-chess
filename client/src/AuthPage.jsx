// src/pages/AuthPage.jsx
import React from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { PiCrownBold } from "react-icons/pi";
import { BiCheck } from "react-icons/bi";
import { FaGithub, FaGoogle } from "react-icons/fa6";

const API_BASE = import.meta.env.VITE_API_BASE;

// ===== UI bits kept as-is =====
const Piece = ({ d, delay = 0, size = 28, rotate = 6, x = 0, y = 0 }) => (
    <motion.svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="opacity-40 drop-shadow-[0_0_8px_rgba(99,102,241,0.55)]"
        style={{ position: "absolute", left: x, top: y }}
        initial={{ y: 0, rotate: 0 }}
        animate={{ y: [0, -8, 0], rotate: [0, rotate, 0] }}
        transition={{ duration: 6, delay, repeat: Infinity, ease: "easeInOut" }}
    >
        <path d={d} fill="currentColor" className="text-indigo-300" />
    </motion.svg>
);
const PATHS = {
    king: "M12 2a2 2 0 0 1 2 2v1h1a1 1 0 1 1 0 2h-1v1h2a1 1 0 1 1 0 2h-1.11l.85 5.1A3 3 0 0 1 12.79 20H11.2a3 3 0 0 1-2.95-2.9l.85-5.1H8a1 1 0 1 1 0-2h2V7H9a1 1 0 1 1 0-2h1V4a2 2 0 0 1 2-2Z",
    queen: "M6 9a2 2 0 1 1 2.5 1.94L9 14h6l.5-3.06A2 2 0 1 1 18 9a2 2 0 1 1-3.5 1.32L14 14h-4l-.5-3.68A2 2 0 1 1 6 9Zm2 7h8a2 2 0 0 1 2 2v1H6v-1a2 2 0 0 1 2-2Z",
    knight: "M7 19h10v-1a3 3 0 0 0-3-3h-1l-2-3-3 2 1 2H8a3 3 0 0 0-3 3v1h2Zm8-11-1-3H8l-2 4 3 1 2-2 2 2 2-2Z",
    pawn: "M12 12a3 3 0 1 0-2.83-4H9a3 3 0 0 0 3 4Zm-5 7h10v-1a5 5 0 0 0-10 0v1Z",
};
const GlowCard = ({ children }) => (
    <div className="relative">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-60" />
        <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl">
            {children}
        </div>
    </div>
);

const PrimaryBtn = ({ children, loading, className = "", ...props }) => (
    <button
        {...props}
        className={`relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-900/30 transition active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
        <AnimatePresence initial={false}>
            {loading ? (
                <motion.span key="spinner" className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : null}
        </AnimatePresence>
        <span className="flex items-center gap-2">{children}</span>
    </button>
);

export default function AuthPage() {
    const { token } = useSelector((s) => s.auth);
    const loggedIn = !!token;

    const googleSignIn = () => {
        // Redirect user to backend Google auth endpoint
        window.location.href = `${API_BASE}/auth/google`;
    };

    return (
        <div className="min-h-screen w-full bg-zinc-950 relative overflow-hidden">
            {/* background */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -inset-40 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,.18),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(244,63,94,.15),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(250,204,21,.12),transparent_45%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.06)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06)_76%,transparent_77%),linear-gradient(90deg,transparent_24%,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.06)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06)_76%,transparent_77%)] bg-[size:48px_48px] opacity-30" />
            </div>

            {/* floating pieces */}
            <Piece d={PATHS.king} delay={0.2} size={40} x={40} y={80} />
            <Piece d={PATHS.queen} delay={1.2} size={34} x={window.innerWidth - 100} y={120} />
            <Piece d={PATHS.knight} delay={0.8} size={36} x={120} y={window.innerHeight - 200} />
            <Piece d={PATHS.pawn} delay={1.8} size={30} x={window.innerWidth - 160} y={window.innerHeight - 160} />

            <div className="relative mx-auto max-w-xl px-6 py-16 mt-20">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <GlowCard>
                        <div className="p-6 sm:p-8">
                            {/* header */}
                            <div className="mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg">
                                        <PiCrownBold className="text-xl" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-black tracking-tight text-white">WeChess</h1>
                                        <p className="text-xs text-zinc-400">Sign in to start a match</p>
                                    </div>
                                </div>
                            </div>

                            <div className="my-2 mb-6">
                                <h2 className="text-2xl font-semibold text-zinc-100">Join the community of chessplayers</h2>
                                <div>
                                    <p className="flex gap-2 text-sm text-gray-100 items-center mt-2 animate-pulse"><BiCheck /> Play online </p>
                                    <p className="flex gap-2 text-sm text-gray-100 items-center mt-2 animate-pulse"><BiCheck /> Play Multiplayer </p>
                                </div>
                            </div>

                            {/* Single auth option: Google */}
                            <div>
                                <PrimaryBtn
                                    onClick={googleSignIn}
                                    // className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white text-zinc-900 px-4 py-2.5 font-semibold shadow hover:bg-zinc-50 transition"
                                >
                                    <FaGoogle className="text-xl" /> Continue with Google
                                </PrimaryBtn>

                                <PrimaryBtn
                                    onClick={googleSignIn}
                                    // className="inline-flex mt-3 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white text-zinc-900 px-4 py-2.5 font-semibold shadow hover:bg-zinc-50 transition"
                                >
                                    <FaGithub className="text-xl" /> Continue with Github
                                </PrimaryBtn>
                            </div>

                            {loggedIn && (
                                <p className="mt-4 text-xs text-zinc-400">
                                    Already signed in.{" "}
                                    <a href="/" className="font-semibold text-indigo-400 underline-offset-4 hover:underline">
                                        Go to game
                                    </a>
                                </p>
                            )}
                        </div>
                    </GlowCard>
                </motion.div>

                <div className="mx-auto mt-6 max-w-xl text-center text-[11px] text-zinc-500">
                    By continuing you agree to our <span className="text-zinc-300">Terms</span> and <span className="text-zinc-300">Privacy</span>.
                </div>
            </div>
        </div>
    );
}
