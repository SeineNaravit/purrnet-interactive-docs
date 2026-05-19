"use client";

/**
 * Visual model: A character (square) moves across a play field.
 * Left panel = "Authority" (owner/server sending updates).
 * Right panel = "Remote" (other clients receiving + interpolating).
 * Latency slider adds a delay to the right panel's updates.
 * Interpolation toggle shows snapping vs. smooth motion.
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

interface Props {
  showControls?: boolean;
}

const FIELD = { w: 180, h: 120 };

function useMovingPosition(playing: boolean) {
  const [pos, setPos] = useState({ x: 0.1, y: 0.5 });
  const t = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      t.current += 0.025;
      setPos({
        x: 0.1 + 0.8 * ((Math.sin(t.current * 0.7) + 1) / 2),
        y: 0.15 + 0.7 * ((Math.cos(t.current * 0.5) + 1) / 2),
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing]);
  return pos;
}

export function NetworkTransformVisualizer({ showControls = true }: Props) {
  const [latency, setLatency] = useState(120);
  const [interpolate, setInterpolate] = useState(true);
  const [playing, setPlaying] = useState(true);
  const authorityPos = useMovingPosition(playing);
  const [remotePos, setRemotePos] = useState({ x: 0.1, y: 0.5 });

  useEffect(() => {
    const timeout = setTimeout(() => setRemotePos(authorityPos), latency);
    return () => clearTimeout(timeout);
  }, [authorityPos, latency]);

  const toPixel = (norm: { x: number; y: number }) => ({
    x: 10 + norm.x * (FIELD.w - 20),
    y: 10 + norm.y * (FIELD.h - 20),
  });

  const authPx = toPixel(authorityPos);
  const remotePx = toPixel(remotePos);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">
        NetworkTransform — position sync across network
      </div>
      <div className="p-4">
        <div className="flex gap-4 justify-center">
          {/* Authority side */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-semibold text-emerald-400">Authority (Owner)</div>
            <div className="relative rounded-xl border border-emerald-500/30 bg-emerald-500/5"
              style={{ width: FIELD.w, height: FIELD.h }}>
              <motion.div
                className="absolute w-7 h-7 rounded-md bg-emerald-400 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-black"
                style={{ x: authPx.x - 14, y: authPx.y - 14 }}
                transition={{ type: "tween", duration: 0.05 }}
              >
                🐱
              </motion.div>
            </div>
            <div className="text-[10px] text-muted-foreground">Actual position</div>
          </div>

          {/* Network gap visual */}
          <div className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
            <div className="w-px h-full bg-border" />
            <div className="px-2 py-1 rounded bg-muted text-center leading-tight">
              <div className="font-mono text-foreground">{latency}ms</div>
              <div className="text-[9px]">latency</div>
            </div>
            <div className="w-px h-full bg-border" />
          </div>

          {/* Remote side */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-semibold text-blue-400">Remote Client</div>
            <div className="relative rounded-xl border border-blue-500/30 bg-blue-500/5"
              style={{ width: FIELD.w, height: FIELD.h }}>
              <motion.div
                className="absolute w-7 h-7 rounded-md bg-blue-400 shadow-lg shadow-blue-500/30 flex items-center justify-center text-[10px] font-bold text-black"
                style={{ x: remotePx.x - 14, y: remotePx.y - 14 }}
                animate={interpolate ? { x: remotePx.x - 14, y: remotePx.y - 14 } : undefined}
                transition={interpolate ? { type: "spring", stiffness: 120, damping: 20 } : { duration: 0 }}
              >
                🐱
              </motion.div>
              {/* Ghost showing actual authority pos */}
              <div
                className="absolute w-7 h-7 rounded-md border-2 border-emerald-400/40 border-dashed"
                style={{ left: authPx.x - 14, top: authPx.y - 14, transition: "left 0.05s, top 0.05s" }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {interpolate ? "Interpolated" : "Snapping"} · ghost = true pos
            </div>
          </div>
        </div>
      </div>

      {showControls && (
        <div className="px-4 pb-4 flex flex-wrap items-center gap-3 text-xs border-t border-border pt-3">
          <button onClick={() => setPlaying(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <label className="flex items-center gap-2 text-muted-foreground">
            Latency
            <input type="range" min={0} max={500} value={latency} onChange={e => setLatency(+e.target.value)} className="w-24 accent-primary" />
            <span className="font-mono text-foreground w-14">{latency} ms</span>
          </label>
          <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={interpolate} onChange={e => setInterpolate(e.target.checked)} className="accent-primary" />
            Interpolate
          </label>
        </div>
      )}
    </div>
  );
}
