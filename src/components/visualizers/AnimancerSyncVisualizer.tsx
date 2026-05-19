"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Demonstrates PurrNetAnimancerSync: how clip playback and normalized time
 * propagate from the Owner to an Observer over PurrNet.
 *
 * Left  — Owner panel: 5 clip buttons (Idle / Walk / Run / Jump / Attack).
 *          Shows the currently playing clip name + an animated progress bar.
 * Center — Network channel: a packet fires from owner to observer on clip change.
 *          "~100 ms RTT" label shows the simulated delay.
 * Right  — Observer panel: the same clip plays with a simulated 150 ms delay.
 *          A "drift" badge shows how far the observer's normalized time lags
 *          before PurrNetAnimancerSync's correction loop closes the gap.
 *
 * Clicking a clip button:
 *   1. Owner plays instantly (normalizedTime resets to 0).
 *   2. SyncVar fires → after 150 ms simulated delay, Observer switches clip.
 *   3. Both progress bars advance independently; Observer corrects toward Owner.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, User, Server, Radio } from "lucide-react";

interface Clip {
  name: string;
  duration: number;
  looping: boolean;
  color: string;
  bg: string;
  emoji: string;
}

const CLIPS: Clip[] = [
  { name: "Idle",   duration: 1.5, looping: true,  color: "#60a5fa", bg: "bg-blue-500",   emoji: "🧍" },
  { name: "Walk",   duration: 0.8, looping: true,  color: "#34d399", bg: "bg-emerald-500", emoji: "🚶" },
  { name: "Run",    duration: 0.5, looping: true,  color: "#fbbf24", bg: "bg-amber-500",   emoji: "🏃" },
  { name: "Jump",   duration: 0.7, looping: false, color: "#fb7185", bg: "bg-rose-500",    emoji: "⬆️" },
  { name: "Attack", duration: 0.6, looping: false, color: "#a78bfa", bg: "bg-violet-500",  emoji: "⚔️" },
];

const TICK_MS = 50;
const DELAY_MS = 150;
const CORRECTION_SPEED = 8; // lerp speed per second
const DRIFT_THRESHOLD = 0.05;

function ProgressBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span className="font-mono">{label}</span>
        <span className="font-mono">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
          transition={{ duration: 0 }}
        />
      </div>
    </div>
  );
}

function ClipCard({ clipIdx, normalizedTime, title, icon }: {
  clipIdx: number;
  normalizedTime: number;
  title: string;
  icon: React.ReactNode;
}) {
  const clip = CLIPS[clipIdx];
  return (
    <div className="bg-slate-800/70 rounded-xl border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">{clip.emoji}</span>
        <div>
          <div className="text-sm font-bold" style={{ color: clip.color }}>{clip.name}</div>
          <div className="text-xs text-slate-500">{clip.looping ? "Looping" : "One-shot"} · {clip.duration}s</div>
        </div>
      </div>
      <ProgressBar value={normalizedTime} color={clip.color} label="NormalizedTime" />
    </div>
  );
}

