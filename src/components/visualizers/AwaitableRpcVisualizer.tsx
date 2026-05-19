"use client";

/**
 * Visual model:
 * - Left panel "Client": a code-like display shows the await call.
 *   The "⏳ awaiting..." line pulses while waiting; replaced with the
 *   result value + green ✓ when the response arrives.
 * - Center: bidirectional arrows.
 *   → Right: "Request" packet (amber) flies Client → Server.
 *   ← Left: "Response: N" packet (teal) flies Server → Client after delay.
 * - Right panel "Server": shows "Received" then "Processing…" then "Sent ✓".
 * - Animation loop:
 *     1. Client sends request packet (→)
 *     2. Server: "Processing…"
 *     3. After latency-based delay, response packet flies (←)
 *     4. Client updates: result = N, green ✓
 *     5. 1.5 s pause → repeat with a fresh random value.
 * - Latency slider (50–500 ms) stretches the round-trip time.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

type Phase = "idle" | "sending" | "processing" | "returning" | "done";

const CLIENT_COLOR  = "hsl(140 55% 55%)";
const SERVER_COLOR  = "hsl(270 60% 65%)";
const REQ_COLOR     = "hsl(45 80% 60%)";
const RES_COLOR     = "hsl(175 65% 55%)";

export function AwaitableRpcVisualizer({ showControls = true }: { showControls?: boolean }) {
  const [phase,   setPhase]   = useState<Phase>("idle");
  const [result,  setResult]  = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [latency, setLatency] = useState(200);
  const [playing, setPlaying] = useState(true);
  const [tick,    setTick]    = useState(0);

  const seqRef   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const loopRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAll = () => {
    seqRef.current.forEach(clearTimeout);
    seqRef.current = [];
    if (loopRef.current) clearTimeout(loopRef.current);
  };

  const runCycle = useCallback(() => {
    const value = Math.floor(Math.random() * 6) + 1;
    const rtt = 300 + (latency / 500) * 800; // 300–1100 ms visual duration

    setPhase("sending");
    setPending(null);
    setResult(null);

    const t1 = setTimeout(() => setPhase("processing"), rtt * 0.35);
    const t2 = setTimeout(() => { setPhase("returning"); setPending(value); }, rtt * 0.55);
    const t3 = setTimeout(() => { setPhase("done"); setResult(value); setPending(null); }, rtt);
    const t4 = setTimeout(() => {
      setPhase("idle");
      setTick((n) => n + 1);
    }, rtt + 1500);

    seqRef.current = [t1, t2, t3, t4];
  }, [latency]);

  useEffect(() => {
    if (!playing) { clearAll(); return; }
    runCycle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, tick]);

  const reset = () => { clearAll(); setPhase("idle"); setResult(null); setPending(null); setTick(0); setTimeout(() => setTick(1), 60); };

  // SVG layout
  const CLX = 80;  const SRX = 360;
  const MID = 220; const Y   = 110;

  const reqVisible = phase === "sending";
  const resVisible = phase === "returning";

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="p-4 pb-2">
        <svg viewBox="0 0 440 220" className="w-full">

          {/* ── Arrow track ── */}
          <line x1={CLX + 38} y1={Y} x2={SRX - 38} y2={Y}
            stroke="hsl(270 30% 55% / 0.2)" strokeWidth="1.5" strokeDasharray="5 4" />

          {/* ── Client node ── */}
          <rect x={CLX - 38} y={Y - 50} width={76} height={100} rx="8"
            fill={CLIENT_COLOR + "18"} stroke={CLIENT_COLOR} strokeWidth="1.8" />
          <text x={CLX} y={Y - 33} textAnchor="middle" fontSize="9" fill={CLIENT_COLOR} fontWeight="700">Client</text>

          {/* client code lines */}
          <text x={CLX} y={Y - 14} textAnchor="middle" fontSize="7" fill={CLIENT_COLOR + "bb"} fontFamily="monospace">
            await CmdRollDice()
          </text>

          {/* await status line */}
          <AnimatePresence mode="wait">
            {(phase === "sending" || phase === "processing" || phase === "returning") && (
              <motion.text key="waiting" x={CLX} y={Y + 4} textAnchor="middle" fontSize="7.5"
                fill="hsl(45 80% 60%)" fontFamily="monospace"
                initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3] }} exit={{ opacity: 0 }}
                transition={{ duration: 0.8, repeat: Infinity }}>
                ⏳ awaiting…
              </motion.text>
            )}
            {phase === "done" && result !== null && (
              <motion.text key="done" x={CLX} y={Y + 4} textAnchor="middle" fontSize="7.5"
                fill={CLIENT_COLOR} fontFamily="monospace"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                ✓ result = {result}
              </motion.text>
            )}
            {phase === "idle" && (
              <motion.text key="idle" x={CLX} y={Y + 4} textAnchor="middle" fontSize="7.5"
                fill={CLIENT_COLOR + "55"} fontFamily="monospace"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                —
              </motion.text>
            )}
          </AnimatePresence>

          <text x={CLX} y={Y + 20} textAnchor="middle" fontSize="7" fill={CLIENT_COLOR + "66"} fontFamily="monospace">
            Debug.Log(result)
          </text>

          {/* ── Server node ── */}
          <rect x={SRX - 38} y={Y - 50} width={76} height={100} rx="8"
            fill={SERVER_COLOR + "18"} stroke={SERVER_COLOR} strokeWidth="1.8" />
          <text x={SRX} y={Y - 33} textAnchor="middle" fontSize="9" fill={SERVER_COLOR} fontWeight="700">Server</text>

          <AnimatePresence mode="wait">
            {phase === "sending" && (
              <motion.text key="recv" x={SRX} y={Y} textAnchor="middle" fontSize="7.5"
                fill={SERVER_COLOR + "88"} fontFamily="monospace"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Received
              </motion.text>
            )}
            {phase === "processing" && (
              <motion.text key="proc" x={SRX} y={Y} textAnchor="middle" fontSize="7.5"
                fill={SERVER_COLOR} fontFamily="monospace"
                initial={{ opacity: 0 }} animate={{ opacity: [0.4, 1, 0.4] }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, repeat: Infinity }}>
                Processing…
              </motion.text>
            )}
            {(phase === "returning" || phase === "done") && pending !== null && (
              <motion.text key="sent" x={SRX} y={Y} textAnchor="middle" fontSize="7.5"
                fill={RES_COLOR} fontFamily="monospace"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sent ✓  ({pending})
              </motion.text>
            )}
          </AnimatePresence>

          {/* ── Request packet → ── */}
          <AnimatePresence>
            {reqVisible && (
              <motion.g key={`req-${tick}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.circle r="7" fill={REQ_COLOR}
                  initial={{ cx: CLX + 38, cy: Y - 14 }}
                  animate={{ cx: SRX - 38,  cy: Y - 14, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.4] }}
                  transition={{ duration: 0.55, ease: "easeInOut" }} />
                <text x={MID} y={Y - 26} textAnchor="middle" fontSize="8" fill={REQ_COLOR + "cc"}>Request →</text>
              </motion.g>
            )}
          </AnimatePresence>

          {/* ── Response packet ← ── */}
          <AnimatePresence>
            {resVisible && pending !== null && (
              <motion.g key={`res-${tick}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.circle r="7" fill={RES_COLOR}
                  initial={{ cx: SRX - 38, cy: Y + 14 }}
                  animate={{ cx: CLX + 38,  cy: Y + 14, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.4] }}
                  transition={{ duration: 0.55, ease: "easeInOut" }} />
                <text x={MID} y={Y + 28} textAnchor="middle" fontSize="8" fill={RES_COLOR + "cc"}>← Response: {pending}</text>
              </motion.g>
            )}
          </AnimatePresence>

          <text x="220" y="212" textAnchor="middle" fontSize="9.5" fill="hsl(270 40% 65%)" opacity="0.7">
            Client suspends at await — resumes when server responds
          </text>
        </svg>
      </div>

      {showControls && (
        <div className="px-4 pb-4 flex flex-wrap items-center gap-3 text-xs">
          <button onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={reset} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground">
            <RotateCcw className="size-3" />
          </button>
          <label className="flex items-center gap-2 text-muted-foreground">
            Latency
            <input type="range" min={50} max={500} value={latency}
              onChange={(e) => { setLatency(+e.target.value); reset(); }}
              className="w-24 accent-primary" />
            <span className="font-mono text-foreground w-14">{latency} ms</span>
          </label>
        </div>
      )}
    </div>
  );
}
