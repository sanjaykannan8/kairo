"use client";

import { useEffect, useRef, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";

function useScramble(target: string, delay = 0) {
  const [text, setText] = useState(target);
  const frame = useRef(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    let iteration = 0;
    const timeout = setTimeout(() => {
      const animate = () => {
        setText(
          target
            .split("")
            .map((char, i) => {
              if (char === " ") return " ";
              if (i < iteration) return target[i];
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join("")
        );
        if (iteration < target.length + 1) {
          frame.current++;
          if (frame.current % 2 === 0) iteration++;
          raf.current = requestAnimationFrame(animate);
        }
      };
      raf.current = requestAnimationFrame(animate);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf.current);
    };
  }, [target, delay]);

  return text;
}

// Minimal matrix rain canvas — isolated, pointer-events-none
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const cols: number[] = [];
    const fontSize = 13;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.floor(canvas.width / fontSize);
      cols.length = 0;
      for (let i = 0; i < count; i++) cols.push(Math.random() * -canvas.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      ctx.fillStyle = "rgba(243,247,229,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      cols.forEach((y, i) => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * fontSize;
        // Faint green chars
        const alpha = Math.random() * 0.18 + 0.04;
        ctx.fillStyle = `rgba(80,160,30,${alpha})`;
        ctx.fillText(char, x, y);
        cols[i] = y > canvas.height + Math.random() * 1000
          ? -fontSize * 5
          : y + fontSize;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 1,
      }}
      aria-hidden
    />
  );
}

