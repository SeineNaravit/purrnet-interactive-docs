"use client";

/**
 * Visual model: SyncInput — owner samples input each tick and sends to server.
 * Only the owner→server path is active; other clients are grayed out.
 * Layout: [Owner panel] ──packet──► [Server log] with ghost clients below.
 * Animation: per tick — random WASD state, gold packet travels, server log scrolls.
 * Controls: Play/Pause + Tick Rate slider (5–30 ticks/s).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";

const OWNER_COLOR   = "hsl(140 55% 55%)";
const SERVER_COLOR  = "hsl(270 60% 65%)";
const PACKET_COLOR  = "hsl(45 80% 60%)";
const GHOST_COLOR   = "hsl(220 10% 45%)";

type InputState = { w: boolean; a: boolean; s: boolean; d: boolean; jump: boolean };

function randomInput(): InputState {
  const keys = ["w", "a", "s", "d"] as const;
  const active = keys[Math.floor(Math.random() * keys.length)];
  return {
    w: active === "w",
    a: active === "a",
    s: active === "s",
    d: active === "d",
    jump: Math.random() < 0.2,
  };
}

function inputLabel(inp: InputState): string {
  const parts: string[] = [];
  if (inp.w) parts.push("W");
  if (inp.a) parts.push("A");
  if (inp.s) parts.push("S");
  if (inp.d) parts.push("D");
  if (inp.jump) parts.push("Jump");
  return parts.join("+") || "—";
}

interface LogEntry { tick: number; label: string; id: number }

export function SyncInputVisualizer({ showControls = true }: { showControls?: boolean }) {
  const [playing, setPlaying]     = useState(true);
  const [tickRate, setTickRate]   = useState(10);
  const [tickNum, setTickNum]     = useState(40);
  const [input, setInput]         = useState<InputState>({ w: false, a: false, s: false, d: false, jump: false });
  const [log, setLog]             = useState<LogEntry[]>([]);
  const [pktKey, setPktKey]       = useState(0);
  const [pktVisible, setPktVisible] = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const entryId                   = useRef(0);

  const doTick = useCallback(() => {
    const inp = randomInput();
    setInput(inp);
    setTickNum((t) => t + 1);
    setPktKey((k) => k + 1);
    setPktVisible(true);
    setTimeout(() => setPktVisible(false), Math.min(900, (1000 / tickRate) * 0.85));
    setLog((prev) => {
      const entry: LogEntry = { tick: prev.length > 0 ? prev[prev.length - 1].tick + 1 : 42, label: inputLabel(inp), id: entryId.current++ };
      return [...prev.slice(-2), entry];
    });
  }, [tickRate]);

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(doTick, 1000 / tickRate);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, tickRate, doTick]);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground">
          SyncInput — owner → server, every tick
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border font-mono" style={{ color: PACKET_COLOR, borderColor: PACKET_COLOR + "60" }}>
          tick #{tickNum}
        </span>
      </div>

      {/* Main row: Owner | Packet arrow | Server */}
      <div className="relative flex items-stretch gap-0 px-4 pt-5 pb-4">

        {/* OWNER PANEL */}
        <div
          className="flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 w-36 shrink-0"
          style={{ borderColor: OWNER_COLOR, background: `${OWNER_COLOR}12` }}
        >
          <span className="text-[10px] font-bold" style={{ color: OWNER_COLOR }}>Owner (Client A)</span>

          {/* Arrow keys grid */}
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(3, 28px)", gridTemplateRows: "repeat(2, 28px)" }}>
            {/* Top row: only ↑ in center */}
            <div />
            <KeyCap label="↑" active={input.w} color={OWNER_COLOR} />
            <div />
            {/* Bottom row: ← ↓ → */}
            <KeyCap label="←" active={input.a} color={OWNER_COLOR} />
            <KeyCap label="↓" active={input.s} color={OWNER_COLOR} />
            <KeyCap label="→" active={input.d} color={OWNER_COLOR} />
          </div>

          {/* Jump button */}
          <motion.div
            animate={input.jump ? { scale: [1, 1.18, 1], backgroundColor: OWNER_COLOR } : { scale: 1, backgroundColor: `${OWNER_COLOR}20` }}
            transition={{ duration: 0.18 }}
            className="w-full text-center rounded-md text-[9px] font-semibold py-1"
            style={{ color: input.jump ? "#000" : OWNER_COLOR, border: `1px solid ${OWNER_COLOR}` }}
          >
            Jump {input.jump ? "▲" : ""}
          </motion.div>

          <span className="text-[8px] text-center leading-tight" style={{ color: OWNER_COLOR + "80" }}>
            InputState sampled each tick
          </span>
        </div>

        {/* Packet travel lane */}
        <div className="relative flex-1 flex items-center justify-center mx-1" style={{ minWidth: 60 }}>
          {/* Static dashed line */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-border" />
          {/* Packet arrow label */}
          <AnimatePresence>
            {pktVisible && (
              <motion.div
                key={pktKey}
                className="absolute flex flex-col items-center pointer-events-none z-10"
                initial={{ left: "0%", opacity: 0 }}
                animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
                exit={{}}
                transition={{ duration: Math.min(0.8, (1000 / tickRate) * 0.00075 * 1000 / 1000), ease: "easeInOut" }}
                style={{ top: "calc(50% - 18px)", transform: "translateX(-50%)" }}
              >
                <div
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: PACKET_COLOR + "25", color: PACKET_COLOR, border: `1px solid ${PACKET_COLOR}60` }}
                >
                  tick #{tickNum}
                </div>
                <motion.div
                  className="rounded-full mt-1"
                  style={{ width: 10, height: 10, background: PACKET_COLOR }}
                  animate={{ scale: [0.8, 1.3, 0.8] }}
                  transition={{ repeat: Infinity, duration: 0.4 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Arrow head */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 text-border text-base leading-none">▶</div>
        </div>

        {/* SERVER PANEL */}
        <div
          className="flex flex-col rounded-xl border-2 px-3 py-3 w-40 shrink-0 gap-1"
          style={{ borderColor: SERVER_COLOR, background: `${SERVER_COLOR}12` }}
        >
          <span className="text-[10px] font-bold mb-1 text-center" style={{ color: SERVER_COLOR }}>Server</span>
          <div className="flex flex-col gap-0.5 font-mono text-[8.5px] overflow-hidden" style={{ minHeight: 52 }}>
            <AnimatePresence initial={false}>
              {log.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18 }}
                  className="whitespace-nowrap"
                  style={{ color: entry === log[log.length - 1] ? SERVER_COLOR : SERVER_COLOR + "70" }}
                >
                  tick {entry.tick}: {entry.label}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <span className="text-[7.5px] mt-1 text-center" style={{ color: SERVER_COLOR + "70" }}>
            authoritative processing
          </span>
        </div>
      </div>

      {/* Other clients — grayed out */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-0">
        <span className="text-[9px] text-muted-foreground shrink-0">Other clients:</span>
        {["Client B", "Client C"].map((label) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center rounded-lg border px-3 py-1.5 gap-0.5"
            style={{ borderColor: GHOST_COLOR + "60", background: `${GHOST_COLOR}10` }}
          >
            <span className="text-[9px] font-semibold" style={{ color: GHOST_COLOR }}>{label}</span>
            <span className="text-[8px]" style={{ color: GHOST_COLOR + "90" }}>× not involved</span>
          </div>
        ))}
        <span className="ml-auto text-[8.5px] text-muted-foreground">Input never reaches peers</span>
      </div>

      {/* Controls */}
      {showControls && (
        <div className="px-4 pb-4 pt-2 flex flex-wrap items-center gap-3 text-xs border-t border-border">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <label className="flex items-center gap-2 text-muted-foreground">
            Tick Rate
            <input
              type="range" min={5} max={30} step={1} value={tickRate}
              onChange={(e) => setTickRate(+e.target.value)}
              className="w-24 accent-primary"
            />
            <span className="font-mono text-foreground w-16">{tickRate} tick/s</span>
          </label>
        </div>
      )}
    </div>
  );
}

/** Small keyboard key cap */
function KeyCap({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <motion.div
      animate={active
        ? { backgroundColor: color, scale: 1.12, boxShadow: `0 0 8px ${color}99` }
        : { backgroundColor: color + "18", scale: 1, boxShadow: "none" }
      }
      transition={{ duration: 0.12 }}
      className="flex items-center justify-center rounded text-xs font-bold"
      style={{
        width: 28, height: 28,
        border: `1.5px solid ${active ? color : color + "50"}`,
        color: active ? "#000" : color,
      }}
    >
      {label}
    </motion.div>
  );
}
