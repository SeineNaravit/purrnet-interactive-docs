"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated dungeon-phase state machine.
 *
 * Five phase nodes arranged in a loop:
 *   Prepare → VoteToStart → Fighting → EndFight → VoteNextArea → (back) Prepare
 *
 * A glowing ring moves from node to node on each tick.
 * Play/Pause and Step controls.
 * Each node shows its trigger condition below it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward } from "lucide-react";

// ── Phase data ────────────────────────────────────────────────────────────────

interface Phase {
  id: string;
  label: string;
  sublabel: string;
  trigger: string;
  color: string;
  border: string;
  glow: string;
}

const phases: Phase[] = [
  {
    id: "prepare",
    label: "Prepare",
    sublabel: "Countdown timer",
    trigger: "Timer expires → VoteToStart",
    color: "bg-slate-800",
    border: "border-slate-500",
    glow: "#94a3b8",
  },
  {
    id: "vote-start",
    label: "Vote to Start",
    sublabel: "Vote session open",
    trigger: "Majority YES → Fighting",
    color: "bg-indigo-950",
    border: "border-indigo-400",
    glow: "#818cf8",
  },
  {
    id: "fighting",
    label: "Fighting",
    sublabel: "Enemies active",
    trigger: "All enemies cleared → EndFight",
    color: "bg-red-950",
    border: "border-red-400",
    glow: "#f87171",
  },
  {
    id: "end-fight",
    label: "End Fight",
    sublabel: "Reward & summary",
    trigger: "Auto after delay → VoteNextArea",
    color: "bg-emerald-950",
    border: "border-emerald-400",
    glow: "#34d399",
  },
  {
    id: "vote-next",
    label: "Vote Next Area",
    sublabel: "Continue or exit?",
    trigger: "YES → Prepare (next) · NO → Exit dungeon",
    color: "bg-amber-950",
    border: "border-amber-400",
    glow: "#fbbf24",
  },
];

// Positions for each phase node (% of 560 × 320 canvas)
const positions = [
  { x: 50, y: 12 },  // Prepare — top centre
  { x: 85, y: 42 },  // VoteToStart — right
  { x: 70, y: 82 },  // Fighting — bottom right
  { x: 30, y: 82 },  // EndFight — bottom left
  { x: 15, y: 42 },  // VoteNextArea — left
];

const CW = 560;
const CH = 320;
const NW = 130;
const NH = 52;

function cx(pct: number) { return (pct / 100) * CW; }
function cy(pct: number) { return (pct / 100) * CH; }

// Pre-build arrow paths between consecutive phases (pentagon loop)
function arrowPath(fromIdx: number, toIdx: number) {
  const f = positions[fromIdx];
  const t = positions[toIdx];
  const fx = cx(f.x);
  const fy = cy(f.y);
  const tx = cx(t.x);
  const ty = cy(t.y);

  const angle = Math.atan2(ty - fy, tx - fx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const startX = fx + cos * (NW / 2 + 2);
  const startY = fy + sin * (NH / 2 + 2);
  const endX   = tx - cos * (NW / 2 + 8);
  const endY   = ty - sin * (NH / 2 + 8);

  // Slight inward curve
  const midX = (startX + endX) / 2 + (endY - startY) * 0.12;
  const midY = (startY + endY) / 2 - (endX - startX) * 0.12;

  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
}

const arrows = phases.map((_, i) => ({
  d:    arrowPath(i, (i + 1) % phases.length),
  color: phases[i].glow,
}));

// ── Component ─────────────────────────────────────────────────────────────────

export function GameplayStateMachineViz() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurrent((c) => (c + 1) % phases.length);
      }, 1800);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  const phase = phases[current];

  const step = () => {
    setPlaying(false);
    setCurrent((c) => (c + 1) % phases.length);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 overflow-x-auto">
      <p className="text-[11px] text-slate-500 mb-3">
        Dungeon Phase State Machine —{" "}
        <span className="text-slate-400">DungeonStateManager drives all transitions server-side</span>
      </p>

      {/* Canvas */}
      <div className="relative" style={{ width: CW, height: CH }}>
        {/* SVG arrows */}
        <svg
          width={CW} height={CH}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 0, overflow: "visible" }}
        >
          <defs>
            {phases.map((p) => (
              <marker
                key={p.id}
                id={`sm-arr-${p.id}`}
                markerWidth="7" markerHeight="7"
                refX="5" refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L0,7 L7,3.5 z" fill={p.glow} />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => (
            <path
              key={i}
              d={a.d}
              fill="none"
              stroke={a.color}
              strokeWidth={current === i ? 2.5 : 1.4}
              opacity={current === i ? 1 : 0.3}
              markerEnd={`url(#sm-arr-${phases[i].id})`}
            />
          ))}
        </svg>

        {/* Phase nodes */}
        {phases.map((p, i) => {
          const pos = positions[i];
          const isActive = current === i;
          return (
            <motion.div
              key={p.id}
              className={`absolute rounded-lg border-2 ${p.color} ${p.border} px-3 py-2 cursor-pointer select-none`}
              style={{
                left:   cx(pos.x) - NW / 2,
                top:    cy(pos.y) - NH / 2,
                width:  NW,
                zIndex: 10,
                boxShadow: isActive ? `0 0 18px 3px ${p.glow}50` : "none",
              }}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => { setPlaying(false); setCurrent(i); }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-wider mb-0.5"
                style={{ color: p.glow }}
              >
                Phase {i + 1}
              </div>
              <div className="text-[11px] font-semibold text-white leading-tight">
                {p.label}
              </div>
              <div className="text-[9px] text-slate-400 leading-tight">{p.sublabel}</div>
            </motion.div>
          );
        })}

        {/* Active phase label overlay (bottom centre of canvas) */}
        <div
          className="absolute left-1/2 pointer-events-none"
          style={{ bottom: 4, transform: "translateX(-50%)", zIndex: 20 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-center"
            >
              <span
                className="text-[10px] font-mono px-3 py-1 rounded-full border"
                style={{
                  color:           phase.glow,
                  borderColor:     `${phase.glow}60`,
                  backgroundColor: "#0f172a",
                }}
              >
                {phase.trigger}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/60">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={step}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
        >
          <SkipForward size={12} />
          Step
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {phases.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setPlaying(false); setCurrent(i); }}
              className="w-2 h-2 rounded-full transition-all"
              style={{ backgroundColor: current === i ? p.glow : "#334155" }}
            />
          ))}
        </div>
        <span className="text-[10px] text-slate-500">click a node or dot to jump</span>
      </div>
    </div>
  );
}