export default function LoginPage() {
  const loginUrl = `${apiBase}/auth/google/login`;
  const brand = useScramble("Kairo", 200);
  const tagline = useScramble("Prevent disease before it begins.", 900);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:      #f3f7e5;
          --surface: #e7f2c6;
          --accent:  #9cef46;
          --ink:     #1f2b16;
          --ink-mid: #3d5425;
          --ink-soft:#607a3d;
          --white:   #ffffff;
          --ease:    cubic-bezier(0.32,0.72,0,1);
        }

        html, body { height: 100%; font-family: 'Lexend', sans-serif; -webkit-font-smoothing: antialiased; background: var(--bg); }

        .page {
          position: relative;
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 1fr;
          overflow: hidden;
          background: var(--bg);
        }

        /* desktop split */
        @media (min-width: 960px) {
          .page { grid-template-columns: 1fr 1fr; }
        }

        /* ── Left panel ── */
        .panel-left {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: clamp(2rem, 6vw, 5rem) clamp(1.5rem, 6vw, 5rem);
          min-height: 100dvh;
          z-index: 1;
        }

        /* ── Right panel (mascot) — desktop only ── */
        .panel-right {
          display: none;
          position: relative;
          overflow: hidden;
          background: linear-gradient(145deg, #d6f09c 0%, #b2e04e 50%, #96d030 100%);
        }
        @media (min-width: 960px) {
          .panel-right { display: flex; align-items: center; justify-content: center; }
        }

        .mascot-float {
          width: clamp(180px, 28vw, 300px);
          filter: drop-shadow(0 24px 48px rgba(31,43,22,0.22));
          animation: floatY 5s ease-in-out infinite;
          position: relative;
          z-index: 2;
        }
        @keyframes floatY {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }

        /* Right panel pill badge */
        .rp-badge {
          position: absolute;
          top: 2.2rem; right: 2.2rem;
          background: rgba(31,43,22,0.85);
          color: #cef07a;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 0.45em 1em;
          border-radius: 100px;
          z-index: 3;
          animation: popIn 0.5s 1.2s var(--ease) both;
        }
        .rp-badge::before {
          content: '';
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #9cef46;
          margin-right: 0.45em;
          vertical-align: middle;
          box-shadow: 0 0 6px #9cef46;
          animation: pulseGlow 2s ease-in-out infinite;
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.7) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseGlow {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

        /* ── Brand ── */
        .brand-row {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          margin-bottom: 2rem;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
        }
        .brand-row.in { opacity: 1; transform: translateY(0); }

        .logo-wrap {
          width: 44px; height: 44px;
          border-radius: 12px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(31,43,22,0.14);
        }
        .logo-wrap img { width: 100%; height: 100%; display: block; }

        .brand-name {
          font-size: clamp(1.6rem, 5vw, 2.2rem);
          font-weight: 800;
          color: var(--ink);
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
        }

        /* ── Tagline ── */
        .tagline-block {
          margin-bottom: 2.8rem;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.6s 0.1s var(--ease), transform 0.6s 0.1s var(--ease);
        }
        .tagline-block.in { opacity: 1; transform: translateY(0); }

        .tagline {
          font-size: clamp(1rem, 3.2vw, 1.3rem);
          font-weight: 400;
          color: var(--ink-mid);
          line-height: 1.5;
          max-width: 36ch;
          font-variant-numeric: tabular-nums;
        }

        /* ── Auth card ── */
        .auth-card {
          width: 100%;
          max-width: 400px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s 0.2s var(--ease), transform 0.6s 0.2s var(--ease);
        }
        .auth-card.in { opacity: 1; transform: translateY(0); }

        /* double-bezel outer shell */
        .card-shell {
          background: rgba(231,242,198,0.55);
          border: 1px solid rgba(31,43,22,0.08);
          border-radius: 2rem;
          padding: 6px;
          box-shadow: 0 24px 60px rgba(31,43,22,0.10), 0 2px 8px rgba(31,43,22,0.06);
        }

        /* inner core */
        .card-core {
          background: rgba(255,255,255,0.90);
          border-radius: calc(2rem - 6px);
          padding: clamp(1.4rem, 4vw, 2rem);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .card-eyebrow {
          font-size: 0.67rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-soft);
        }

        .card-heading {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.02em;
          line-height: 1.3;
          margin-top: -0.2rem;
        }

        /* Features */
        .features {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin: 0.2rem 0;
        }
        .feat-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.55rem 0.7rem;
          border-radius: 0.75rem;
          background: rgba(156,239,70,0.08);
          border: 1px solid rgba(156,239,70,0.2);
        }
        .feat-icon {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: var(--surface);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 0.85rem;
        }
        .feat-text {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--ink-mid);
        }

        /* Divider */
        .divider {
          display: flex; align-items: center; gap: 0.6rem;
        }
        .div-line { flex: 1; height: 1px; background: rgba(31,43,22,0.10); }
        .div-label {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-soft);
        }

        /* Buttons */
        .btn {
          display: flex; align-items: center; justify-content: center;
          gap: 0.65rem;
          width: 100%; padding: 0.85rem 1.4rem;
          border-radius: 100px; border: none;
          cursor: pointer;
          font-family: 'Lexend', sans-serif;
          font-size: 0.88rem; font-weight: 600;
          letter-spacing: 0.01em;
          transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease), background 0.18s ease;
          outline: none;
          position: relative; overflow: hidden;
        }
        .btn:active { transform: scale(0.975); }

        .btn-google {
          background: var(--white);
          color: var(--ink);
          box-shadow: 0 0 0 1.5px rgba(31,43,22,0.10), 0 3px 12px rgba(31,43,22,0.07);
        }
        .btn-google:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 0 1.5px rgba(31,43,22,0.14), 0 10px 28px rgba(80,160,20,0.14);
        }

        /* Shimmer on google btn */
        .btn-google::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          transform: skewX(-20deg);
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%   { left: -100%; }
          60%  { left: 140%; }
          100% { left: 140%; }
        }

        .btn-ghost {
          background: transparent;
          color: var(--ink-soft);
          box-shadow: 0 0 0 1.5px rgba(31,43,22,0.10);
          font-size: 0.8rem;
          cursor: default;
          opacity: 0.7;
        }

        .g-icon { width: 18px; height: 18px; flex-shrink: 0; }

        /* Terms */
        .terms {
          font-size: 0.67rem;
          color: var(--ink-soft);
          text-align: center;
          line-height: 1.7;
        }
        .terms a { color: var(--ink-mid); text-decoration: underline; text-underline-offset: 2px; }

        /* Status pills row */
        .pills {
          display: flex; flex-wrap: wrap; gap: 0.45rem;
          margin-bottom: 2rem;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.6s 0.15s var(--ease), transform 0.6s 0.15s var(--ease);
        }
        .pills.in { opacity: 1; transform: translateY(0); }
        .pill {
          display: flex; align-items: center; gap: 0.35rem;
          background: rgba(255,255,255,0.65);
          border: 1px solid rgba(31,43,22,0.09);
          border-radius: 100px;
          padding: 0.3rem 0.75rem;
          font-size: 0.72rem; font-weight: 500; color: var(--ink-mid);
        }
        .pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 5px var(--accent);
        }
      `}</style>

      <div className="page">
        {/* Matrix background rain */}
        <MatrixRain />

        {/* ── Left: Auth ── */}
        <div className="panel-left">
          <div className={`brand-row${mounted ? " in" : ""}`}>
            <div className="logo-wrap">
              <img src="/logo.svg" alt="Kairo logo" />
            </div>
            <span className="brand-name">{brand}</span>
          </div>

          <div className={`tagline-block${mounted ? " in" : ""}`}>
            <p className="tagline">{tagline}</p>
          </div>

          <div className={`pills${mounted ? " in" : ""}`}>
            {["AI risk detection", "Gamified habits", "Trusted guidance"].map((t) => (
              <span className="pill" key={t}>
                <span className="pill-dot" />
                {t}
              </span>
            ))}
          </div>

          <div className={`auth-card${mounted ? " in" : ""}`}>
            <div className="card-shell">
              <div className="card-core">
                <p className="card-eyebrow">Welcome back</p>
                <h1 className="card-heading">Sign in to Kairo</h1>

                <div className="features">
                  {[
                    {
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5425" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
                      text: "Personalised disease risk score"
                    },
                    {
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5425" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
                      text: "Earn points for daily habits"
                    },
                    {
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5425" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
                      text: "AI companion, always available"
                    },
                  ].map((f, i) => (
                    <div className="feat-row" key={i}>
                      <div className="feat-icon">{f.icon}</div>
                      <span className="feat-text">{f.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  id="google-login-btn"
                  className="btn btn-google"
                  type="button"
                  onClick={() => { window.location.href = loginUrl; }}
                >
                  <svg className="g-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="divider">
                  <div className="div-line" />
                  <span className="div-label">or</span>
                  <div className="div-line" />
                </div>

                <button className="btn btn-ghost" type="button" disabled>
                  More options coming soon
                </button>

                <p className="terms">
                  By continuing you agree to our{" "}
                  <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Mascot (desktop only) ── */}
        <div className="panel-right">
          <span className="rp-badge">AI Active</span>
          <img
            src="/relaxed.svg"
            alt="Kairo mascot"
            className="mascot-float"
          />
        </div>
      </div>
    </>
  );
}