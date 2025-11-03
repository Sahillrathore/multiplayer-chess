// src/Landing.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";

function shortEmail(e) {
    if (!e) return "";
    // keep it short for UI: john.doe@ex...
    const [name, domain] = e.split("@");
    if (!domain) return e;
    if (name.length <= 10) return e;
    return `${name.slice(0, 10)}…@${domain}`;
}

export default function Landing() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { token, user } = useSelector((s) => s.auth);
    const isAuthed = !!token;
    const email = user?.email;
    console.log(user);
    
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
            {/* Subtle background word / blob */}
            <div className="pointer-events-none absolute inset-0 opacity-10">
                <div className="absolute -top-16 -right-20 h-[46rem] w-[46rem] rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-black blur-3xl" />
                <div className="absolute -bottom-20 -left-32 h-[40rem] w-[40rem] rounded-full bg-gradient-to-br from-zinc-800 via-black to-black blur-3xl" />
            </div>

            {/* Top nav */}
            <header className="relative z-10">
                <div className="mx-auto max-w-7xl px-5 py-6 flex items-center justify-between">
                    <div className="text-xl tracking-[0.35em] font-semibold">CHESS</div>

                    <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
                        <a className="hover:text-white transition" href="#">Puzzles</a>
                        <a className="hover:text-white transition" href="#">Learn</a>
                        <a className="hover:text-white transition" href="#">Watch</a>
                        <a className="hover:text-white transition" href="#">News</a>
                        <a className="hover:text-white transition" href="#">Social</a>
                        <a className="hover:text-white transition" href="#">More</a>
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
                                {/* small email pill */}
                                <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-200">
                                    <span className="font-medium">{shortEmail(email)}</span>
                                    <span className="text-zinc-400">·</span>
                                    <span className="text-zinc-400 text-[11px]">signed in</span>
                                </div>

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

            {/* Hero */}
            <main className="relative z-10 pt-10">
                <div className="mx-auto max-w-full px-5 pt-6 pb-24 flex flex-col gap-12 justify-center items-center">
                    {/* Left copy */}
                    <div className="max-w-xl flex items-center flex-col text-center">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                            Play Chess Online
                            <br />
                            on the <span className="whitespace-nowrap">#1 Site!</span>
                        </h1>

                        <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-2 text-zinc-300">
                            <div className="text-sm">
                                <span className="font-semibold text-white">18,123,165+</span> Games Today
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold text-white">301,512</span> Playing Now
                            </div>
                        </div>

                        {/* If logged in, show a greeting with the full email under the hero */}
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
                            <button className="px-5 py-2.5 rounded-full text-sm font-semibold bg-zinc-900 border border-white/10 hover:bg-zinc-800">
                                🤖 Play Bots
                            </button>
                        </div>
                    </div>

                    {/* Right image */}
                    <div className="w-[60rem] relative -top-10">
                        <img src="/chess.png" className="h-full w-full" alt="Chess board preview" />
                    </div>
                </div>
            </main>
        </div>
    );
}