export function AnimancerSyncVisualizer() {
  // Mutable simulation state (refs to avoid stale closures)
  const simRef = useRef({
    ownerClipIdx: 0,
    observerClipIdx: 0,
    ownerNT: 0,
    observerNT: 0,
    pendingUpdate: null as null | { clipIdx: number; nt: number; triggerAt: number },
  });

  // React state for rendering
  const [ownerClipIdx, setOwnerClipIdx] = useState(0);
  const [observerClipIdx, setObserverClipIdx] = useState(0);
  const [ownerNT, setOwnerNT] = useState(0);
  const [observerNT, setObserverNT] = useState(0);
  const [drift, setDrift] = useState(0);
  const [showPacket, setShowPacket] = useState(false);
  const packetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulation tick
  useEffect(() => {
    const id = setInterval(() => {
      const s = simRef.current;
      const now = Date.now();
      const dt = TICK_MS / 1000;

      // Advance owner normalized time
      const ownerClip = CLIPS[s.ownerClipIdx];
      s.ownerNT += dt / ownerClip.duration;
      if (ownerClip.looping) s.ownerNT %= 1;
      else s.ownerNT = Math.min(s.ownerNT, 1);

      // Apply pending observer update (after simulated delay)
      if (s.pendingUpdate && now >= s.pendingUpdate.triggerAt) {
        s.observerClipIdx = s.pendingUpdate.clipIdx;
        s.observerNT = s.pendingUpdate.nt;
        s.pendingUpdate = null;
        setObserverClipIdx(s.observerClipIdx);
      }

      // Advance observer normalized time
      const obsClip = CLIPS[s.observerClipIdx];
      s.observerNT += dt / obsClip.duration;
      if (obsClip.looping) s.observerNT %= 1;
      else s.observerNT = Math.min(s.observerNT, 1);

      // Simulate drift correction (same clip only)
      if (s.observerClipIdx === s.ownerClipIdx) {
        const d = s.ownerNT - s.observerNT;
        if (Math.abs(d) > DRIFT_THRESHOLD) {
          s.observerNT += d * CORRECTION_SPEED * dt;
        }
      }

      const rawDrift =
        s.observerClipIdx === s.ownerClipIdx
          ? Math.abs(s.ownerNT - s.observerNT)
          : 0;

      setOwnerNT(s.ownerNT);
      setObserverNT(s.observerNT);
      setDrift(rawDrift);
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  const handlePlay = (idx: number) => {
    const s = simRef.current;
    s.ownerClipIdx = idx;
    s.ownerNT = 0;
    setOwnerClipIdx(idx);

    // Schedule delayed observer update
    s.pendingUpdate = { clipIdx: idx, nt: 0, triggerAt: Date.now() + DELAY_MS };

    // Show network packet
    setShowPacket(true);
    if (packetTimerRef.current) clearTimeout(packetTimerRef.current);
    packetTimerRef.current = setTimeout(() => setShowPacket(false), 400);
  };

  const ownerClip = CLIPS[ownerClipIdx];
  const observerClip = CLIPS[observerClipIdx];
  const driftMs = Math.round(drift * observerClip.duration * 1000);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-5 py-3 flex items-center gap-3">
        <Radio className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-slate-200">Animancer Clip Sync</span>
        <span className="ml-auto text-xs text-slate-600">Simulated 150 ms RTT</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] gap-4 p-5">
        {/* Owner */}
        <div className="space-y-3">
          <ClipCard
            clipIdx={ownerClipIdx}
            normalizedTime={ownerNT}
            title="Owner (You)"
            icon={<User className="w-4 h-4 text-blue-400" />}
          />
          <div>
            <div className="text-xs text-slate-500 mb-2">Play clip:</div>
            <div className="flex flex-wrap gap-1.5">
              {CLIPS.map((clip, i) => (
                <button
                  key={clip.name}
                  onClick={() => handlePlay(i)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all font-medium ${
                    i === ownerClipIdx
                      ? "border-transparent text-slate-900"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                  style={i === ownerClipIdx ? { backgroundColor: clip.color } : {}}
                >
                  {clip.emoji} {clip.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Network channel */}
        <div className="flex flex-col items-center justify-center gap-2 py-2">
          <Wifi className="w-4 h-4 text-slate-600" />
          <div className="flex-1 w-px bg-slate-800 relative overflow-visible">
            <AnimatePresence>
              {showPacket && (
                <motion.div
                  key="packet"
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ y: "100%", opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeIn" }}
                  className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                  style={{ backgroundColor: ownerClip.color, top: 0 }}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="text-xs text-slate-600 text-center leading-tight">
            SyncVar<br />+ RPC
          </div>
          <div className="w-4 h-px bg-slate-700" />
        </div>

        {/* Observer */}
        <div className="space-y-3">
          <ClipCard
            clipIdx={observerClipIdx}
            normalizedTime={observerNT}
            title="Observer (Peer)"
            icon={<Server className="w-4 h-4 text-emerald-400" />}
          />
          {/* Drift badge */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs transition-colors ${
            driftMs > 30
              ? "bg-amber-900/20 border-amber-500/30 text-amber-300"
              : "bg-emerald-900/20 border-emerald-500/30 text-emerald-300"
          }`}>
            <div className={`w-2 h-2 rounded-full ${driftMs > 30 ? "bg-amber-400" : "bg-emerald-400"}`} />
            <span>
              {ownerClipIdx === observerClipIdx
                ? `Drift: ${driftMs} ms ${driftMs > 30 ? "— correcting…" : "— in sync ✓"}`
                : "Waiting for SyncVar…"}
            </span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            Observer corrects toward owner NormalizedTime at {CORRECTION_SPEED}×/s when drift &gt; {DRIFT_THRESHOLD}.
          </div>
        </div>
      </div>
    </div>
  );
}
