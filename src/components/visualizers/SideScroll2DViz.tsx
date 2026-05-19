"use client";

// Visual concept: 2D platformer scene showing multiplayer position sync.
// Owner (blue) moves on command; Observer (gray) lerps toward owner at 0.12
// factor every 50ms to simulate network interpolation lag.
// Attack flashes a yellow hit-effect div; Jump animates Y offset via useRef timers.

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUp, Sword } from "lucide-react";

const LERP_FACTOR = 0.12;
const LERP_INTERVAL = 50;
const SCENE_H = 220;

export function SideScroll2DViz() {
  const ownerX = useRef(10);
  const ownerY = useRef(0);
  const obsX = useRef(10);
  const obsY = useRef(0);
  const facingRight = useRef(true);
  const jumpActive = useRef(false);

  const [render, setRender] = useState(0);
  const [showAttack, setShowAttack] = useState(false);

  const tick = () => setRender((n) => n + 1);

  useEffect(() => {
    const id = setInterval(() => {
      obsX.current += (ownerX.current - obsX.current) * LERP_FACTOR;
      obsY.current += (ownerY.current - obsY.current) * LERP_FACTOR;
      tick();
    }, LERP_INTERVAL);
    return () => clearInterval(id);
  }, []);

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

  const jump = () => {
    if (jumpActive.current) return;
    jumpActive.current = true;
    const start = Date.now();
    const PEAK = 35;
    const DURATION = 300;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / DURATION, 1);
      ownerY.current = Math.sin(t * Math.PI) * PEAK;
      tick();
      if (t >= 1) {
        ownerY.current = 0;
        jumpActive.current = false;
        clearInterval(id);
        tick();
      }
    }, 16);
  };

  const attack = () => {
    setShowAttack(true);
    setTimeout(() => setShowAttack(false), 250);
  };

  const ox = ownerX.current;
  const oy = ownerY.current;
  const gx = obsX.current;
  const gy = obsY.current;
  const facing = facingRight.current;

  // ground bar = bottom 10% of scene (22px)
  const groundH = Math.round(SCENE_H * 0.1);
  const charBottom = groundH;
  const charW = 28;
  const charH = 36;

  const charStyle = (xPct: number, yPx: number): React.CSSProperties => ({
    position: "absolute",
    left: `${xPct}%`,
    bottom: `${charBottom + yPx}px`,
    width: charW,
    height: charH,
    transform: "translateX(-50%)",
  });

  const eyeStyle = (fr: boolean): React.CSSProperties => ({
    position: "absolute",
    top: 6,
    [fr ? "right" : "left"]: 5,
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "white",
  });

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 select-none">
      {/* Scene */}
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ height: SCENE_H, background: "#0f172a" }}
      >
        {/* Platforms */}
        <div className="absolute rounded" style={{ left: "25%", bottom: "22%", width: 80, height: 10, background: "#475569" }} />
        <div className="absolute rounded" style={{ left: "60%", bottom: "32%", width: 70, height: 10, background: "#475569" }} />

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 rounded-b-lg" style={{ height: groundH, background: "#334155" }} />

        {/* Observer (gray) */}
        <div style={charStyle(gx, gy)}>
          <div className="w-full h-full rounded-sm bg-slate-500 relative">
            <div style={eyeStyle(facing)} />
          </div>
        </div>

        {/* Owner (blue) */}
        <div style={charStyle(ox, oy)}>
          <div className="w-full h-full rounded-sm bg-blue-500 relative">
            <div style={eyeStyle(facing)} />
          </div>
          {/* Attack flash */}
          <AnimatePresence>
            {showAttack && (
              <motion.div
                key="flash"
                initial={{ opacity: 1, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute rounded-full bg-yellow-400"
                style={{ width: 20, height: 20, top: 6, [facing ? "left" : "right"]: -22 }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Labels */}
        <div className="absolute top-2 left-2 text-xs text-blue-400 font-mono">Owner</div>
        <div className="absolute top-2 left-2 mt-5 text-xs text-slate-400 font-mono">Observer</div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button onClick={moveLeft} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors">
          <ArrowLeft size={13} /> Move Left
        </button>
        <button onClick={moveRight} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors">
          Move Right <ArrowRight size={13} />
        </button>
        <button onClick={jump} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors">
          Jump <ArrowUp size={13} />
        </button>
        <button onClick={attack} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-yellow-100 text-xs font-medium transition-colors">
          Attack <Sword size={13} />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 font-mono">SyncVar: facingRight | animState</span>
        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-blue-300 font-mono">NetworkTransform: position</span>
      </div>
    </div>
  );
}
