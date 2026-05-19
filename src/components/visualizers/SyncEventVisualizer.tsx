"use client";

/**
 * Visual model: SyncEvent — authority fires a C# event; PurrNet intercepts
 * it and broadcasts automatically to all observing clients.
 *
 * Layout (flex, no SVG):
 *   [SERVER] — pulses, shows "OnPlayerScored?.Invoke()"
 *       ↓ teal packet
 *   [✦ PurrNet Interceptor] — dashed box, glows on receive, labeled "broadcast"
 *       ↓ three teal packets fan out simultaneously
 *   [Client A]  [Client B]  [Client C] — each flashes green "✓ handler fired"
 *
 * Animation cycle (~2.5 s):
 *   0.0 s  Server pulses + invoke label appears
 *   0.4 s  Packet travels Server → Interceptor
 *   0.9 s  Interceptor glows / "broadcast" label
 *   1.1 s  Three packets fan out to clients (80 ms stagger)
 *   1.6 s  Clients flash "✓ handler fired"
 *   2.5 s  Reset, loop
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

const SERVER_COLOR      = "hsl(270 60% 65%)";
const CLIENT_COLOR      = "hsl(200 55% 65%)";
const TEAL_COLOR        = "hsl(175 65% 55%)";
const FIRED_COLOR       = "hsl(140 60% 55%)";
const CYCLE_MS          = 2600;

const CLIENTS = ["Client A", "Client B", "Client C"] as const;

export function SyncEventVisualizer({ showControls = true }: { showControls?: boolean }) {
  const [playing, setPlaying]             = useState(true);
  const [phase, setPhase]                 = useState<number>(-1); // -1 = idle
  const timerRef                          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    if (timerRef.current)   clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const runCycle = () => {
    // phase 0 → server pulse + invoke label
    setPhase(0);
    timerRef.current = setTimeout(() => setPhase(1), 400);   // packet Server→Interceptor
    timerRef.current = setTimeout(() => setPhase(2), 900);   // interceptor glow
    timerRef.current = setTimeout(() => setPhase(3), 1150);  // fan-out packets
    timerRef.current = setTimeout(() => setPhase(4), 1650);  // clients flash
    timerRef.current = setTimeout(() => setPhase(-1), 2300); // idle
  };

  useEffect(() => {
    if (!playing) { clearAll(); setPhase(-1); return; }
    runCycle();
    intervalRef.current = setInterval(runCycle, CYCLE_MS);
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const reset = () => {
    clearAll();
    setPhase(-1);
    if (playing) setTimeout(runCycle, 80);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground">
          SyncEvent — fire-and-forget to all observers
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono">
          auto-broadcast
        </span>
      </div>

      {/* Stage */}
      <div className="relative flex flex-col items-center gap-0 px-4 pt-6 pb-4" style={{ minHeight: 320 }}>

        {/* SERVER NODE */}
        <motion.div
          animate={phase === 0 ? { scale: [1, 1.12, 1], boxShadow: [`0 0 0px ${SERVER_COLOR}00`, `0 0 18px ${SERVER_COLOR}99`, `0 0 6px ${SERVER_COLOR}44`] } : { scale: 1 }}
          transition={{ duration: 0.45 }}
          className="relative flex flex-col items-center justify-center rounded-xl border-2 px-5 py-3 w-44 z-10"
          style={{ borderColor: SERVER_COLOR, background: `${SERVER_COLOR}18` }}
        >
          <span className="text-xs font-bold" style={{ color: SERVER_COLOR }}>SERVER</span>
          <AnimatePresence>
            {phase === 0 && (
              <motion.span
                key="invoke"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-[9px] font-mono mt-1 text-center leading-tight"
                style={{ color: TEAL_COLOR }}
              >
                OnPlayerScored?.Invoke()
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Packet: Server → Interceptor */}
        <div className="relative flex items-center justify-center h-10 w-full">
          <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: `${TEAL_COLOR}30`, transform: "translateX(-50%)" }} />
          <AnimatePresence>
            {phase === 1 && (
              <motion.div
                key="pkt-s-i"
                className="absolute rounded-full z-20"
                style={{ width: 12, height: 12, background: TEAL_COLOR, top: 0, left: "calc(50% - 6px)" }}
                initial={{ y: 0, opacity: 0, scale: 0.5 }}
                animate={{ y: 38, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1, 0.6] }}
                exit={{}}
                transition={{ duration: 0.42, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* INTERCEPTOR BOX */}
        <motion.div
          animate={phase === 2 ? { boxShadow: [`0 0 0px ${TEAL_COLOR}00`, `0 0 20px ${TEAL_COLOR}aa`, `0 0 8px ${TEAL_COLOR}55`] } : { boxShadow: `0 0 0px ${TEAL_COLOR}00` }}
          transition={{ duration: 0.5 }}
          className="relative flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-2 w-44 z-10"
          style={{ borderColor: TEAL_COLOR, background: `${TEAL_COLOR}10` }}
        >
          <span className="text-[10px] font-semibold" style={{ color: TEAL_COLOR }}>✦ PurrNet</span>
          <AnimatePresence>
            {phase === 2 && (
              <motion.span
                key="bc-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[9px] font-mono"
                style={{ color: TEAL_COLOR }}
              >
                broadcast
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Fan-out row: packets + connectors */}
        <div className="relative flex items-start justify-center w-full" style={{ height: 60 }}>
          {CLIENTS.map((_, i) => {
            // horizontal offsets for 3 equal columns in a ~320px container
            const offsets = [-110, 0, 110];
            const off = offsets[i];
            return (
              <div key={i} className="absolute" style={{ left: `calc(50% + ${off}px - 6px)`, top: 0 }}>
                {/* vertical + diagonal connector */}
                <div style={{ position: "absolute", left: 6, top: 0, width: 1, height: 56, background: `${TEAL_COLOR}20` }} />
                <AnimatePresence>
                  {phase === 3 && (
                    <motion.div
                      key={`fan-${i}`}
                      className="absolute rounded-full z-20"
                      style={{ width: 11, height: 11, background: TEAL_COLOR, top: 0, left: 0 }}
                      initial={{ y: 0, x: 0, opacity: 0, scale: 0.5 }}
                      animate={{ y: 52, x: 0, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1, 0.5] }}
                      exit={{}}
                      transition={{ duration: 0.45, delay: i * 0.08, ease: "easeInOut" }}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* CLIENT NODES */}
        <div className="flex items-start justify-center gap-4 w-full">
          {CLIENTS.map((label, i) => (
            <motion.div
              key={label}
              animate={phase === 4 ? { scale: [1, 1.1, 1], boxShadow: [`0 0 0px ${FIRED_COLOR}00`, `0 0 14px ${FIRED_COLOR}99`, `0 0 0px ${FIRED_COLOR}00`] } : { scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2 flex-1 max-w-[88px]"
              style={{ borderColor: CLIENT_COLOR, background: `${CLIENT_COLOR}15` }}
            >
              <span className="text-[10px] font-bold" style={{ color: CLIENT_COLOR }}>{label}</span>
              <span className="text-[8px] mt-0.5" style={{ color: CLIENT_COLOR + "99" }}>🔔 subscribed</span>
              <AnimatePresence>
                {phase === 4 && (
                  <motion.span
                    key={`fired-${i}`}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="text-[8px] font-semibold mt-1"
                    style={{ color: FIRED_COLOR }}
                  >
                    ✓ handler fired
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Controls */}
      {showControls && (
        <div className="px-4 pb-4 pt-2 flex items-center gap-3 text-xs border-t border-border">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
          <span className="text-muted-foreground ml-auto text-[10px]">
            Server fires once — PurrNet delivers to all observers
          </span>
        </div>
      )}
    </div>
  );
}
