"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PaperPlaneRight, CheckCircle } from "@phosphor-icons/react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#@$%";

type Msg = { id: string; role: "assistant" | "user"; text: string };
const mkId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Scramble hook ─────────────────────────────────────────────────────────────
function useScramble(target: string, delay = 0) {
  const [text, setText] = useState(target);
  const raf = useRef<number>(0);
  const frame = useRef(0);
  useEffect(() => {
    let iter = 0;
    const t = setTimeout(() => {
      const tick = () => {
        setText(target.split("").map((c, i) => {
          if (c === " ") return " ";
          if (i < iter) return c;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join(""));
        if (iter < target.length + 1) {
          frame.current++;
          if (frame.current % 2 === 0) iter++;
          raf.current = requestAnimationFrame(tick);
        }
      };
      raf.current = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf.current); };
  }, [target, delay]);
  return text;
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "6px 0" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "block", width: 7, height: 7, borderRadius: "50%",
          background: "#9cef46",
          animation: `blink 1.2s ease-in-out ${i * 0.22}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
const STEPS = ["Basics", "Lifestyle", "Health", "History", "Done"];

function ProgressBar({ step }: { step: number }) {
  const pct = Math.min(100, (step / (STEPS.length - 1)) * 100);
  return (
    <div style={{ padding: "0.9rem 1.5rem 0", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        {STEPS.map((s, i) => (
          <span key={s} style={{
            fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: i <= step ? "#3d5425" : "#b0c890",
            transition: "color 0.4s",
          }}>{s}</span>
        ))}
      </div>
      <div style={{ height: 3, background: "#e7f2c6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", background: "linear-gradient(90deg, #9cef46, #7ecf30)",
          width: `${pct}%`, borderRadius: 99,
          transition: "width 0.6s cubic-bezier(0.32,0.72,0,1)",
        }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardClient() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"loading" | "ok">("loading");
  const [user, setUser] = useState<{ name?: string; picture?: string; db_id?: string }>({});
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const heading = useScramble("Let's set up your health profile", 500);
  const firstName = user.name?.split(" ")[0] ?? "there";

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // ── Auth gate + onboard status check ─────────────────────────────────────
  useEffect(() => {
    const hash = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    );
    const incoming = hash.get("token") || new URLSearchParams(window.location.search).get("token") || "";
    if (incoming) {
      localStorage.setItem("authToken", incoming);
      window.history.replaceState({}, "", "/onboard");
    }
    const storedToken = incoming || localStorage.getItem("authToken") || "";
    if (!storedToken) { router.replace("/"); return; }
    setToken(storedToken);

    fetch(`${apiBase}/auth/verify`, { headers: { Authorization: `Bearer ${storedToken}`, "ngrok-skip-browser-warning": "true" } })
      .then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(data => {
        // If profile already complete → skip to home
        if (data.is_profile_complete) { router.replace("/home"); return; }
        setUser({ name: data.name, picture: data.picture, db_id: data.db_id });
        setAuthState("ok");
      })
      .catch(() => { localStorage.removeItem("authToken"); router.replace("/"); });
  }, [router]);

  // ── Start session once auth is ready ─────────────────────────────────────
  useEffect(() => {
    if (authState !== "ok" || !user.db_id) return;
    fetch(`${apiBase}/onboard/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ db_id: user.db_id }),
    })
      .then(r => r.json())
      .then(data => {
        setSessionId(data.session_id);
        setMessages([{ id: mkId(), role: "assistant", text: data.first_message }]);
      })
      .catch(console.error);
  }, [authState, user.db_id, token]);

  // ── Heuristic step counter based on message count ──────────────────────
  useEffect(() => {
    const msgCount = messages.filter(m => m.role === "user").length;
    setStep(Math.min(STEPS.length - 2, Math.floor(msgCount / 3)));
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (content?: string) => {
    const text = (content ?? input).trim();
    if (!text || !sessionId || typing || done) return;

    setMessages(p => [...p, { id: mkId(), role: "user", text }]);
    setInput("");
    setTyping(true);
    if (textRef.current) { textRef.current.style.height = "auto"; }

    try {
      const res = await fetch(`${apiBase}/onboard/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ session_id: sessionId, db_id: user.db_id, message: text }),
      });
      const data = await res.json();
      setMessages(p => [...p, { id: mkId(), role: "assistant", text: data.reply }]);

      if (data.profile_complete) {
        setStep(STEPS.length - 1);
        setDone(true);
        // Give user a moment to see the completion message, then redirect
        setTimeout(() => router.replace("/home"), 3200);
      }
    } catch {
      setMessages(p => [...p, { id: mkId(), role: "assistant", text: "Oops, something glitched — try again?" }]);
    } finally {
      setTyping(false);
    }
  }, [input, sessionId, typing, done, token, user.db_id, router]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authState === "loading") return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f7e5", fontFamily: "'Lexend',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "2.5px solid #e7f2c6", borderTopColor: "#9cef46", borderRadius: "50%", animation: "spin .75s linear infinite", margin: "0 auto 1rem" }} />
        <p style={{ color: "#607a3d", fontSize: ".85rem", fontWeight: 500 }}>Setting up your space…</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f3f7e5", fontFamily: "'Lexend',sans-serif", color: "#1f2b16" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }

        @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes popIn { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

        /* Fixed chrome — never scrolls */
        .ob-fixed-top {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
        }

        .ob-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: .85rem 1.5rem;
          background: rgba(255,255,255,.7);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(31,43,22,.07);
        }
        .ob-brand { display:flex; align-items:center; gap:.5rem; }
        .ob-brand img { width:28px; height:28px; border-radius:8px; }
        .ob-brand-name { font-size:.95rem; font-weight:800; letter-spacing:-.03em; }
        .ob-user { display:flex; align-items:center; gap:.5rem; }
        .ob-avatar { width:30px; height:30px; border-radius:50%; border:2px solid rgba(156,239,70,.5); object-fit:cover; }
        .ob-user-name { font-size:.78rem; font-weight:500; color:#3d5425; }

        .ob-heading-block {
          padding: 1.1rem 1.5rem .4rem;
          flex-shrink: 0;
          animation: fadeUp .6s cubic-bezier(0.32,.72,0,1) both;
        }
        .ob-heading { font-size:clamp(.95rem,3vw,1.15rem); font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
        .ob-sub { font-size:.78rem; color:#607a3d; margin-top:.25rem; }

        .ob-chat {
          flex:1; overflow-y:auto; padding:1rem 1.5rem;
          display:flex; flex-direction:column; gap:.7rem;
          scroll-behavior:smooth;
        }
        .ob-chat::-webkit-scrollbar { width:4px; }
        .ob-chat::-webkit-scrollbar-thumb { background:rgba(31,43,22,.12); border-radius:99px; }

        /* Message bubbles */
        .ob-row { display:flex; }
        .ob-row.user { justify-content:flex-end; animation:slideIn .35s cubic-bezier(0.32,.72,0,1) both; }
        .ob-row.assistant { justify-content:flex-start; animation:fadeUp .4s cubic-bezier(0.32,.72,0,1) both; }

        .ob-bubble {
          max-width: 78%; padding: .7rem 1rem;
          font-size: .85rem; line-height: 1.65;
          box-shadow: 0 2px 10px rgba(31,43,22,.07);
        }
        .ob-bubble.user {
          background: #1f2b16; color: #eef6d0;
          border-radius: 1.2rem 1.2rem 0.3rem 1.2rem;
        }
        .ob-bubble.assistant {
          background: rgba(255,255,255,.90);
          border: 1px solid rgba(31,43,22,.07);
          border-radius: 1.2rem 1.2rem 1.2rem 0.3rem;
          backdrop-filter: blur(8px);
        }

        /* Assistant avatar dot */
        .ob-arow { display:flex; gap:.5rem; align-items:flex-end; }
        .ob-adot {
          width:28px; height:28px; flex-shrink:0; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          margin-bottom:2px; position:relative; overflow:hidden;
          background: rgba(156,239,70,.15);
          box-shadow: 0 2px 8px rgba(31,43,22,.08);
        }

        /* Done banner */
        .ob-done {
          display:flex; flex-direction:column; align-items:center; gap:.6rem;
          padding:1.4rem; margin:.5rem 1.5rem;
          background:rgba(156,239,70,.13);
          border:1px solid rgba(156,239,70,.35);
          border-radius:1.2rem;
          animation:popIn .5s cubic-bezier(0.32,.72,0,1) both;
          text-align:center;
        }
        .ob-done-title { font-size:.95rem; font-weight:700; color:#1f2b16; }
        .ob-done-sub { font-size:.78rem; color:#607a3d; }

        /* Input bar */
        .ob-input-bar {
          padding: .85rem 1.5rem;
          background: rgba(255,255,255,.55);
          backdrop-filter: blur(10px);
          border-top: 1px solid rgba(31,43,22,.07);
          flex-shrink: 0;
        }
        .ob-input-row {
          display:flex; gap:.55rem; align-items:flex-end;
          background:rgba(255,255,255,.9);
          border:1px solid rgba(31,43,22,.11);
          border-radius:1.25rem;
          padding:.5rem .5rem .5rem .95rem;
          box-shadow:0 3px 14px rgba(31,43,22,.06);
          transition:box-shadow .2s,border-color .2s;
        }
        .ob-input-row:focus-within {
          border-color:rgba(156,239,70,.55);
          box-shadow:0 0 0 3px rgba(156,239,70,.12),0 3px 14px rgba(31,43,22,.06);
        }
        .ob-textarea {
          flex:1; resize:none; border:none; outline:none;
          background:transparent; font-family:inherit;
          font-size:.85rem; color:#1f2b16;
          min-height:22px; max-height:100px; line-height:1.55;
        }
        .ob-textarea::placeholder { color:#8aaa60; }
        .ob-send {
          width:34px; height:34px; border-radius:50%; flex-shrink:0;
          border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          background:#1f2b16; color:#9cef46;
          transition:transform .2s,box-shadow .2s;
        }
        .ob-send:hover:not(:disabled) { transform:translateY(-1px) scale(1.06); box-shadow:0 6px 16px rgba(31,43,22,.28); }
        .ob-send:disabled { opacity:.4; cursor:not-allowed; }

        /* Quick chips */
        .ob-chips { display:flex; flex-wrap:wrap; gap:.35rem; margin:.5rem 0 0; }
        .ob-chip {
          background:rgba(255,255,255,.8); border:1px solid rgba(31,43,22,.10);
          border-radius:100px; padding:.3rem .75rem;
          font-size:.72rem; font-weight:500; color:#1f2b16;
          cursor:pointer; font-family:inherit;
          transition:background .18s,transform .18s;
        }
        .ob-chip:hover { background:#eef6d0; transform:translateY(-1px); }

        .ob-hint { font-size:.65rem; color:#8aaa60; margin-top:.4rem; text-align:center; }
      `}</style>

      {/* ── Fixed top chrome: topbar + heading + progress ── */}
      <div className="ob-fixed-top">
        <header className="ob-topbar">
          <div className="ob-brand">
            <img src="/logo.svg" alt="Kairo" />
            <span className="ob-brand-name">Kairo</span>
          </div>
          <div className="ob-user">
            {user.picture
              ? <img src={user.picture} alt={firstName} className="ob-avatar" />
              : <div className="ob-avatar" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".8rem", fontWeight: 700, background: "#e7f2c6", color: "#3d5425" }}>{firstName[0]}</div>
            }
            <span className="ob-user-name">{firstName}</span>
          </div>
        </header>

        <div className="ob-heading-block">
          <h1 className="ob-heading">{heading}</h1>
          <p className="ob-sub">Chat with Aroo · takes about 3 minutes</p>
        </div>

        <ProgressBar step={step} />
      </div>

      {/* ── Scrollable chat ── */}
      <div className="ob-chat" ref={scrollRef} role="log" aria-live="polite">
        {messages.map(m => (
          <div key={m.id} className={`ob-row ${m.role}`}>
            {m.role === "assistant" ? (
              <div className="ob-arow">
                <div className="ob-adot">
                  <Image src="/smile.svg" alt="Aroo" fill style={{ objectFit: "cover" }} />
                </div>
                <div className="ob-bubble assistant">
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.text}</p>
                </div>
              </div>
            ) : (
              <div className="ob-bubble user">
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.text}</p>
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="ob-row assistant">
            <div className="ob-arow">
              <div className="ob-adot">
                <Image src="/smile.svg" alt="Aroo" fill style={{ objectFit: "cover" }} />
              </div>
              <div className="ob-bubble assistant"><TypingDots /></div>
            </div>
          </div>
        )}

        {done && (
          <div className="ob-done">
            <CheckCircle size={32} weight="fill" color="#9cef46" />
            <span className="ob-done-title">Profile complete!</span>
            <span className="ob-done-sub">Redirecting you to your dashboard…</span>
          </div>
        )}
      </div>

      {/* ── Pinned input bar ── */}
      {!done && (
        <div className="ob-input-bar">
          {messages.filter(m => m.role === "user").length === 0 && (
            <div className="ob-chips">
              {["Let's go!", "Sure, what do you need?", "Hit me with the questions"].map(c => (
                <button key={c} className="ob-chip" onClick={() => send(c)}>{c}</button>
              ))}
            </div>
          )}
          <div className="ob-input-row" style={{ marginTop: messages.filter(m => m.role === "user").length === 0 ? ".5rem" : 0 }}>
            <textarea
              ref={textRef}
              className="ob-textarea"
              placeholder="Reply to Aroo…"
              value={input}
              rows={1}
              onChange={e => {
                setInput(e.target.value);
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 100)}px`;
              }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="ob-send" onClick={() => send()} disabled={typing || !input.trim()} aria-label="Send">
              <PaperPlaneRight size={15} weight="fill" />
            </button>
          </div>
          <p className="ob-hint">Enter to send · Shift+Enter for new line</p>
        </div>
      )}
    </div>
  );
}
