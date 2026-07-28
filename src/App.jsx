import React, { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "./firebase";

// ---------- Rams theme tokens ----------
const COLORS = {
  royal: "#003594",
  royalDeep: "#00256b",
  sol: "#FFA300",
  bone: "#F1EAD9",
  ink: "#14171F",
  horn: "#7A4B27",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');`;

// ---------- League data ----------
const LAST_SEASON = [
  "Jason Vuong",
  "Jason Tsugawa",
  "Kevin Bui",
  "Alex Wei",
  "Nick Kano",
  "Edward Chao",
  "Ming Guo",
  "Brandon Peralta",
  "Joshua Tran",
  "Justin Wang",
  "Zuleima Martinez",
  "Jonas Klipstein",
];
const RANK_BY_NAME = Object.fromEntries(
  LAST_SEASON.map((n, i) => [n.toLowerCase().trim(), i + 1])
);
const TOTAL_SLOTS = 12;
const WHITELISTED_CODES = ["DD2026"];

function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ---------- Horn stepper (signature element) ----------
function HornStepper({ step }) {
  const labels = ["Name", "Rank", "Play", "Submit"];
  const points = [
    [14, 46],
    [34, 22],
    [58, 14],
    [80, 26],
  ];
  const path = `M14,46 C20,30 30,18 42,16 C58,13 66,10 80,26`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
      <svg width="94" height="56" viewBox="0 0 94 56" style={{ overflow: "visible" }}>
        <path d={path} fill="none" stroke={COLORS.bone} strokeWidth="3" opacity="0.35" />
        <path
          d={path}
          fill="none"
          stroke={COLORS.sol}
          strokeWidth="3"
          strokeDasharray="120"
          strokeDashoffset={120 - (Math.min(step, 3) / 3) * 120}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === step ? 6 : 4.5}
            fill={i <= step ? COLORS.sol : COLORS.royalDeep}
            stroke={COLORS.bone}
            strokeWidth={i === step ? 2 : 1}
          />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
        {labels.map((l, i) => (
          <span
            key={l}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: i === step ? COLORS.sol : "rgba(241,234,217,0.4)",
              fontWeight: 600,
            }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Ram Rush game (3-lane runner) ----------
const LANE_COUNT = 3;

function isTouchDevice() {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

function RamRushGame({ onAttemptDone, attemptNumber, mode = "league" }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState("ready"); // ready | playing | over
  const [finalScore, setFinalScore] = useState(0);
  const touchStart = useRef(null);
  const isTouch = isTouchDevice();

  const W = 280,
    H = 380,
    PLAYER_Y = 300;
  const LANE_X = [W * 0.22, W * 0.5, W * 0.78];
  const JUMP_FRAMES = 28;
  const SLIDE_FRAMES = 28;

  const reset = () => {
    stateRef.current = {
      lane: 1,
      displayX: LANE_X[1],
      action: "none", // none | jump | slide
      actionTimer: 0,
      obstacles: [],
      frame: 0,
      speed: 3.4,
      spawnTimer: 40,
      score: 0,
      dead: false,
    };
    setScore(0);
  };

  const doJump = useCallback(() => {
    const s = stateRef.current;
    if (!s || phase !== "playing" || s.action !== "none") return;
    s.action = "jump";
    s.actionTimer = JUMP_FRAMES;
  }, [phase]);

  const doSlide = useCallback(() => {
    const s = stateRef.current;
    if (!s || phase !== "playing" || s.action !== "none") return;
    s.action = "slide";
    s.actionTimer = SLIDE_FRAMES;
  }, [phase]);

  const moveLane = useCallback(
    (dir) => {
      const s = stateRef.current;
      if (!s || phase !== "playing") return;
      const next = s.lane + dir;
      if (next < 0 || next >= LANE_COUNT) return;
      s.lane = next;
    },
    [phase]
  );

  useEffect(() => {
    const handler = (e) => {
      if (["Space", "ArrowUp"].includes(e.code)) {
        e.preventDefault();
        doJump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        doSlide();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        moveLane(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        moveLane(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doJump, doSlide, moveLane]);

  const start = () => {
    reset();
    setPhase("playing");
  };

  const onTouchStart = (e) => {
    const t = e.touches ? e.touches[0] : e;
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    touchStart.current = null;
    if (dt > 600) return;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 24) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (Math.abs(dy) > 24) {
      dy < 0 ? doJump() : doSlide();
    }
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const ctx = canvasRef.current.getContext("2d");

    const loop = () => {
      const s = stateRef.current;
      if (!s || s.dead) return;
      s.frame++;

      // action timer
      if (s.action !== "none") {
        s.actionTimer--;
        if (s.actionTimer <= 0) s.action = "none";
      }

      // smooth lane movement
      const targetX = LANE_X[s.lane];
      s.displayX += (targetX - s.displayX) * 0.28;

      // speed ramp
      s.speed = 3.4 + Math.min(s.frame / 240, 4.6);

      // spawn obstacles: block 1-2 lanes, always leave one open
      s.spawnTimer -= 1;
      if (s.spawnTimer <= 0) {
        const lanesToBlock = Math.random() < 0.35 ? 2 : 1;
        const laneOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
        const blocked = laneOrder.slice(0, lanesToBlock);
        blocked.forEach((lane) => {
          s.obstacles.push({
            lane,
            y: -30,
            type: Math.random() < 0.5 ? "ground" : "aerial",
            resolved: false,
          });
        });
        s.spawnTimer = 46 - Math.min(s.frame / 24, 22) + Math.random() * 18;
      }
      s.obstacles.forEach((o) => (o.y += s.speed));
      s.obstacles = s.obstacles.filter((o) => o.y < H + 40);

      // collision
      for (const o of s.obstacles) {
        if (o.resolved) continue;
        if (Math.abs(o.y - PLAYER_Y) < 18 && o.lane === s.lane) {
          const safe =
            (o.type === "ground" && s.action === "jump") ||
            (o.type === "aerial" && s.action === "slide");
          if (!safe) {
            s.dead = true;
          } else {
            o.resolved = true;
          }
        }
      }

      s.score = Math.floor(s.frame / 6);
      setScore(s.score);

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, COLORS.royal);
      grad.addColorStop(1, COLORS.royalDeep);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // lane dividers
      ctx.strokeStyle = "rgba(241,234,217,0.18)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      const divX1 = (LANE_X[0] + LANE_X[1]) / 2;
      const divX2 = (LANE_X[1] + LANE_X[2]) / 2;
      ctx.beginPath();
      ctx.moveTo(divX1, 0);
      ctx.lineTo(divX1, H);
      ctx.moveTo(divX2, 0);
      ctx.lineTo(divX2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // obstacles
      s.obstacles.forEach((o) => {
        const ox = LANE_X[o.lane];
        if (o.type === "ground") {
          // uniformed defender blocking the lane
          const oy = o.y - 4;
          // legs
          ctx.strokeStyle = COLORS.bone;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(ox - 6, oy + 8);
          ctx.lineTo(ox - 6, oy + 20);
          ctx.moveTo(ox + 6, oy + 8);
          ctx.lineTo(ox + 6, oy + 20);
          ctx.stroke();
          // arms
          ctx.strokeStyle = COLORS.royal;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(ox - 16, oy - 6);
          ctx.lineTo(ox - 21, oy + 6);
          ctx.moveTo(ox + 16, oy - 6);
          ctx.lineTo(ox + 21, oy + 6);
          ctx.stroke();
          // jersey torso
          ctx.fillStyle = COLORS.royal;
          ctx.fillRect(ox - 12, oy - 8, 24, 18);
          // number
          ctx.fillStyle = COLORS.bone;
          ctx.font = "bold 10px 'IBM Plex Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("5", ox, oy + 5);
          // shoulder pads
          ctx.fillStyle = COLORS.sol;
          ctx.fillRect(ox - 16, oy - 12, 32, 7);
          // helmet
          ctx.fillStyle = COLORS.sol;
          ctx.beginPath();
          ctx.ellipse(ox, oy - 18, 9, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          // facemask
          ctx.strokeStyle = COLORS.royalDeep;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox - 6, oy - 15);
          ctx.quadraticCurveTo(ox, oy - 9, ox + 6, oy - 15);
          ctx.stroke();
        } else {
          // spiked football hazard
          const cx = ox,
            cy = o.y - 16,
            rx = 15,
            ry = 10;
          // ball body
          ctx.fillStyle = "#6B3A1F";
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          // laces
          ctx.strokeStyle = "rgba(241,234,217,0.85)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx - 6, cy);
          ctx.lineTo(cx + 6, cy);
          for (let i = -4; i <= 4; i += 4) {
            ctx.moveTo(cx + i, cy - 2);
            ctx.lineTo(cx + i, cy + 2);
          }
          ctx.stroke();
          // spikes radiating outward
          const spikeCount = 9;
          ctx.fillStyle = "rgba(203,206,212,0.95)";
          for (let i = 0; i < spikeCount; i++) {
            const a = (i / spikeCount) * Math.PI * 2;
            const ex = cx + Math.cos(a) * rx;
            const ey = cy + Math.sin(a) * ry;
            const nx = Math.cos(a),
              ny = Math.sin(a);
            const px = -ny,
              py = nx;
            const baseW = 3;
            const len = 8;
            ctx.beginPath();
            ctx.moveTo(ex - px * baseW, ey - py * baseW);
            ctx.lineTo(ex + px * baseW, ey + py * baseW);
            ctx.lineTo(ex + nx * len, ey + ny * len);
            ctx.closePath();
            ctx.fill();
          }
        }
      });

      // ram player
      const rx = s.displayX;
      let ry = PLAYER_Y;
      let squash = 1;
      if (s.action === "jump") {
        const progress = 1 - s.actionTimer / JUMP_FRAMES;
        const arc = Math.sin(progress * Math.PI) * 30;
        ry = PLAYER_Y - arc;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(rx, PLAYER_Y + 14, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.action === "slide") squash = 0.5;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(1, squash);
      ctx.fillStyle = COLORS.bone;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(15, -8, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.horn;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(19, -14);
      ctx.quadraticCurveTo(28, -18, 25, -6);
      ctx.quadraticCurveTo(22, 2, 13, -4);
      ctx.stroke();
      ctx.restore();

      if (s.dead) {
        setFinalScore(s.score);
        setPhase("over");
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  useEffect(() => {
    if (phase === "over") {
      onAttemptDone(finalScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const ctrlBtn = (label, handler) => (
    <button
      onClick={handler}
      disabled={phase !== "playing"}
      style={{
        ...btnStyle(false),
        border: `1px solid rgba(241,234,217,0.4)`,
        padding: "10px 16px",
        fontSize: 13,
        opacity: phase === "playing" ? 1 : 0.4,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.sol, letterSpacing: 1 }}>
        {mode === "practice" ? "PRACTICE RUN" : `ATTEMPT ${attemptNumber} OF 3`} · SCORE{" "}
        {phase === "playing" ? score : phase === "over" ? finalScore : 0}
      </div>

      {/* Device-appropriate control hints (P1) */}
      <div style={{ display: "flex", gap: 14, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(241,234,217,0.6)" }}>
        {isTouch ? (
          <>
            <span>↑ swipe → jump</span>
            <span>↓ swipe → slide</span>
            <span>← → swipe → lane</span>
          </>
        ) : (
          <>
            <span>↑ / space → jump</span>
            <span>↓ → slide</span>
            <span>← → → lane</span>
          </>
        )}
      </div>

      {/* Obstacle type legend using shapes, not color alone */}
      <div style={{ display: "flex", gap: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(241,234,217,0.6)" }}>
        <span>🏈 spiked ball → slide</span>
        <span>🏃 defender → jump</span>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: `2px solid ${COLORS.sol}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          width: "100%",
          maxWidth: 280,
          touchAction: "none",
        }}
      >
        <canvas ref={canvasRef} width={W} height={H} style={{ display: "block", width: "100%", height: "auto" }} />
      </div>

      {phase === "ready" && (
        <button onClick={start} style={btnStyle(true)}>
          {mode === "practice" ? (attemptNumber === 1 ? "Start Run" : "Play Again") : attemptNumber === 1 ? "Start Run" : "Try Again"}
        </button>
      )}
      {phase === "playing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div>{ctrlBtn("▲ Jump", doJump)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {ctrlBtn("◀ Lane", () => moveLane(-1))}
            {ctrlBtn("▼ Slide", doSlide)}
            {ctrlBtn("Lane ▶", () => moveLane(1))}
          </div>
        </div>
      )}
      {phase === "over" && (
        <div style={{ fontFamily: "'Inter', sans-serif", color: COLORS.bone, fontSize: 13, textAlign: "center" }}>
          Ram down. Score locked: <b style={{ color: COLORS.sol }}>{finalScore}</b>
        </div>
      )}
    </div>
  );
}

function btnStyle(primary) {
  return {
    fontFamily: "'Anton', sans-serif",
    letterSpacing: 1,
    fontSize: 16,
    padding: "12px 28px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: primary ? COLORS.sol : "transparent",
    color: primary ? COLORS.ink : COLORS.bone,
    boxShadow: primary ? "0 4px 14px rgba(255,163,0,0.35)" : "none",
    outlineOffset: 2,
  };
}

// ---------- Preference ranking screen ----------
function RankScreen({ prefs, setPrefs, onContinue }) {
  const move = (idx, dir) => {
    const next = [...prefs];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPrefs(next);
  };

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(241,234,217,0.75)", fontSize: 14, marginBottom: 14 }}>
        Order all 12 slots by preference. Top card is your #1 choice. Use the arrows to reorder.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
        {prefs.map((slot, i) => (
          <div
            key={slot}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: COLORS.bone,
              borderRadius: 10,
              padding: "10px 14px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color: COLORS.royal,
                  opacity: 0.6,
                  width: 20,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: COLORS.ink }}>
                Pick {slot}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                style={arrowBtn(i === 0)}
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === prefs.length - 1}
                style={arrowBtn(i === prefs.length - 1)}
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onContinue} style={{ ...btnStyle(true), width: "100%", marginTop: 18 }}>
        Lock In Preferences
      </button>
    </div>
  );
}

function arrowBtn(disabled) {
  return {
    border: "none",
    background: disabled ? "rgba(0,53,148,0.08)" : "rgba(0,53,148,0.12)",
    color: disabled ? "rgba(20,23,31,0.25)" : COLORS.royal,
    borderRadius: 6,
    width: 26,
    height: 26,
    fontSize: 11,
    cursor: disabled ? "default" : "pointer",
  };
}

// ---------- Main App ----------
export default function App() {
  const [screen, setScreen] = useState("home"); // home | practice | welcome | rank | game | confirm | done | results
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState(Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1));
  const [attempt, setAttempt] = useState(1);
  const [scores, setScores] = useState([]);
  const [alreadySubmitted, setAlreadySubmitted] = useState(null);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [practiceAttempt, setPracticeAttempt] = useState(1);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const bestScore = scores.length ? Math.max(...scores) : 0;

  const handleNameContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your manager name.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const existing = await storage.get(`manager:${slugify(trimmed)}`);
      if (existing) {
        setAlreadySubmitted(JSON.parse(existing.value));
        setScreen("done");
      } else {
        setScreen("rank");
      }
    } catch {
      // key not found -> proceed fresh
      setScreen("rank");
    }
    setChecking(false);
  };

  const handleAttemptDone = (s) => {
    setScores((prev) => [...prev, s]);
    recordHighScore(name, s);
  };

  const recordHighScore = async (rawName, score) => {
    const trimmed = (rawName || "").trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    try {
      let existing = null;
      try {
        const r = await storage.get(`highscore:${slug}`);
        existing = r ? JSON.parse(r.value) : null;
      } catch {
        existing = null;
      }
      if (!existing || score > existing.score) {
        await storage.set(
          `highscore:${slug}`,
          JSON.stringify({ name: trimmed, score, achievedAt: new Date().toISOString() })
        );
      }
    } catch {
      // storage unavailable — silently skip, doesn't block gameplay
    }
  };

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const listed = await storage.list("highscore:");
      const keys = listed?.keys || [];
      const entries = [];
      for (const k of keys) {
        try {
          const r = await storage.get(k);
          if (r) entries.push(JSON.parse(r.value));
        } catch {}
      }
      entries.sort((a, b) => b.score - a.score);
      setLeaderboard(entries);
    } catch {
      setLeaderboard([]);
    }
    setLeaderboardLoading(false);
  };

  const downloadCSV = () => {
    const rows = leaderboard.map(
      (h) => `${(h.name || "").replace(/,/g, "")},${h.score},${h.achievedAt || ""}`
    );
    const csv = "Name,High Score,Date\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ram-rush-highscores.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCodeSubmit = () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) {
      setCodeError("Enter a league code.");
      return;
    }
    if (WHITELISTED_CODES.includes(trimmed)) {
      setShowCodeModal(false);
      setCodeInput("");
      setCodeError("");
      setScreen("welcome");
    } else {
      setCodeError("That code isn't recognized.");
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    const rank = RANK_BY_NAME[trimmed.toLowerCase()] ?? 99;
    const payload = {
      name: trimmed,
      preferences: prefs,
      bestScore,
      allScores: scores,
      lastSeasonRank: rank,
      submittedAt: new Date().toISOString(),
    };
    try {
      await storage.set(`manager:${slugify(trimmed)}`, JSON.stringify(payload));
      setScreen("done");
      setAlreadySubmitted(payload);
    } catch (e) {
      setError("Could not submit — try again.");
    }
  };

  const loadResults = async () => {
    setLoadingResults(true);
    try {
      const listed = await storage.list("manager:");
      const keys = listed?.keys || [];
      const managers = [];
      for (const k of keys) {
        try {
          const r = await storage.get(k);
          if (r) managers.push(JSON.parse(r.value));
        } catch {}
      }
      // sort: best score desc, tie -> better (lower) last season rank wins
      const sorted = [...managers].sort((a, b) => {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        return (a.lastSeasonRank ?? 99) - (b.lastSeasonRank ?? 99);
      });
      const usedSlots = new Set();
      const allocation = [];
      sorted.forEach((m) => {
        const pick = m.preferences.find((p) => !usedSlots.has(p));
        if (pick != null) {
          usedSlots.add(pick);
          allocation.push({ ...m, assignedSlot: pick });
        }
      });
      allocation.sort((a, b) => a.assignedSlot - b.assignedSlot);
      setResults({ count: managers.length, allocation, complete: managers.length >= TOTAL_SLOTS });
    } catch {
      setResults({ count: 0, allocation: [], complete: false });
    }
    setLoadingResults(false);
  };

  useEffect(() => {
    if (screen === "results") loadResults();
  }, [screen]);

  useEffect(() => {
    if (screen === "home") loadLeaderboard();
  }, [screen]);

  const step = screen === "welcome" ? 0 : screen === "rank" ? 1 : screen === "game" ? 2 : 3;
  const showChrome = !["home", "practice"].includes(screen);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: `radial-gradient(circle at 50% 0%, ${COLORS.royal}, ${COLORS.royalDeep} 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "28px 16px 40px",
        boxSizing: "border-box",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{FONT_IMPORT}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 30, color: COLORS.bone, letterSpacing: 1 }}>
          RAM RUSH
        </span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: COLORS.sol,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Draft Order
        </span>
      </div>

      {showChrome && screen !== "results" && (
        <button
          onClick={() => setScreen("results")}
          style={{
            background: "none",
            border: "none",
            color: "rgba(241,234,217,0.55)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: 1,
            cursor: "pointer",
            marginBottom: 14,
            textDecoration: "underline",
          }}
        >
          view board →
        </button>
      )}

      {showChrome && screen !== "results" && <HornStepper step={step} />}

      {screen === "home" && (
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <p style={{ color: "rgba(241,234,217,0.8)", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
            Play for fun, or enter your league code to run the gauntlet for real and lock in your draft slot.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (for the leaderboard)"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              boxSizing: "border-box",
              marginBottom: 16,
              background: "rgba(241,234,217,0.9)",
              color: COLORS.ink,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => {
                setPracticeAttempt(1);
                setScreen("practice");
              }}
              style={{ ...btnStyle(true), width: "100%" }}
            >
              Play
            </button>
            <button
              onClick={() => {
                setCodeError("");
                setCodeInput("");
                setShowCodeModal(true);
              }}
              style={{ ...btnStyle(false), width: "100%", border: `1px solid rgba(241,234,217,0.4)` }}
            >
              Enter League Code
            </button>
          </div>

          <div
            style={{
              background: "rgba(241,234,217,0.06)",
              border: "1px solid rgba(241,234,217,0.15)",
              borderRadius: 12,
              padding: "14px 16px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: 1.5,
                color: COLORS.sol,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              Top Scores
            </div>
            {leaderboardLoading && (
              <div style={{ color: "rgba(241,234,217,0.6)", fontSize: 12 }}>Loading…</div>
            )}
            {!leaderboardLoading && leaderboard.length === 0 && (
              <div style={{ color: "rgba(241,234,217,0.5)", fontSize: 12 }}>No runs recorded yet — be the first.</div>
            )}
            {!leaderboardLoading && leaderboard.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {leaderboard.slice(0, 3).map((h, i) => {
                  const medal = ["#FFD166", "#C9CDD3", "#C97B3F"][i];
                  return (
                    <div
                      key={h.name + i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        color: COLORS.bone,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontFamily: "'Anton', sans-serif",
                            fontSize: 13,
                            color: medal,
                            width: 16,
                          }}
                        >
                          {i + 1}
                        </span>
                        {h.name}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.sol }}>
                        {h.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {!leaderboardLoading && leaderboard.length > 0 && (
              <button
                onClick={downloadCSV}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(241,234,217,0.5)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  letterSpacing: 1,
                  cursor: "pointer",
                  textDecoration: "underline",
                  marginTop: 10,
                  padding: 0,
                }}
              >
                download full csv
              </button>
            )}
          </div>
        </div>
      )}

      {screen === "practice" && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <RamRushGame
            mode="practice"
            attemptNumber={practiceAttempt}
            onAttemptDone={(s) => {
              setPracticeAttempt((a) => a + 1);
              recordHighScore(name, s);
            }}
            key={practiceAttempt}
          />
          <button
            onClick={() => setScreen("home")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(241,234,217,0.55)",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: 1,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ← back to home
          </button>
        </div>
      )}

      {showCodeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,15,30,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
          onClick={() => setShowCodeModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COLORS.bone,
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 320,
              boxSizing: "border-box",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: COLORS.ink, marginBottom: 10 }}>
              Enter League Code
            </div>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
              placeholder="e.g. DD2026"
              autoFocus
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid rgba(0,53,148,0.25)`,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 15,
                letterSpacing: 1,
                textTransform: "uppercase",
                boxSizing: "border-box",
                marginBottom: 8,
                color: COLORS.ink,
              }}
            />
            {codeError && <div style={{ color: "#B00020", fontSize: 12, marginBottom: 8 }}>{codeError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setShowCodeModal(false)}
                style={{ ...btnStyle(false), flex: 1, color: COLORS.royal, border: `1px solid rgba(0,53,148,0.25)` }}
              >
                Cancel
              </button>
              <button onClick={handleCodeSubmit} style={{ ...btnStyle(true), flex: 1 }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "welcome" && (
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          <p style={{ color: "rgba(241,234,217,0.8)", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
            Enter your name, rank your 12 draft slots, then run the gauntlet. Top scores get first pick of their
            preferred slot — everyone else falls down their list.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Manager name"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              boxSizing: "border-box",
              marginBottom: 8,
              background: COLORS.bone,
              color: COLORS.ink,
            }}
          />
          {error && <div style={{ color: "#FFB4A2", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button onClick={handleNameContinue} disabled={checking} style={{ ...btnStyle(true), width: "100%" }}>
            {checking ? "Checking…" : "Continue"}
          </button>
        </div>
      )}

      {screen === "rank" && (
        <RankScreen prefs={prefs} setPrefs={setPrefs} onContinue={() => setScreen("game")} />
      )}

      {screen === "game" && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <RamRushGame attemptNumber={attempt} onAttemptDone={handleAttemptDone} key={attempt} />
          {scores.length > 0 && scores.length < 3 && (
            <button onClick={() => setAttempt((a) => a + 1)} style={btnStyle(false)}>
              Next attempt ({scores.length}/3 done)
            </button>
          )}
          {scores.length >= 3 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.bone, fontSize: 14, marginBottom: 10 }}>
                Best of 3: <b style={{ color: COLORS.sol, fontFamily: "'IBM Plex Mono', monospace" }}>{bestScore}</b>
              </div>
              <button onClick={() => setScreen("confirm")} style={btnStyle(true)}>
                Review &amp; Submit
              </button>
            </div>
          )}
        </div>
      )}

      {screen === "confirm" && (
        <div style={{ width: "100%", maxWidth: 380, background: COLORS.bone, borderRadius: 14, padding: 20, boxSizing: "border-box" }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 20, color: COLORS.ink, marginBottom: 10 }}>
            {name}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.royal, marginBottom: 14 }}>
            BEST SCORE: {bestScore}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.ink, opacity: 0.7, marginBottom: 6 }}>
            Preference order (top = most wanted):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {prefs.map((p, i) => (
              <span
                key={p}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  background: "rgba(0,53,148,0.08)",
                  color: COLORS.royal,
                  padding: "3px 8px",
                  borderRadius: 6,
                }}
              >
                {i + 1}. Pick {p}
              </span>
            ))}
          </div>
          {error && <div style={{ color: "#B00020", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button onClick={submit} style={{ ...btnStyle(true), width: "100%" }}>
            Submit Final Entry
          </button>
        </div>
      )}

      {screen === "done" && (
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, color: COLORS.sol, marginBottom: 8 }}>
            {alreadySubmitted ? "Already Locked In" : "Entry Submitted"}
          </div>
          <p style={{ color: "rgba(241,234,217,0.8)", fontSize: 14, marginBottom: 6 }}>
            {alreadySubmitted?.name || name} · best score {alreadySubmitted?.bestScore ?? bestScore}
          </p>
          <p style={{ color: "rgba(241,234,217,0.6)", fontSize: 13, marginBottom: 18 }}>
            Final slot is revealed once all 12 managers have submitted.
          </p>
          <button onClick={() => setScreen("results")} style={btnStyle(true)}>
            View Board
          </button>
        </div>
      )}

      {screen === "results" && (
        <div style={{ width: "100%", maxWidth: 460 }}>
          <button
            onClick={() => setScreen(alreadySubmitted ? "done" : "welcome")}
            style={{ background: "none", border: "none", color: "rgba(241,234,217,0.55)", fontSize: 12, cursor: "pointer", marginBottom: 14 }}
          >
            ← back
          </button>
          {loadingResults && <div style={{ color: COLORS.bone }}>Loading board…</div>}
          {!loadingResults && results && (
            <>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.sol, fontSize: 12, marginBottom: 12 }}>
                {results.count}/{TOTAL_SLOTS} MANAGERS SUBMITTED
              </div>
              {!results.complete && (
                <p style={{ color: "rgba(241,234,217,0.75)", fontSize: 13, marginBottom: 16 }}>
                  Draft order will be revealed once everyone has run the gauntlet. Check back soon.
                </p>
              )}
              {results.complete && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.allocation.map((m) => (
                    <div
                      key={m.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: COLORS.bone,
                        borderRadius: 10,
                        padding: "10px 14px",
                      }}
                    >
                      <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 16, color: COLORS.royal }}>
                        Pick {m.assignedSlot}
                      </span>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: COLORS.ink }}>
                        {m.name}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(20,23,31,0.5)" }}>
                        score {m.bestScore}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
