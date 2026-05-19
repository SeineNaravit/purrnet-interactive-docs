"use client";

// Visual concept: 2.5D side-scroller showing depth lane sync.
// Three horizontal depth bands simulate perspective: front (large chars),
// mid, and back (small chars). Owner changes lane instantly; Observer follows
// with a 150ms delay to show network replication of depth state.

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Layers } from "lucide-react";

const LANE_COUNT = 3;

const LANE_CONFIG = [
  { label: "Front",  bg: "bg-slate-700", charPx: 36, bottomPct: 30, scale: 1.0 },
  { label: "Mid",    bg: "bg-slate-800", charPx: 28, bottomPct: 50, scale: 0.85 },
  { label: "Back",   bg: "bg-slate-900", charPx: 22, bottomPct: 65, scale: 0.70 },
];

export function SideScroll25DViz() {
  const ownerX = useRef(20);
  const ownerLane = useRef(0);
  const obsX = useRef(20);
  const obsLane = useRef(0);
  const [, setTick] = useState(0);
  const tick = () => setTick((n) => n + 1);
  const facingRight = useRef(true);

  const moveLeft = () => {
    ownerX.current = Math.max(5, ownerX.current - 12);
    facingRight.current = false;
    tick();
  };

  const moveRight = () => {
    ownerX.current = Math.min(85, ownerX.current + 12);
    facingRight.current = true;
    tick();
  };

  const jump = () => tick();

  const switchLane = () => {
    ownerLane.current = (ownerLane.current + 1) % LANE_COUNT;
    tick();
    setTimeout(() => {
      obsLane.current = ownerLane.current;
      tick();
    }, 150);
  };

  const ol = ownerLane.current;
  const gl = obsLane.current;
  const ox = ownerX.current;
  const gx = obsX.current;
  const fr = facingRight.current;
  const laneLabel = LANE_CONFIG[ol].label;

  const charDiv = (xPct: number, lane: number, color: string) => {
    const cfg = LANE_CONFIG[lane];
    const sz = cfg.charPx;
    return (
      <div
        style={{
          position: "absolute",
          left: `${xPct}%`,
          bottom: `${cfg.bottomPct}%`,
          width: sz,
          height: sz + 8,
          transform: `translateX(-50%) scale(${cfg.scale})`,
          transformOrigin: "bottom center",
          transition: "bottom 0.15s ease, transform 0.15s ease",
        }}
      >
        <div
          style={{ width: "100%", height: "100%", borderRadius: 4, background: color, position: "relative" }}
        >
          {/* eye */}
          <div
            style={{
              position: "absolute",
              top: 5,
              [fr ? "right" : "left"]: 4,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "white",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 select-none">
      {/* Scene */}
      <div className="relative w-full rounded-lg overflow-hidden" style={{ height: 220 }}>
        {/* Depth bands — back to front */}
        {[...LANE_CONFIG].reverse().map((lane, i) => (
          <div
            key={i}
            className={`absolute left-0 right-0 ${lane.bg}`}
            style={{ top: `${i * 33}%`, height: "34%" }}
          />
        ))}

        {/* Observer — render in its lane */}
        {charDiv(gx, gl, "#64748b")}
        {/* Owner */}
        {charDiv(ox, ol, "#3b82f6")}

        {/* Labels */}
        <div className="absolute top-2 left-2 text-xs text-blue-400 font-mono">Owner</div>
        <div className="absolute top-6 left-2 text-xs text-slate-400 font-mono">Observer</div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={moveLeft}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
        >
          <ArrowLeft size={13} /> Move
        </button>
        <button
          onClick={moveRight}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
        >
          Move <ArrowRight size={13} />
        </button>
        <button
          onClick={jump}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
        >
          Jump <ArrowUp size={13} />
        </button>
        <button
          onClick={switchLane}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-indigo-100 text-xs font-medium transition-colors"
        >
          <Layers size={13} /> Switch Lane
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-indigo-300 font-mono">
          Depth Lane: {ol} — {laneLabel}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 font-mono">
          Observer lag: 150ms
        </span>
      </div>
    </div>
  );
}
