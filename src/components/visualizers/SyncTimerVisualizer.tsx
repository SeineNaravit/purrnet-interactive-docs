"use client";

/**
 * Visual model: Synchronized countdown timer across multiple clients.
 * Three panels side by side: Server, Client A, Client B
 * A progress bar counts down in all three simultaneously.
 * Latency slider adds a tiny visual delay on clients vs server.
 * When timer expires, EXPIRED badge pops in all panels.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

const TOTAL = 10; // seconds

interface PanelProps {
  label: string;
  color: string;
  progress: number; // 0–1, 1 = full, 0 = empty
  timeLeft: number;
  expired: boolean;
  delay: number; // visual label only
}

function Panel({ label, color, progress, timeLeft, expired, delay }: PanelProps) {
  const displayTime = Math.max(0, timeLeft - delay / 1000);
  return (
    <div className="flex-1 rounded-xl border border-border bg-muted/30 p-3 flex flex-col items-center gap-2 min-w-0">
      <div className="text-xs font-semibold" style={{ color }}>{label}</div>
      {delay > 0 && (
        <div className="text-[9px] text-muted-foreground">+{delay}ms lag</div>
      )}
      {/* Circular-style progress ring */}
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(270 20% 30%)" strokeWidth="4" />
          <motion.circle
            cx="28" cy="28" r="22" fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 22}`}
            animate={{ strokeDashoffset: (1 - progress) * 2 * Math.PI * 22 }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-mono font-bold" style={{ color }}>
            {expired ? "0" : Math.ceil(displayTime)}
          </span>
        </div>
      </div>
      {/* Bar */}
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>
      <AnimatePresence>
        {expired && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            EXPIRED
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SyncTimerVisualizer() {
  const [latency, setLatency] = useState(120);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(performance.now());
  const pausedAtRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const e = Math.min(TOTAL, (now - startRef.current) / 1000);
    setElapsed(e);
    if (e < TOTAL) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setRunning(false);
    }
  }, []);

  const start = useCallback(() => {
    startRef.current = performance.now() - pausedAtRef.current * 1000;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    if (running) start();
    else stop();
    return stop;
  }, [running, start, stop]);

  const restart = () => {
    stop();
    pausedAtRef.current = 0;
    setElapsed(0);
    startRef.current = performance.now();
    setRunning(true);
  };

  const togglePause = () => {
    if (running) {
      pausedAtRef.current = elapsed;
      setRunning(false);
    } else if (elapsed < TOTAL) {
      setRunning(true);
    }
  };

  const progress = 1 - elapsed / TOTAL;
  const timeLeft = TOTAL - elapsed;
  const expired = elapsed >= TOTAL;

  const clientDelay = latency / 1000;
  const clientProgress = Math.max(0, 1 - Math.max(0, elapsed - clientDelay) / TOTAL);
  const clientTimeLeft = TOTAL - Math.max(0, elapsed - clientDelay);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>SyncTimer — all clients count down in lockstep</span>
        <code className="text-primary text-xs font-mono">SyncTimer</code>
      </div>

      <div className="p-4">
        <div className="flex gap-3">
          <Panel
            label="Server"
            color="hsl(270 60% 65%)"
            progress={progress}
            timeLeft={timeLeft}
            expired={expired}
            delay={0}
          />
          <Panel
            label="Client A"
            color="hsl(200 60% 65%)"
            progress={clientProgress}
            timeLeft={clientTimeLeft}
            expired={clientTimeLeft <= 0}
            delay={latency}
          />
          <Panel
            label="Client B"
            color="hsl(300 55% 65%)"
            progress={clientProgress}
            timeLeft={clientTimeLeft}
            expired={clientTimeLeft <= 0}
            delay={latency}
          />
        </div>

        {/* Sync pulse line */}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          <span>Server tick broadcast</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 flex flex-wrap items-center gap-3 text-xs border-t border-border pt-3">
        <button
          onClick={restart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          <RotateCcw className="size-3" />
          Restart
        </button>
        <button
          onClick={togglePause}
          disabled={expired}
          className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground font-medium disabled:opacity-40"
        >
          {running ? "Pause" : "Resume"}
        </button>
        <label className="flex items-center gap-2 text-muted-foreground">
          Client lag
          <input
            type="range" min={0} max={500} value={latency}
            onChange={(e) => setLatency(+e.target.value)}
            className="w-24 accent-primary"
          />
          <span className="font-mono text-foreground w-14">{latency} ms</span>
        </label>
      </div>
    </div>
  );
}
