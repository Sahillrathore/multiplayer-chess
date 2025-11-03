// src/pages/AuthPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { PiCrownBold, PiLockFill } from "react-icons/pi";
import { FiArrowRight, FiChevronLeft, FiMail, FiKey } from "react-icons/fi";
import { setToken, setUser } from "../src/store/slices/authSlice";
import { useRequestOtpMutation, useSignupMutation, useLoginMutation } from "../src/store/services/authApi";

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
const PATHS = { /* same paths */
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
const Label = ({ children }) => (
    <label className="text-xs uppercase tracking-wide text-zinc-400 font-medium">{children}</label>
);
const TextInput = React.forwardRef(({ icon, ...props }, ref) => (
    <div className="group mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/60">
        {icon && <span className="text-zinc-500">{icon}</span>}
        <input ref={ref} className="w-full bg-transparent outline-none placeholder:text-zinc-500 text-zinc-100" {...props} />
    </div>
));
TextInput.displayName = "TextInput";
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
const GhostBtn = ({ children, className = "", ...props }) => (
    <button
        {...props}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-semibold text-white/90 hover:bg-white/10 transition ${className}`}
    >
        {children}
    </button>
);
const Divider = () => (
    <div className="relative my-5 mt-7 flex items-center justify-center">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <span className="absolute -translate-y-1/2 bg-znc-950/60 px-2 text-xs text-zinc-300">or</span>
    </div>
);

// ===== Page =====
export default function AuthPage() {
    const dispatch = useDispatch();
    const { token } = useSelector((s) => s.auth);
    const loggedIn = !!token;

    // local UI state only
    const [tab, setTab] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otpPhase, setOtpPhase] = useState(false);
    const [otp, setOtp] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const otpRefs = useRef([]);

    // RTKQ mutations
    const [requestOtpMut] = useRequestOtpMutation();
    const [signupMut] = useSignupMutation();
    const [loginMut] = useLoginMutation();

    useEffect(() => {
        setErr("");
        setMsg("");
    }, [tab, otpPhase]);

    const googleSignIn = () => {
        window.location.href = `${API_BASE}/auth/google`;
    };

    // ----- Actions using RTK Query -----
    async function requestOtp() {
        setBusy(true); setErr(""); setMsg("");
        try {
            const data = await requestOtpMut({ email }).unwrap();
            setOtpPhase(true);
            setMsg(data?.message || "OTP sent! Check your email (valid for 5 minutes).");
        } catch (e) {
            setErr(e?.data?.error || e?.error || "Failed to send OTP");
        } finally {
            setBusy(false);
        }
    }

    async function signup() {
        setBusy(true); setErr(''); setMsg('');
        try {
            const data = await signupMut({ email, otp, password }).unwrap();
            // assume data = { token: '...', user: { id, email, name } }
            dispatch(setToken(data.token));

            if (data.user) dispatch(setUser(data.user));
            setMsg('Signup successful! Redirecting…');
            setTimeout(() => window.location.replace('/'), 600);
        } catch (e) {
            setErr(e?.data?.error || e?.error || 'Signup failed');
        } finally {
            setBusy(false);
        }
    }

    async function login() {
        setBusy(true); setErr(''); setMsg('');
        try {
            const data = await loginMut({ email, password }).unwrap();
            console.log('LOGIN response:', data); // debug
            dispatch(setToken(data.token));
            if (data.user) {
                dispatch(setUser(data.user));
            } else {
                // fallback: fetch profile via RTK Query
                // await dispatch(authApi.endpoints.me.initiate()).unwrap();
            }
            setMsg('Login successful! Redirecting…');
            setTimeout(() => window.location.replace('/'), 600);
        } catch (e) {
            setErr(e?.data?.error || e?.error || 'Login failed');
        } finally {
            setBusy(false);
        }
    }

    // ----- OTP UI helpers (kept same) -----
    const setOtpAt = (i, v) => {
        const next = (otp || "").padEnd(6, " ").split("");
        next[i] = v;
        setOtp(next.join("").replace(/ /g, ""));
    };
    const handleOtpChange = (i) => (e) => {
        const val = e.target.value.replace(/\D/g, "").slice(-1);
        setOtpAt(i, val);
        if (val && i < 5) otpRefs.current[i + 1]?.focus();
    };
    const handleOtpKeyDown = (i) => (e) => {
        const value = (otp || "")[i] || "";
        if (e.key === "Backspace") {
            if (value) setOtpAt(i, "");
            else if (i > 0) { otpRefs.current[i - 1]?.focus(); setOtpAt(i - 1, ""); }
        } else if (e.key === "ArrowLeft" && i > 0) otpRefs.current[i - 1]?.focus();
        else if (e.key === "ArrowRight" && i < 5) otpRefs.current[i + 1]?.focus();
    };
    const handleOtpPaste = (i) => (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6 - i);
        if (!pasted) return;
        const next = (otp || "").padEnd(6, " ").split("");
        for (let k = 0; k < pasted.length; k++) next[i + k] = pasted[k];
        setOtp(next.join("").replace(/ /g, ""));
        const lastIndex = Math.min(i + pasted.length - 1, 5);
        otpRefs.current[lastIndex]?.focus();
    };

    const otpCells = useMemo(() => (otp || "").slice(0, 6).padEnd(6, " ").split(""), [otp]);

    // ===== UI =====
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

            <div className="relative mx-auto max-w-xl px-6 py-16">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}>
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

                            {/* tabs */}
                            <div className="mb-6 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setTab("login")}
                                    className={`rounded-xl px-4 py-2.5 font-semibold transition border border-white/10 ${tab === "login" ? "bg-white/10 text-white ring-2 ring-indigo-500/50"
                                        : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => setTab("signup")}
                                    className={`rounded-xl px-4 py-2.5 font-semibold transition border border-white/10 ${tab === "signup" ? "bg-white/10 text-white ring-2 ring-fuchsia-500/50"
                                        : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                                >
                                    Sign up
                                </button>
                            </div>

                            {/* email */}
                            <div>
                                <Label>Email</Label>
                                <TextInput
                                    icon={<FiMail />}
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={busy || (tab === "signup" && otpPhase)}
                                />
                            </div>

                            {/* LOGIN */}
                            {tab === "login" && (
                                <div className="mt-4">
                                    <Label>Password</Label>
                                    <TextInput
                                        icon={<FiKey />}
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={busy}
                                    />

                                    <PrimaryBtn onClick={login} disabled={busy || !email || !password} loading={busy}>
                                        <PiLockFill className="opacity-90" />
                                        <p>Login</p>
                                    </PrimaryBtn>
                                </div>
                            )}

                            {/* SIGNUP */}
                            {tab === "signup" && (
                                <div className="mt-2">
                                    {!otpPhase ? (
                                        <>
                                            <p className="mt-1 text-xs text-zinc-400">We’ll email a 6-digit OTP to verify your address.</p>
                                            <PrimaryBtn onClick={requestOtp} disabled={busy || !email} loading={busy}>
                                                Send OTP <FiArrowRight />
                                            </PrimaryBtn>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mt-3">
                                                <Label>OTP</Label>
                                                <div className="mt-2 grid grid-cols-6 gap-2">
                                                    {Array.from({ length: 6 }).map((_, i) => {
                                                        const val = (otp || "")[i] ?? "";
                                                        const active = !!val;
                                                        return (
                                                            <input
                                                                key={i}
                                                                ref={(el) => { if (el) otpRefs.current[i] = el; }}
                                                                inputMode="numeric"
                                                                autoComplete="one-time-code"
                                                                maxLength={1}
                                                                value={val}
                                                                onChange={handleOtpChange(i)}
                                                                onKeyDown={handleOtpKeyDown(i)}
                                                                onPaste={handleOtpPaste(i)}
                                                                className={[
                                                                    "h-12 w-full text-center rounded-xl border text-lg font-bold tracking-wider outline-none",
                                                                    "focus:ring-2 transition",
                                                                    active
                                                                        ? "border-indigo-400/60 bg-indigo-400/10 text-white focus:ring-indigo-400/60"
                                                                        : "border-white/10 bg-white/5 text-zinc-300 focus:ring-indigo-400/40",
                                                                ].join(" ")}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <Label>Create password</Label>
                                                <TextInput
                                                    type="password"
                                                    placeholder="Minimum 6 characters"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    disabled={busy}
                                                />
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                <PrimaryBtn onClick={signup} disabled={busy || !otp || !password} loading={busy}>
                                                    Create account
                                                </PrimaryBtn>
                                                <GhostBtn onClick={() => setOtpPhase(false)} disabled={busy}>
                                                    <FiChevronLeft /> Back
                                                </GhostBtn>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <Divider />

                            <button
                                onClick={googleSignIn}
                                className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white text-zinc-900 px-4 py-2.5 font-semibold shadow hover:bg-zinc-50 transition"
                            >
                                <FcGoogle className="text-xl" /> Continue with Google
                            </button>

                            {/* messages */}
                            {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
                            {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}

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
