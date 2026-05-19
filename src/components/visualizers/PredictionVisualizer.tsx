"use client";

/**
 * Visual model: Client-side prediction + server reconciliation.
 * A play field with two character icons:
 *   "Predicted" (blue) — moves instantly on input simulation
 *   "Server"    (orange) — arrives after latency
 * When divergence exceeds threshold, show red highlight and snap to server position.
 * Play/Pause controls + latency slider.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

const FIELD_W = 340;
const FIELD_H = 120;
const RECONCILE_THRESHOLD = 18; // pixels

function useAnimPath(playing: boolean) {
  const t = useRef(0);
  const [pos, setPos] = useState({ x: 0.1, y: 0.5 });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      t.current += 0.018;
      setPos({
        x: 0.1 + 0.8 * ((Math.sin(t.current * 0.6) + 1) / 2),
        y: 0.15 + 0.7 * ((Math.cos(t.current * 0.45 + 0.8) + 1) / 2),
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  return pos;
}

export function PredictionVisualizer() {
  const [latency, setLatency] = useState(180);
  const [playing, setPlaying] = useState(true);

  const serverPos = useAnimPath(playing);
  const [predictedPos, setPredictedPos] = useState({ x: 0.1, y: 0.5 });
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileCount, setReconcileCount] = useState(0);
  const prevServerRef = useRef(serverPos);

  // Predicted pos: slightly ahead of server (simulate player input prediction)
  useEffect(() => {
    // Add a small future-offset to simulate prediction overshoot
    const noise = latency / 2000; // more latency = more potential drift
    const nx = Math.min(1, serverPos.x + noise * (Math.sin(Date.now() / 400) * 0.5));
    const ny = Math.min(1, Math.max(0, serverPos.y + noise * (Math.cos(Date.now() / 350) * 0.5)));
    setPredictedPos({ x: nx, y: ny });
  }, [serverPos, latency]);

  const toPx = (norm: { x: number; y: number }) => ({
    x: 12 + norm.x * (FIELD_W - 24),
    y: 12 + norm.y * (FIELD_H - 24),
  });

  const serverPx = toPx(serverPos);
  const predictedPx = toPx(predictedPos);

  const dx = predictedPx.x - serverPx.x;
  const dy = predictedPx.y - serverPx.y;
  const divergence = Math.sqrt(dx * dx + dy * dy);
  const needsReconcile = divergence > RECONCILE_THRESHOLD;

  // Trigger reconciliation animation when divergence is large
  useEffect(() => {
    if (!needsReconcile || isReconciling) return;
    setIsReconciling(true);
    setReconcileCount((c) => c + 1);
    const t = setTimeout(() => {
      setPredictedPos(serverPos);
      setIsReconciling(false);
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReconcile]);

  const [reconcileFlash, setReconcileFlash] = useState(false);
  useEffect(() => {
    if (!isReconciling) return;
    setReconcileFlash(true);
    const t = setTimeout(() => setReconcileFlash(false), 600);
    return () => clearTimeout(t);
  }, [isReconciling]);

  const reset = useCallback(() => {
    setPredictedPos({ x: 0.1, y: 0.5 });
    setReconcileCount(0);
    setIsReconciling(false);
  }, []);

  const displayPredicted = isReconciling ? toPx(serverPos) : predictedPx;

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between text-xs">
        <span className="text-muted-foreground">PurrDiction — prediction &amp; reconciliation</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-blue-400" />
            <span className="text-muted-foreground">Predicted</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-orange-400" />
            <span className="text-muted-foreground">Server</span>
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Play field */}
        <div
          className="relative rounded-xl border overflow-hidden"
          style={{
            width: FIELD_W,
            height: FIELD_H,
            borderColor: reconcileFlash ? "hsl(10 70% 55%)" : "hsl(270 20% 35%)",
            backgroundColor: reconcileFlash ? "hsl(10 70% 55% / 0.06)" : "hsl(270 10% 10%)",
            transition: "border-color 0.2s, background-color 0.2s",
            maxWidth: "100%",
          }}
        >
          {/* Grid dots */}
          {Array.from({ length: 6 }, (_, row) =>
            Array.from({ length: 10 }, (_, col) => (
              <div
                key={`${row}-${col}`}
                className="absolute size-0.5 rounded-full bg-white/8"
                style={{ left: col * 38 + 10, top: row * 24 + 8 }}
              />
            ))
          )}

          {/* Divergence line */}
          {divergence > 5 && !isReconciling && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}>
              <line
                x1={serverPx.x} y1={serverPx.y}
                x2={predictedPx.x} y2={predictedPx.y}
                stroke={divergence > RECONCILE_THRESHOLD ? "hsl(10 70% 55%)" : "hsl(45 80% 60%)"}
                strokeWidth="1.5"
                strokeDasharray="3 2"
                opacity="0.6"
              />
            </svg>
          )}

          {/* Server character (orange) */}
          <motion.div
            className="absolute"
            style={{ x: serverPx.x - 14, y: serverPx.y - 14 }}
            transition={{ type: "tween", duration: latency / 1000 }}
          >
            <div className="w-7 h-7 rounded-md bg-orange-500/90 shadow-lg shadow-orange-500/30 flex items-center justify-center text-[11px] font-bold border border-orange-400">
              S
            </div>
          </motion.div>

          {/* Predicted character (blue) */}
          <motion.div
            className="absolute"
            animate={
              isReconciling
                ? { x: displayPredicted.x - 14, y: displayPredicted.y - 14, scale: [1, 0.85, 1] }
                : { x: predictedPx.x - 14, y: predictedPx.y - 14 }
            }
            transition={
              isReconciling
                ? { duration: 0.35, ease: "easeInOut" }
                : { type: "tween", duration: 0.05 }
            }
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold border"
              style={{
                backgroundColor: isReconciling ? "hsl(10 70% 55% / 0.9)" : "hsl(200 70% 55% / 0.9)",
                borderColor: isReconciling ? "hsl(10 70% 65%)" : "hsl(200 70% 65%)",
                boxShadow: isReconciling
                  ? "0 0 12px hsl(10 70% 55% / 0.5)"
                  : "0 4px 12px hsl(200 70% 55% / 0.3)",
              }}
            >
              P
            </div>
          </motion.div>

          {/* Reconciliation flash label */}
          <AnimatePresence>
            {isReconciling && (
              <motion.div
                key="reconcile-label"
                className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-red-500/90"
                initial={{ opacity: 0, y: -4, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                Reconciling!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <div>
            Divergence:{" "}
            <span
              className="font-mono font-semibold"
              style={{ color: divergence > RECONCILE_THRESHOLD ? "hsl(10 70% 55%)" : divergence > 8 ? "hsl(45 80% 60%)" : "hsl(140 55% 55%)" }}
            >
              {divergence.toFixed(1)}px
            </span>
          </div>
          <div>
            Threshold: <span className="font-mono text-foreground">{RECONCILE_THRESHOLD}px</span>
          </div>
          <div>
            Reconciliations: <span className="font-mono text-foreground">{reconcileCount}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 flex flex-wrap items-center gap-3 text-xs border-t border-border pt-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={reset} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground">
          <RotateCcw className="size-3" />
        </button>
        <label className="flex items-center gap-2 text-muted-foreground">
          Latency
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
