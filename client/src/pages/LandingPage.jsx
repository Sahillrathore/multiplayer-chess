// src/Landing.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";
import LightRays from "../components/LightRays";

function shortEmail(e) {
    if (!e) return "";
    const [name, domain] = e.split("@");
    if (!domain) return e;
    if (name.length <= 10) return e;
    return `${name.slice(0, 10)}…@${domain}`;
}

/* 🔳 Subtle grid overlay */
function GridOverlay() {
    return (
        <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-[0.7]"
            style={{
                backgroundImage:
                    `repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 40px),
                     repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 40px)`,
                backgroundSize: "40px 40px",
                // mixBlendMode: "overlay",
            }}
        />
    );
}

export default function Landing() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { token, user } = useSelector((s) => s.auth);
    const isAuthed = !!token;
    const email = user?.email;

    const handlePlay = () => {
        if (isAuthed) navigate("/play");
        else navigate("/login");
    };

    const handleLogout = () => {
        dispatch(logout());
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">

            {/* 🔳 New Grid Background */}
            <GridOverlay />

            {/* 🔆 Light Rays */}
            <div style={{ width: "100%", height: "600px", position: "absolute", top: 0 }}>
                <LightRays
                    raysOrigin="top-center"
                    raysColor="#E9D8BF"
                    raysSpeed={0.6}
                    lightSpread={0.8}
                    rayLength={1.2}
                    followMouse={false}
                    mouseInfluence={0.1}
                    noiseAmount={0.1}
                    distortion={0.05}
                />
            </div>

            {/* 🌫️ Enhanced gradient blobs */}
            <div className="pointer-events-none absolute inset-0 opacity-20">
                <div className="absolute -top-32 -right-40 h-[48rem] w-[48rem] rounded-full bg-gradient-to-br from-zinc-600 via-zinc-800 to-black blur-3xl" />
                <div className="absolute -bottom-32 -left-40 h-[42rem] w-[42rem] rounded-full bg-gradient-to-br from-zinc-700 via-black to-black blur-3xl" />
            </div>

            {/* 🔘 Soft vignette to focus center */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent,rgba(0,0,0,0.7))]" />

            {/* -------- NAV -------- */}
            <header className="relative z-10">
                <div className="mx-auto max-w-7xl px-5 py-6 flex items-center justify-between">
                    <div className="text-xl tracking-[0.35em] font-semibold">CHESS</div>

                    <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
                        <Link to="/play" className="hover:text-white transition">Play</Link>
                        <Link to="/practice" className="hover:text-white transition">Learn</Link>
                        <Link to="/blogs" className="hover:text-white transition">News</Link>
                        <Link to="/practice" className="hover:text-white transition">Practice</Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        {!isAuthed ? (
                            <>
                                <Link
                                    to="/login"
                                    className="hidden sm:inline-block px-4 py-2 rounded-full text-sm font-medium border border-white/15 hover:bg-white/5"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/login"
                                    className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-black hover:bg-white/90"
                                >
                                    Sign In
                                </Link>
                            </>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-black hover:bg-white/90"
                                    title={email || "Logout"}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* -------- HERO -------- */}
            <main className="relative z-10 pt-10">
                <div className="mx-auto max-w-full px-5 pt-6 pb-0 flex flex-col gap-12 justify-center items-center">

                    {/* TEXT SECTION */}
                    <div className="max-w-xl flex items-center flex-col text-center">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] font-serif">
                            Play Chess Online
                            <br />
                            on the <span className="whitespace-nowrap text-white/90">#1 Site!</span>
                        </h1>

                        <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-2 text-zinc-300">
                            <div className="text-sm">
                                <span className="font-semibold text-white">18,123,165+</span> Games Today
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold text-white">301,512</span> Playing Now
                            </div>
                        </div>

                        {isAuthed && email && (
                            <div className="mt-4 rounded-xl bg-white/5 px-4 py-2 text-sm text-zinc-100">
                                Welcome, <span className="font-semibold">{email}</span>
                            </div>
                        )}

                        <div className="mt-7 flex items-center gap-3">
                            <button
                                onClick={handlePlay}
                                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-white/90 shadow"
                            >
                                ▶ Play Online
                            </button>
                            <Link to="/practice" className="px-5 py-2.5 rounded-full text-sm font-semibold bg-zinc-900 border border-white/10 hover:bg-zinc-800">
                                🤖 Play Bots
                            </Link>
                        </div>
                    </div>

                    {/* IMAGE SECTION */}
                    <div className="w-[60rem] relative -top-10">
                        <img src="/chess2.png" className="h-full w-full" alt="Chess board preview" />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 mt-10 border-t border-white/10">
                <div className="mx-auto max-w-7xl px-5 py-6 flex flex-col sm:flex-row items-center justify-between text-sm text-zinc-400">

                    <div className="flex items-center gap-1">
                        Made with
                        <span className="text-red-500 text-base">❤️</span>
                        by <span className="font-medium text-white">Sahil Rathore</span>
                    </div>

                    <a
                        href="https://github.com/Sahillrathore/multiplayer-chess"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition"
                    >
                        ⭐ View GitHub Repo
                    </a>

                </div>
            </footer>

        </div>
    );
}
