"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { House, ChatCircleDots, Bell, User, PaperPlaneRight, Trophy, Crown, CheckCircle, ArrowsClockwise, SkipForward, Star } from "@phosphor-icons/react";
import Image from "next/image";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Message = { id: string; role: "assistant" | "user"; text: string };

const mkId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const extractCard = (input: string, tag: "DISEASE_CARD" | "CLINIC_CARD") => {
  const startIdx = input.indexOf(`[${tag}:`);
  if (startIdx === -1) return { json: null, text: input };
  const endIdx = input.indexOf("]", startIdx);
  if (endIdx === -1) return { json: null, text: input };

  let json: any = null;
  try {
    json = JSON.parse(input.slice(startIdx + tag.length + 2, endIdx).trim());
  } catch (e) { }

  const text = input.slice(0, startIdx) + input.slice(endIdx + 1);
  return { json, text };
};

const formatChat = (text: string) => {
  let cleanText = text;
  let diseaseCard: any = null;
  let clinicCard: any = null;

  ({ json: diseaseCard, text: cleanText } = extractCard(cleanText, "DISEASE_CARD"));
  ({ json: clinicCard, text: cleanText } = extractCard(cleanText, "CLINIC_CARD"));
  cleanText = cleanText.replace(/\[(DISEASE_CARD|CLINIC_CARD):.*?\]/g, "");

  const parts = cleanText.split(/(\*\*.*?\*\*)/g);
  const textNodes = parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });

  return (
    <>
      {textNodes}
      {diseaseCard && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(255,255,255,0.9)", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(31,43,22,0.05)", border: "1px solid rgba(156,239,70,0.3)" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#1f2b16", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#c8503c" }}>⚠️</span> Risk Alert: {diseaseCard.disease}
          </h4>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", background: "#f3f7e5", padding: "0.2rem 0.5rem", borderRadius: "100px", fontWeight: 600, color: "#607a3d" }}>Score: {diseaseCard.score}</span>
          </div>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "#607a3d" }}><strong>Cause:</strong> {diseaseCard.cause}</p>
          <p style={{ margin: "0", fontSize: "0.8rem", color: "#3d5425" }}><strong>Action:</strong> {diseaseCard.rectify}</p>
        </div>
      )}
      {clinicCard && Array.isArray(clinicCard.clinics) && clinicCard.clinics.length > 0 && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(255,255,255,0.9)", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(31,43,22,0.05)", border: "1px solid rgba(96,122,61,0.2)" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#1f2b16", fontSize: "0.95rem" }}>Nearby clinics</h4>
          {clinicCard.reason && (
            <p style={{ margin: "0 0 0.6rem 0", fontSize: "0.8rem", color: "#607a3d" }}><strong>Reason:</strong> {clinicCard.reason}</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {clinicCard.clinics.map((c: any, idx: number) => (
              <div key={`${c.name}-${idx}`} style={{ padding: "0.6rem 0.7rem", borderRadius: "0.8rem", background: "#f7faed", border: "1px solid rgba(96,122,61,0.15)" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1f2b16" }}>{idx + 1}. {c.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#607a3d", marginTop: "0.25rem" }}>
                  Rating: {c.rating ?? "N/A"} | Distance: {c.distance_km ?? "N/A"} km
                </div>
                {c.specialties && c.specialties.length > 0 && (
                  <div style={{ fontSize: "0.72rem", color: "#3d5425", marginTop: "0.25rem" }}>
                    Specialties: {c.specialties.slice(0, 3).join(", ")}
                  </div>
                )}
                {c.phone && (
                  <div style={{ fontSize: "0.72rem", color: "#3d5425", marginTop: "0.25rem" }}>
                    Phone: {c.phone}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default function ChatClient() {
  const router = useRouter();
  const [auth, setAuth] = useState<"loading" | "ok">("loading");
  const [user, setUser] = useState<{ name?: string; picture?: string; email?: string }>({});
  const [userDbId, setUserDbId] = useState("");
  const [sessionId, setSessionId] = useState("");
  type Profile = {
    height_cm?: number | null;
    weight_kg?: number | null;
    sleep_hours_per_night?: number | null;
    dietary_preference?: string | null;
    [key: string]: number | string | null | undefined;
  };
  type ProfileField = keyof Profile & string;

  const [profile, setProfile] = useState<Profile>({});
  const [sessions, setSessions] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"Home" | "Chat" | "Leaderboard" | "Activity" | "Account">("Chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  type Task = {
    id: string; title: string; description: string; category: string;
    difficulty: string; points_reward: number; duration_minutes: number;
    icon: string; is_chosen: boolean; is_completed: boolean; is_skipped: boolean;
    verification_status: string; distance_meters: number | null; needs_gps: boolean;
  };
  type LBEntry = { id: string; display_name: string; avatar_url: string | null; total_points: number; current_streak: number; };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);
  const locationRef = useRef<{lat: number; lng: number; accuracy?: number} | null>(null);
  const locationDeniedRef = useRef(false);

  const firstName = user.name?.split(" ")[0] ?? "there";

  // ── JWT gate ──
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
    const incoming = hash.get("token") || new URLSearchParams(window.location.search).get("token") || "";
    if (incoming) { localStorage.setItem("authToken", incoming); window.history.replaceState({}, "", "/home"); }
    const token = incoming || localStorage.getItem("authToken") || "";
    if (!token) { router.replace("/"); return; }
    fetch(`${apiBase}/auth/verify`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } })
      .then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(d => {
        if (!d.is_profile_complete) { router.replace("/onboard"); return; }
        setUser({ name: d.name, picture: d.picture, email: d.email });
        setUserDbId(d.db_id);
        setAuth("ok");
      })
      .catch(() => { localStorage.removeItem("authToken"); router.replace("/"); });
  }, [router]);

  useEffect(() => {
    if (activeTab === "Account" && userDbId) {
      const token = localStorage.getItem("authToken");
      fetch(`${apiBase}/profile/${userDbId}`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } })
        .then(r => r.json())
        .then(data => setProfile(data))
        .catch(() => { });
    }
    if (activeTab === "Activity" && userDbId) {
      const token = localStorage.getItem("authToken");
      fetch(`${apiBase}/chat/sessions/${userDbId}`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } })
        .then(r => r.json())
        .then(d => setSessions(d.sessions || []))
        .catch(() => { });
    }
    if (activeTab === "Leaderboard" && userDbId) {
      const token = localStorage.getItem("authToken");
      fetch(`${apiBase}/tasks/leaderboard`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } })
        .then(r => r.json()).then(d => setLeaderboard(d.leaderboard || [])).catch(() => {});
      setTasksLoading(true);
      fetch(`${apiBase}/tasks/${userDbId}`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } })
        .then(r => r.json()).then(d => setTasks(d.tasks || [])).catch(() => {}).finally(() => setTasksLoading(false));
    }
  }, [activeTab, userDbId]);

  const updateProfile = (field: ProfileField, val: Profile[ProfileField]) => {
    setProfile(prev => ({ ...prev, [field]: val }));
    const token = localStorage.getItem("authToken");
    fetch(`${apiBase}/profile/${userDbId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ [field]: val })
    });
  };

  const [gpsToast, setGpsToast] = useState<string | null>(null);
  const [taskToast, setTaskToast] = useState<string | null>(null);

  /** Request GPS. Returns null silently if denied or context is insecure. */
  const getLocation = (): Promise<{lat: number; lng: number; accuracy?: number} | null> => {
    // Geolocation requires HTTPS (or localhost). On plain HTTP LAN addresses it will fail.
    if (!navigator.geolocation) {
      setGpsToast("GPS unavailable in this browser.");
      setTimeout(() => setGpsToast(null), 3500);
      return Promise.resolve(null);
    }
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      setGpsToast("Location needs HTTPS or localhost. Use http://localhost:3000 or https.");
      setTimeout(() => setGpsToast(null), 4500);
      locationDeniedRef.current = true;
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        err => {
          const msg = err.code === 1
            ? "Location access denied. Task marked without GPS."
            : "GPS unavailable — task will complete without verification.";
          if (err.code === 1) locationDeniedRef.current = true;
          setGpsToast(msg);
          setTimeout(() => setGpsToast(null), 4000);
          resolve(null);
        },
        { timeout: 8000, maximumAge: 0, enableHighAccuracy: true },
      );
    });
  };

  const toggleTask = async (taskId: string) => {
    const token = localStorage.getItem("authToken");
    const task  = tasks.find(t => t.id === taskId);
    const needsGps = task?.needs_gps ?? false;

    // Capture GPS for exercise / mindfulness tasks (non-blocking — null is fine)
    let location: {lat: number; lng: number} | null = null;
    if (needsGps) location = await getLocation();

    const res = await fetch(`${apiBase}/tasks/${taskId}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ db_id: userDbId, lat: location?.lat ?? null, lng: location?.lng ?? null }),
    });
    if (!res.ok) {
      let message = "Task not completed yet.";
      try {
        const err = await res.json();
        if (err?.detail) message = err.detail;
      } catch { }
      setTaskToast(message);
      setTimeout(() => setTaskToast(null), 4000);
      return;
    }
    const data = await res.json();
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      is_chosen: data.is_chosen,
      is_completed: data.is_completed,
      verification_status: data.verification_status,
      distance_meters: data.distance_meters,
    } : t));
  };

  const skipTask = async (taskId: string) => {
    const token = localStorage.getItem("authToken");
    await fetch(`${apiBase}/tasks/${taskId}/skip`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_skipped: true } : t));
  };

  const refreshTasks = async () => {
    const token = localStorage.getItem("authToken");
    setTasksLoading(true);
    // Delete non-active tasks and generate new ones
    await fetch(`${apiBase}/tasks/${userDbId}/refresh`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
    });
    // Re-fetch ALL today's tasks — includes preserved active ones + new ones
    const res2 = await fetch(`${apiBase}/tasks/${userDbId}`, {
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
    });
    if (res2.ok) { const d = await res2.json(); setTasks(d.tasks || []); }
    setTasksLoading(false);
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, typing, activeTab]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const send = useCallback(async (content?: string) => {
    const text = (content ?? input).trim();
    if (!text || typing || !userDbId) return;

    setMessages(p => [...p, { id: mkId(), role: "user", text }]);
    setInput("");
    setActiveTab("Chat");
    setTyping(true);

    const token = localStorage.getItem("authToken");
    let chatLocation = locationRef.current;
    if (!chatLocation && !locationDeniedRef.current) {
      chatLocation = await getLocation();
      if (chatLocation) locationRef.current = chatLocation;
    }

    try {
      const res = await fetch(`${apiBase}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({
          db_id: userDbId,
          message: text,
          session_id: sessionId || null,
          lat: chatLocation?.lat ?? null,
          lng: chatLocation?.lng ?? null,
          accuracy_m: chatLocation?.accuracy ?? null,
        })
      });

      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let assistantMsgId = mkId();
      setMessages(p => [...p, { id: assistantMsgId, role: "assistant", text: "" }]);
      setTyping(false); // hide dots

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.session_id && !sessionId) setSessionId(data.session_id);
              if (data.content) {
                setMessages(p => p.map(m => m.id === assistantMsgId ? { ...m, text: m.text + data.content } : m));
              }
            } catch (e) { }
          }
        }
      }
    } catch (e) {
      setMessages(p => [...p, { id: mkId(), role: "assistant", text: "Oops! Connection issue." }]);
      setTyping(false);
    }
  }, [input, userDbId, sessionId, typing]);

  const handleIslandSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const uploadDummyData = async () => {
    if (!userDbId) return;
    const today = new Date();
    const data = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return {
        metric_date: d.toISOString().split("T")[0],
        steps_count: 3000 + Math.floor(Math.random() * 4000), // Sedentary/low
        distance_meters: 2000 + Math.floor(Math.random() * 3000),
        calories_burned: 1500 + Math.floor(Math.random() * 500),
        sleep_duration_minutes: 300 + Math.floor(Math.random() * 120), // Poor sleep
        resting_heart_rate: 70 + Math.floor(Math.random() * 15),
        avg_heart_rate: 80 + Math.floor(Math.random() * 20),
        blood_oxygen_percent: 96 + Math.floor(Math.random() * 3),
        stress_score: 60 + Math.floor(Math.random() * 30) // High stress
      };
    });
    const token = localStorage.getItem("authToken");
    await fetch(`${apiBase}/profile/${userDbId}/fitness`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(data)
    });
    alert("Dummy data uploaded! Now Kairo knows your recent history.");
  };

  if (auth === "loading") return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f7e5", fontFamily: "'Lexend',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "2.5px solid #e7f2c6", borderTopColor: "#9cef46", borderRadius: "50%", animation: "spin .75s linear infinite", margin: "0 auto 1rem" }} />
        <p style={{ color: "#607a3d", fontSize: ".85rem", fontWeight: 500 }}>Verifying session…</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f3f7e5", fontFamily: "'Lexend',sans-serif", color: "#1f2b16" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }

        :root{--ease:cubic-bezier(0.32,0.72,0,1)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}

        /* Main Content Area */
        .content-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 1.5rem 150px; /* Padding bottom to avoid island overlap */
          display: flex;
          flex-direction: column;
          scroll-behavior: smooth;
        }
        .content-area::-webkit-scrollbar { width: 0; } /* Hide scrollbar for clean app look */

        /* Welcome Section */
        .welcome {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 1.25rem; text-align: center;
          animation: fadeUp .55s var(--ease) both;
          margin-top: 10vh;
        }
        .welcome h2 { font-size: 1.25rem; font-weight: 700; letter-spacing: -.02em; }
        .welcome p { font-size: .86rem; color: #607a3d; max-width: 34ch; line-height: 1.65; }

        /* Chat Bubbles */
        .msg { display: flex; animation: slideIn .35s var(--ease) both; margin-bottom: 0.75rem; }
        .msg.user { justify-content: flex-end; }
        .msg.assistant { justify-content: flex-start; }

        .bubble {
          max-width: 82%; padding: .75rem 1.1rem;
          border-radius: 1.2rem; font-size: .88rem; line-height: 1.6;
          box-shadow: 0 2px 14px rgba(31,43,22,.05);
        }
        .bubble.user { background: #1f2b16; color: #eef6d0; border-bottom-right-radius: 0.35rem; }
        .bubble.assistant {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(31,43,22,.05);
          border-bottom-left-radius: 0.35rem;
          backdrop-filter: blur(8px);
        }

        .bot-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-right: 0.6rem; margin-top: auto; margin-bottom: 2px;
          position: relative; overflow: hidden;
          background: rgba(156,239,70,.15);
          box-shadow: 0 2px 8px rgba(31,43,22,.08);
          flex-shrink: 0;
        }

        .typing-dots { display: flex; gap: 4px; align-items: center; padding: .35rem 0; }
        .typing-dots span { width: 7px; height: 7px; border-radius: 50%; background: #7ecf30; animation: blink 1.2s ease-in-out infinite; }
        .typing-dots span:nth-child(2) { animation-delay: .22s; }
        .typing-dots span:nth-child(3) { animation-delay: .44s; }

        /* Floating Island Navigation */
        .island-wrapper {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: 100%;
          max-width: 460px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 2.2rem 2.2rem 0 0;
          padding: 0.7rem 0.5rem calc(0.7rem + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -8px 32px rgba(31, 43, 22, 0.05);
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
          animation: fadeUp 0.6s var(--ease) both;
        }

        .chat-input-wrapper {
          position: fixed;
          bottom: calc(75px + 1rem + env(safe-area-inset-bottom, 0px)); /* securely above docked island */
          left: 0;
          right: 0;
          margin: 0 auto;
          width: calc(100% - 2.5rem);
          max-width: 400px;
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(31, 43, 22, 0.08);
          border-radius: 1.5rem;
          padding: 0.4rem 0.4rem 0.4rem 1rem;
          box-shadow: 0 8px 32px rgba(31, 43, 22, 0.06);
          z-index: 90;
          animation: fadeUp 0.4s var(--ease) both;
        }

        .chat-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 0.95rem;
          color: #1f2b16;
          min-height: 24px;
          max-height: 120px;
          resize: none;
          padding: 0.4rem 0;
          line-height: 1.5;
        }
        .chat-textarea::placeholder { color: #9aa889; }

        .chat-send {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #1f2b16;
          color: #9cef46;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.2s;
        }
        .chat-send:active:not(:disabled) { transform: scale(0.95); }
        .chat-send:disabled { opacity: 0.5; cursor: not-allowed; }



        .island-nav {
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 0 0.5rem;
        }

        .island-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          background: transparent;
          border: none;
          color: #9aa889;
          font-family: inherit;
          cursor: pointer;
          transition: color 0.2s, transform 0.2s;
          width: 50px;
        }
        .island-btn.active { color: #1f2b16; }
        .island-btn:active { transform: scale(0.95); }
        .island-btn span { font-size: 0.65rem; font-weight: 600; }

        .island-fab {
          width: 78px;
          height: 48px;
          border-radius: 1.5rem;
          background: linear-gradient(135deg, #c4ff66, #9cef46);
          border: none;
          color: #1f2b16;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(156, 239, 70, 0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .island-fab:hover { box-shadow: 0 12px 28px rgba(156, 239, 70, 0.5); }
        .island-fab:active { transform: scale(0.95); }

        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes staggerUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

        /* ── Leaderboard ── */
        .lb-section { width: 100%; padding: 0 0 2rem; animation: fadeUp .45s var(--ease) both; }
        .lb-header { display:flex; flex-direction:column; align-items:center; margin-bottom:1.5rem; }
        .lb-eyebrow { font-size:0.65rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#9cef46; background:rgba(156,239,70,.12); border:1px solid rgba(156,239,70,.25); border-radius:100px; padding:.2rem .75rem; margin-bottom:.6rem; }
        .lb-title { font-size:1.55rem; font-weight:800; color:#1f2b16; letter-spacing:-.03em; margin:0; }
        .lb-sub { font-size:0.73rem; color:#9aa889; margin:.2rem 0 0; }

        /* Podium outer shell (double-bezel) */
        .podium-wrap { display:flex; align-items:flex-end; justify-content:center; gap:0.5rem; margin-bottom:2rem; }
        .podium-col { display:flex; flex-direction:column; align-items:center; }
        .podium-avatar-shell { padding:2px; border-radius:50%; margin-bottom:.45rem; background:rgba(255,255,255,.6); box-shadow:0 4px 16px rgba(31,43,22,.1); }
        .podium-avatar-shell.first { background:linear-gradient(135deg,#FFD966,#F4A500); padding:2.5px; box-shadow:0 6px 20px rgba(244,165,0,.35); }
        .podium-avatar { width:52px; height:52px; border-radius:50%; object-fit:cover; display:block; }
        .podium-avatar-placeholder { width:52px; height:52px; border-radius:50%; background:#e7f2c6; display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:700; color:#3d5425; }
        .podium-name { font-size:0.73rem; font-weight:700; color:#1f2b16; margin-bottom:.2rem; text-align:center; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .podium-pts { font-size:0.68rem; color:#607a3d; font-weight:600; margin-bottom:.4rem; }
        /* Outer block shell */
        .podium-shell { border-radius:1rem 1rem 0 0; padding:2px 2px 0; }
        .podium-shell.s1 { background:linear-gradient(160deg,#FFD966,#F4A500); }
        .podium-shell.s2 { background:linear-gradient(160deg,#C3D4F5,#8DAEE8); }
        .podium-shell.s3 { background:linear-gradient(160deg,#F5C5B0,#E8926E); }
        .podium-block { border-radius:calc(1rem - 2px) calc(1rem - 2px) 0 0; display:flex; align-items:center; justify-content:center; width:88px; font-size:1.6rem; font-weight:900; color:rgba(255,255,255,.8); }
        .podium-block.h1 { height:116px; background:linear-gradient(160deg,#FFE180,#F4A500); }
        .podium-block.h2 { height:86px; background:linear-gradient(160deg,#D4E2FA,#8DAEE8); }
        .podium-block.h3 { height:66px; background:linear-gradient(160deg,#FAD0BB,#E8926E); }

        /* ── Tasks ── */
        .tasks-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding:0 .25rem; }
        .tasks-header h3 { font-size:.95rem; font-weight:800; color:#1f2b16; letter-spacing:-.02em; margin:0; }
        .refresh-btn { display:flex; align-items:center; gap:5px; background:rgba(156,239,70,.12); border:1px solid rgba(156,239,70,.35); color:#3d5425; font-size:0.73rem; font-weight:700; padding:.3rem .7rem; border-radius:100px; cursor:pointer; transition:all .25s cubic-bezier(.32,.72,0,1); font-family:inherit; }
        .refresh-btn:hover { background:rgba(156,239,70,.25); transform:scale(1.03); }
        .refresh-btn:active { transform:scale(.97); }
        .refresh-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }

        /* Skeleton shimmer */
        .skeleton { border-radius:1.25rem; background:linear-gradient(90deg,#e7f2c6 25%,#f3f7e5 50%,#e7f2c6 75%); background-size:400px 100%; animation:shimmer 1.4s infinite; margin-bottom:.85rem; }

        /* Task card — double-bezel */
        .task-shell { background:rgba(255,255,255,.5); border:1px solid rgba(31,43,22,.06); border-radius:1.4rem; padding:2px; margin-bottom:.85rem; box-shadow:0 4px 20px rgba(31,43,22,.05); transition:transform .3s cubic-bezier(.32,.72,0,1),box-shadow .3s cubic-bezier(.32,.72,0,1); animation:staggerUp .4s cubic-bezier(.32,.72,0,1) both; }
        .task-shell:hover { transform:translateY(-1px); box-shadow:0 8px 28px rgba(31,43,22,.09); }
        .task-shell.completed { border-color:rgba(156,239,70,.4); }
        .task-shell.active-task { border-color:rgba(255,217,102,.6); }
        .task-card { background:#fff; border-radius:calc(1.4rem - 2px); padding:1rem 1.1rem; }
        .task-card:active { transform:scale(.99); }
        .task-top { display:flex; align-items:flex-start; gap:.75rem; margin-bottom:.8rem; }
        .task-icon { width:40px; height:40px; border-radius:.75rem; background:#f3f7e5; border:1px solid rgba(31,43,22,.05); display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }
        .task-icon.done-icon { background:rgba(156,239,70,.15); border-color:rgba(156,239,70,.3); }
        .task-info { flex:1; }
        .task-title { font-size:.88rem; font-weight:700; color:#1f2b16; margin-bottom:.18rem; }
        .task-title.done-text { opacity:.55; text-decoration:line-through; }
        .task-desc { font-size:.75rem; color:#607a3d; line-height:1.55; }
        .task-meta { display:flex; gap:.35rem; margin-bottom:.8rem; flex-wrap:wrap; }
        .task-badge { font-size:.65rem; font-weight:600; padding:.18rem .5rem; border-radius:100px; background:#f3f7e5; color:#3d5425; }
        .task-badge.pts { background:rgba(156,239,70,.18); color:#3d6e10; }
        .task-badge.done-badge { background:rgba(156,239,70,.25); color:#2a5200; }
        .task-actions { display:flex; gap:.55rem; }
        .btn-do { flex:1; background:#1f2b16; color:#9cef46; border:none; border-radius:.75rem; padding:.58rem 0; font-size:.8rem; font-weight:700; cursor:pointer; font-family:inherit; transition:all .25s cubic-bezier(.32,.72,0,1); display:flex; align-items:center; justify-content:center; gap:.35rem; }
        .btn-do.chosen { background:#f3f7e5; color:#1f2b16; border:1.5px solid rgba(156,239,70,.6); }
        .btn-do.done { background:rgba(156,239,70,.2); color:#2a5200; border:1.5px solid rgba(156,239,70,.4); }
        .btn-do:hover { opacity:.88; transform:scale(1.02); }
        .btn-do:active { transform:scale(.97); }
        .btn-skip { flex:1; background:transparent; color:#9aa889; border:1px solid rgba(31,43,22,.08); border-radius:.75rem; padding:.58rem 0; font-size:.8rem; font-weight:600; cursor:pointer; font-family:inherit; transition:all .25s cubic-bezier(.32,.72,0,1); display:flex; align-items:center; justify-content:center; gap:.35rem; }
        .btn-skip:hover { background:#f3f7e5; color:#607a3d; }
      `}</style>

      {/* Main Content Area */}
      <div className="content-area" ref={scrollRef}>

        {activeTab === "Home" && (
          <div className="welcome">
            <div style={{ position: "relative", width: 80, height: 80, marginBottom: "0.5rem" }}>
              <Image src="/smile.svg" alt="Kairo" fill style={{ objectFit: "cover" }} />
            </div>
            <h2>Welcome back, {firstName}</h2>
            <p>Your health metrics look great today. Ready to tackle your daily goals?</p>
            <button onClick={uploadDummyData} style={{ marginTop: "1rem", background: "#9cef46", color: "#1f2b16", border: "none", padding: "0.6rem 1.5rem", borderRadius: "100px", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(156,239,70,0.3)", transition: "transform 0.2s" }} onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"} onMouseUp={e => e.currentTarget.style.transform = "scale(1)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              Upload CSV
            </button>
          </div>
        )}

        {activeTab === "Leaderboard" && (() => {
          const top3 = leaderboard.slice(0, 3);
          // Display order: 2nd (left), 1st (center/tall), 3rd (right)
          const order  = [top3[1], top3[0], top3[2]];
          const shells  = ["s2", "s1", "s3"];
          const blocks  = ["h2", "h1", "h3"];
          const ranks   = [2, 1, 3];
          const isFirst = [false, true, false];
          // Sort: incomplete first, completed bottom
          const visibleTasks = tasks
            .filter(t => !t.is_skipped)
            .sort((a, b) => (a.is_completed === b.is_completed) ? 0 : a.is_completed ? 1 : -1);
          return (
            <div className="lb-section">
              {/* Header */}
              <div className="lb-header">
                <span className="lb-eyebrow">Live Rankings</span>
                <h2 className="lb-title">Leaderboard</h2>
                <p className="lb-sub">Points update when tasks are completed</p>
              </div>

              {/* Podium */}
              {top3.length > 0 ? (
                <div className="podium-wrap">
                  {order.map((entry, i) => (
                    <div key={entry ? entry.id : i} className="podium-col">
                      {/* Avatar with shell ring */}
                      <div className={`podium-avatar-shell${isFirst[i] ? " first" : ""}`}>
                        {entry?.avatar_url
                          ? <img src={entry.avatar_url} alt={entry.display_name} className="podium-avatar" />
                          : <div className="podium-avatar-placeholder">{entry ? entry.display_name[0].toUpperCase() : "?"}</div>}
                      </div>
                      <div className="podium-name">{entry ? entry.display_name.split(" ")[0] : "—"}</div>
                      <div className="podium-pts">{entry ? entry.total_points.toLocaleString() : "0"} pts</div>
                      {/* Double-bezel block */}
                      <div className={`podium-shell ${shells[i]}`}>
                        <div className={`podium-block ${blocks[i]}`}>
                          {isFirst[i]
                            ? <Crown size={28} weight="fill" color="rgba(255,255,255,.9)" />
                            : <span style={{fontSize:"1.4rem",fontWeight:900,color:"rgba(255,255,255,.8)"}}>{ranks[i]}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{textAlign:"center",opacity:.45,marginBottom:"1.5rem",fontSize:".82rem",padding:"1.5rem 0"}}>
                  <Trophy size={32} color="#9cef46" weight="light" style={{margin:"0 auto .5rem",display:"block"}} />
                  Complete tasks to appear on the board
                </div>
              )}

              {/* Tasks header */}
              <div className="tasks-header">
                <h3>Today's Tasks</h3>
                <button className="refresh-btn" onClick={refreshTasks} disabled={tasksLoading}>
                  <ArrowsClockwise size={13} weight="bold" style={tasksLoading ? {animation:"spin .8s linear infinite"} : {}} />
                  {tasksLoading ? "Generating" : "Refresh"}
                </button>
              </div>

              {/* Skeleton shimmer while loading */}
              {tasksLoading && visibleTasks.length === 0 ? (
                <>{[0,1,2,3].map(i => <div key={i} className="skeleton" style={{height:"96px",animationDelay:`${i*0.12}s`}} />)}</>
              ) : visibleTasks.length === 0 ? (
                <div style={{textAlign:"center",opacity:.45,fontSize:".82rem",padding:"2.5rem 0"}}>
                  <Star size={28} color="#9aa889" weight="light" style={{margin:"0 auto .5rem",display:"block"}} />
                  Hit Refresh to get your AI-generated tasks
                </div>
              ) : visibleTasks.map((task, idx) => (
                <div
                  key={task.id}
                  className={`task-shell${task.is_completed ? " completed" : task.is_chosen ? " active-task" : ""}`}
                  style={{animationDelay:`${idx * 0.07}s`}}
                >
                  <div className="task-card">
                    <div className="task-top">
                      <div className={`task-icon${task.is_completed ? " done-icon" : ""}`}>
                        {task.is_completed
                          ? <CheckCircle size={22} color="#5aad1e" weight="fill" />
                          : <span style={{fontSize:"1.15rem"}}>{task.icon}</span>}
                      </div>
                      <div className="task-info">
                        <div className={`task-title${task.is_completed ? " done-text" : ""}`}>{task.title}</div>
                        <div className="task-desc">{task.description}</div>
                      </div>
                    </div>
                    <div className="task-meta">
                      <span className="task-badge">{task.category.replace(/_/g, " ")}</span>
                      <span className="task-badge">{task.difficulty}</span>
                      {task.duration_minutes > 0 && <span className="task-badge">{task.duration_minutes} min</span>}
                      <span className={`task-badge${task.is_completed ? " done-badge" : " pts"}`}>+{task.points_reward} pts</span>
                      {/* GPS verification badges */}
                      {task.needs_gps && task.is_chosen && !task.is_completed && task.verification_status === "pending" && (
                        <span className="task-badge" style={{background:"rgba(255,217,102,.2)",color:"#856800",display:"flex",alignItems:"center",gap:3}}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                          GPS tracking
                        </span>
                      )}
                      {task.needs_gps && task.verification_status === "verified" && task.distance_meters != null && (
                        <span className="task-badge" style={{background:"rgba(156,239,70,.25)",color:"#2a5200",display:"flex",alignItems:"center",gap:3}}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          {task.distance_meters >= 1000
                            ? `${(task.distance_meters / 1000).toFixed(2)} km`
                            : `${Math.round(task.distance_meters)} m`} verified
                        </span>
                      )}
                      {task.needs_gps && task.is_completed && task.verification_status === "failed" && (
                        <span className="task-badge" style={{background:"rgba(220,60,60,.1)",color:"#c0392b",display:"flex",alignItems:"center",gap:3}}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          {task.distance_meters != null ? `${Math.round(task.distance_meters)}m — too short` : "GPS unavailable"}
                        </span>
                      )}
                    </div>
                    <div className="task-actions">
                      <button
                        className={`btn-do${task.is_completed ? " done" : task.is_chosen ? " chosen" : ""}`}
                        onClick={() => toggleTask(task.id)}
                      >
                        {task.is_completed
                          ? <><CheckCircle size={14} weight="fill" /> Done</>  
                          : task.is_chosen
                            ? "Mark as Done"
                            : "I'll do it"}
                      </button>
                      {!task.is_chosen && (
                        <button className="btn-skip" onClick={() => skipTask(task.id)}>
                          <SkipForward size={13} weight="bold" /> Skip
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {activeTab === "Chat" && (
          <>
            {messages.length === 0 && !typing ? (
              <div className="welcome">
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(156,239,70,.15)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", border: "2px solid rgba(156,239,70,.4)" }}>
                  <Image src="/smile.svg" alt="Kairo" fill style={{ objectFit: "cover" }} />
                </div>
                <h2>Hello, {firstName}</h2>
                <p>Ask me anything about your health — sleep, nutrition, movement or stress.</p>

                {/* Quick actions */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
                  {["How's my sleep?", "Suggest a quick workout", "Healthy dinner idea", "I feel stressed"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); send(q); }}
                      style={{
                        background: "#fff", border: "1px solid rgba(31,43,22,0.1)", color: "#3d5425",
                        padding: "0.5rem 1rem", borderRadius: "100px", fontSize: "0.85rem", cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(31,43,22,0.02)", transition: "all 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#9cef46"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(31,43,22,0.1)"}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(m => (
                  <div key={m.id} className={`msg ${m.role}`}>
                    {m.role === "assistant" && (
                      <div className="bot-avatar">
                        <Image src="/smile.svg" alt="Kairo" fill style={{ objectFit: "cover" }} />
                      </div>
                    )}
                    <div className={`bubble ${m.role}`}>
                      <div style={{ margin: 0, whiteSpace: "pre-wrap" }}>{formatChat(m.text)}</div>
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="msg assistant">
                    <div className="bot-avatar">
                      <Image src="/smile.svg" alt="Kairo" fill style={{ objectFit: "cover" }} />
                    </div>
                    <div className="bubble assistant">
                      <div className="typing-dots"><span /><span /><span /></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "Activity" && (
          <div className="welcome" style={{ marginTop: "2rem", paddingBottom: "2rem", alignItems: "flex-start", padding: "0 1rem" }}>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", textAlign: "left", width: "100%" }}>Conversations</h2>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", width: "100%", marginTop: "3rem", opacity: 0.6 }}>
                <Bell size={48} color="#9cef46" weight="fill" style={{ margin: "0 auto" }} />
                <p style={{ marginTop: "1rem" }}>No conversations yet.</p>
              </div>
            ) : (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {sessions.map(s => (
                  <div key={s.id} style={{ background: "#fff", borderRadius: "1rem", padding: "1rem", boxShadow: "0 2px 8px rgba(31,43,22,0.04)", textAlign: "left" }}>
                    <div style={{ fontSize: "0.75rem", color: "#607a3d", marginBottom: "0.25rem", fontWeight: 600 }}>{s.date}</div>
                    <div style={{ fontSize: "0.85rem", color: "#1f2b16" }}>{s.snippet}</div>
                    {s.card && (
                      <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f3f7e5", borderRadius: "0.75rem", borderLeft: "3px solid #c8503c" }}>
                        <h4 style={{ margin: "0 0 0.25rem 0", color: "#1f2b16", fontSize: "0.85rem" }}>{s.card.disease} (Risk: {s.card.score})</h4>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "#607a3d" }}>{s.card.cause}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Account" && (
          <div className="welcome" style={{ marginTop: "2rem", paddingBottom: "2rem" }}>

            {/* Main Profile Card (Stacked) */}
            <div style={{ position: "relative", width: "100%", maxWidth: "340px", margin: "0 auto" }}>
              {/* Bottom Layer (Accent) */}
              <div style={{ position: "absolute", top: "2rem", left: 0, right: 0, bottom: "-1.5rem", background: "#9cef46", borderRadius: "1.5rem", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#1f2b16", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  ⚡ Health Sync Active
                </span>
              </div>

              {/* Top Layer (Dark Card) */}
              <div style={{ position: "relative", zIndex: 2, background: "#1f2b16", color: "#eef6d0", borderRadius: "1.5rem", padding: "1.25rem", boxShadow: "0 12px 32px rgba(31,43,22,0.15)" }}>
                {/* Status Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", fontSize: "0.75rem", opacity: 0.8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: "#9cef46" }} /> Arogya Profile</span>
                  <span>✦ Optimal</span>
                </div>

                {/* Profile Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", textAlign: "left" }}>
                  {user.picture ? (
                    <img src={user.picture} alt="Profile" style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={32} /></div>
                  )}
                  <div>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0, color: "#fff" }}>{user.name}</h2>
                    <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: 0 }}>{user.email}</p>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => document.getElementById('health-metrics')?.scrollIntoView({ behavior: 'smooth' })} style={{ flex: 1, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", padding: "0.6rem", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
                    ⊕ Metrics
                  </button>
                  <button onClick={() => { localStorage.removeItem("authToken"); router.replace("/"); }} style={{ flex: 1, background: "transparent", color: "#eef6d0", border: "1px solid rgba(255,255,255,0.1)", padding: "0.6rem", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    ⎋ Log Out
                  </button>
                </div>
              </div>
            </div>

            {/* Achieved Badges */}
            <div style={{ width: "100%", maxWidth: "340px", textAlign: "left", marginTop: "3.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem", color: "#3d5425", paddingLeft: "0.5rem" }}>Achieved Badges</h3>
              <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
                <div style={{ minWidth: "80px", background: "#fff", padding: "1rem 0.5rem", borderRadius: "1rem", textAlign: "center", boxShadow: "0 2px 8px rgba(31,43,22,0.04)" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>🔥</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#1f2b16" }}>7 Day<br />Streak</div>
                </div>
                <div style={{ minWidth: "80px", background: "#fff", padding: "1rem 0.5rem", borderRadius: "1rem", textAlign: "center", boxShadow: "0 2px 8px rgba(31,43,22,0.04)" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>💧</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#1f2b16" }}>Hydration<br />Hero</div>
                </div>
                <div style={{ minWidth: "80px", background: "#fff", padding: "1rem 0.5rem", borderRadius: "1rem", textAlign: "center", boxShadow: "0 2px 8px rgba(31,43,22,0.04)", opacity: 0.5 }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>🏃</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#1f2b16" }}>10k<br />Club</div>
                </div>
              </div>
            </div>

            <div id="health-metrics" style={{ width: "100%", maxWidth: "340px", textAlign: "left", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.2rem", color: "#3d5425", paddingLeft: "0.5rem" }}>Health Profile</h3>

              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "0.75rem 1.25rem", borderRadius: "1rem", boxShadow: "0 2px 8px rgba(31,43,22,0.04)" }}>
                <span style={{ fontSize: "0.85rem", color: "#607a3d", fontWeight: 500 }}>Height (cm)</span>
                <input type="number" value={profile?.height_cm || ""} onChange={e => updateProfile("height_cm", parseFloat(e.target.value) || null)} style={{ width: "80px", textAlign: "right", border: "none", outline: "none", background: "transparent", fontSize: "0.95rem", fontWeight: 600, color: "#1f2b16" }} placeholder="---" />
              </div>

              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "0.75rem 1.25rem", borderRadius: "1rem", boxShadow: "0 2px 8px rgba(31,43,22,0.04)" }}>
                <span style={{ fontSize: "0.85rem", color: "#607a3d", fontWeight: 500 }}>Weight (kg)</span>
                <input type="number" value={profile?.weight_kg || ""} onChange={e => updateProfile("weight_kg", parseFloat(e.target.value) || null)} style={{ width: "80px", textAlign: "right", border: "none", outline: "none", background: "transparent", fontSize: "0.95rem", fontWeight: 600, color: "#1f2b16" }} placeholder="---" />
              </div>

              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "0.75rem 1.25rem", borderRadius: "1rem", boxShadow: "0 2px 8px rgba(31,43,22,0.04)" }}>
                <span style={{ fontSize: "0.85rem", color: "#607a3d", fontWeight: 500 }}>Sleep (hrs)</span>
                <input type="number" step="0.5" value={profile?.sleep_hours_per_night || ""} onChange={e => updateProfile("sleep_hours_per_night", parseFloat(e.target.value) || null)} style={{ width: "80px", textAlign: "right", border: "none", outline: "none", background: "transparent", fontSize: "0.95rem", fontWeight: 600, color: "#1f2b16" }} placeholder="---" />
              </div>

              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "0.75rem 1.25rem", borderRadius: "1rem", boxShadow: "0 2px 8px rgba(31,43,22,0.04)" }}>
                <span style={{ fontSize: "0.85rem", color: "#607a3d", fontWeight: 500 }}>Diet</span>
                <select value={profile?.dietary_preference || ""} onChange={e => updateProfile("dietary_preference", e.target.value || null)} style={{ border: "none", outline: "none", background: "transparent", fontSize: "0.95rem", fontWeight: 600, color: "#1f2b16", textAlign: "right" }}>
                  <option value="">Select...</option>
                  <option value="omnivore">Omnivore</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="keto">Keto</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* GPS Toast */}
      {gpsToast && (
        <div style={{
          position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom,0px))",
          left: "50%", transform: "translateX(-50%)",
          background: "#1f2b16", color: "#eef6d0",
          fontSize: "0.78rem", fontWeight: 600,
          padding: "0.6rem 1.1rem", borderRadius: "100px",
          boxShadow: "0 8px 24px rgba(31,43,22,.2)",
          zIndex: 200, whiteSpace: "nowrap",
          animation: "fadeUp .3s cubic-bezier(.32,.72,0,1) both",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
            <circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
          </svg>
          {gpsToast}
        </div>
      )}

      {/* Task Error Toast */}
      {taskToast && (
        <div style={{
          position: "fixed", bottom: "calc(130px + env(safe-area-inset-bottom,0px))",
          left: "50%", transform: "translateX(-50%)",
          background: "#c8503c", color: "#fff2ef",
          fontSize: "0.78rem", fontWeight: 600,
          padding: "0.6rem 0.95rem", borderRadius: "16px",
          boxShadow: "0 8px 24px rgba(200,80,60,.25)",
          zIndex: 200,
          maxWidth: "calc(100% - 2rem)",
          width: "fit-content",
          whiteSpace: "normal",
          textAlign: "center",
          lineHeight: 1.4,
          wordBreak: "break-word",
          animation: "fadeUp .3s cubic-bezier(.32,.72,0,1) both",
        }}>
          {taskToast}
        </div>
      )}

      {/* Floating Command Island */}
      <div className="island-wrapper">


        <div className="island-nav">
          <button className={`island-btn ${activeTab === "Home" ? "active" : ""}`} onClick={() => setActiveTab("Home")}>
            <House size={24} weight={activeTab === "Home" ? "fill" : "regular"} />
            <span>Home</span>
          </button>

          <button className={`island-btn ${activeTab === "Chat" ? "active" : ""}`} onClick={() => setActiveTab("Chat")}>
            <ChatCircleDots size={24} weight={activeTab === "Chat" ? "fill" : "regular"} />
            <span>Chat</span>
          </button>

          <button className="island-fab" onClick={() => setActiveTab("Leaderboard")}>
            <Trophy size={24} weight="bold" />
          </button>

          <button className={`island-btn ${activeTab === "Activity" ? "active" : ""}`} onClick={() => setActiveTab("Activity")}>
            <Bell size={24} weight={activeTab === "Activity" ? "fill" : "regular"} />
            <span>Activity</span>
          </button>

          <button className={`island-btn ${activeTab === "Account" ? "active" : ""}`} onClick={() => setActiveTab("Account")}>
            {user.picture ? (
              <img src={user.picture} alt="Account" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', opacity: activeTab === "Account" ? 1 : 0.6, border: activeTab === "Account" ? "2px solid #1f2b16" : "none" }} />
            ) : (
              <User size={24} weight={activeTab === "Account" ? "fill" : "regular"} />
            )}
            <span>Account</span>
          </button>
        </div>
      </div>

      {/* Floating Chat Input (Only shows on Chat tab) */}
      {activeTab === "Chat" && (
        <div className="chat-input-wrapper">
          <textarea
            className="chat-textarea"
            placeholder="Ask about your health goals…"
            value={input}
            rows={1}
            onChange={e => {
              setInput(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="chat-send" onClick={() => send()} disabled={!input.trim()}>
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </div>
      )}

    </div>
  );
}
