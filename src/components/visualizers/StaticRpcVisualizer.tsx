"use client";

/**
 * Visual model:
 * - Top: a mode toggle between "ObserversRpc" and "StaticRpc".
 *
 * ObserversRpc mode (two hops):
 *   Server  →  NetworkIdentity Object  →  Client A / B / C
 *   The NetworkIdentity box is required as an intermediary.
 *   Packets flow: Server → Object, then Object → each Client (fan-out).
 *
 * StaticRpc mode (one hop):
 *   NetworkManager  →  Client A / B / C  (direct, no object required)
 *   Label: "No NetworkIdentity required"
 *   Packets fly directly from the manager to all clients simultaneously.
 *
 * Switching modes triggers a Framer Motion layout animation so the
 * NetworkIdentity box fades/scales out and the arrows reroute smoothly.
 *
 * Controls: Mode toggle (ObserversRpc / StaticRpc), Play / Pause.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

type Mode = "ObserversRpc" | "StaticRpc";

const SERVER_COLOR  = "hsl(270 60% 65%)";
const OBJECT_COLOR  = "hsl(300 55% 65%)";
const CLIENT_COLOR  = "hsl(200 55% 65%)";
const OBS_PKT       = "hsl(300 50% 65%)";
const STA_PKT       = "hsl(45 80% 60%)";

interface Packet { id: number; sx: number; sy: number; tx: number; ty: number; color: string; delay: number }

// Static SVG coordinates
const SRC_OBS = { x: 60,  y: 120 };   // Server (observers mode)
const OBJ     = { x: 200, y: 120 };   // NetworkIdentity
const SRC_STA = { x: 60,  y: 120 };   // NetworkManager (same x, shared)
const CLIENTS = [
  { x: 370, y: 65  },
  { x: 370, y: 120 },
  { x: 370, y: 175 },
];

export function StaticRpcVisualizer({ showControls = true }: { showControls?: boolean }) {
  const [mode,    setMode]    = useState<Mode>("ObserversRpc");
  const [playing, setPlaying] = useState(true);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [tick,    setTick]    = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pkIdRef  = useRef(0);

  const buildPackets = useCallback((m: Mode): Packet[] => {
    const base = ++pkIdRef.current * 100;
    if (m === "ObserversRpc") {
      // Phase 1: Server → Object
      const hop1: Packet[] = [
        { id: base,     sx: SRC_OBS.x + 30, sy: SRC_OBS.y, tx: OBJ.x - 28, ty: OBJ.y, color: OBS_PKT, delay: 0 },
      ];
      // Phase 2: Object → each Client (staggered)
      const hop2: Packet[] = CLIENTS.map((c, i) => ({
        id: base + i + 1, sx: OBJ.x + 28, sy: OBJ.y, tx: c.x - 26, ty: c.y, color: OBS_PKT, delay: 0.6 + i * 0.1,
      }));
      return [...hop1, ...hop2];
    } else {
      // StaticRpc: Manager → all clients directly
      return CLIENTS.map((c, i) => ({
        id: base + i, sx: SRC_STA.x + 30, sy: SRC_STA.y, tx: c.x - 26, ty: c.y, color: STA_PKT, delay: i * 0.08,
      }));
    }
  }, []);

  const fire = useCallback(() => {
    setPackets(buildPackets(mode));
  }, [mode, buildPackets]);

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    fire();
    timerRef.current = setInterval(fire, 2200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, mode, fire]);

  const reset = () => { setPackets([]); setTick((t) => t + 1); setTimeout(fire, 60); };

  const switchMode = (m: Mode) => { setMode(m); setPackets([]); setTick((t) => t + 1); };

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">

      {/* ── Mode toggle ── */}
      <div className="flex border-b border-border">
        {(["ObserversRpc", "StaticRpc"] as Mode[]).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
              mode === m
                ? "bg-primary/15 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            {m}
          </button>
        ))}
      </div>

      {/* ── SVG stage ── */}
      <div className="p-4 pb-2">
        <svg viewBox="0 0 440 240" className="w-full">

          {/* ── Source node (Server / NetworkManager) ── */}
          <rect x={SRC_OBS.x - 32} y={SRC_OBS.y - 28} width={64} height={56} rx="8"
            fill={SERVER_COLOR + "18"} stroke={SERVER_COLOR} strokeWidth="1.8" />
          <AnimatePresence mode="wait">
            <motion.text key={mode} x={SRC_OBS.x} y={SRC_OBS.y - 8}
              textAnchor="middle" fontSize="8" fill={SERVER_COLOR} fontWeight="700"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              {mode === "ObserversRpc" ? "Server" : "Network"}
            </motion.text>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.text key={mode + "2"} x={SRC_OBS.x} y={SRC_OBS.y + 7}
              textAnchor="middle" fontSize="7" fill={SERVER_COLOR + "bb"}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              {mode === "ObserversRpc" ? "" : "Manager"}
            </motion.text>
          </AnimatePresence>

          {/* ── NetworkIdentity object (ObserversRpc only) ── */}
          <AnimatePresence>
            {mode === "ObserversRpc" && (
              <motion.g key="obj"
                initial={{ opacity: 0, scale: 0.6, originX: OBJ.x, originY: OBJ.y }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.35 }}>
                <rect x={OBJ.x - 38} y={OBJ.y - 24} width={76} height={48} rx="8"
                  fill={OBJECT_COLOR + "18"} stroke={OBJECT_COLOR} strokeWidth="1.8" />
                <text x={OBJ.x} y={OBJ.y - 7} textAnchor="middle" fontSize="7.5" fill={OBJECT_COLOR} fontWeight="700">Network</text>
                <text x={OBJ.x} y={OBJ.y + 6} textAnchor="middle" fontSize="7.5" fill={OBJECT_COLOR} fontWeight="700">Identity</text>
              </motion.g>
            )}
          </AnimatePresence>

          {/* ── "No NetworkIdentity required" label (StaticRpc) ── */}
          <AnimatePresence>
            {mode === "StaticRpc" && (
              <motion.text key="label" x={210} y={OBJ.y + 5}
                textAnchor="middle" fontSize="9" fill={STA_PKT} fontWeight="600"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}>
                No NetworkIdentity required
              </motion.text>
            )}
          </AnimatePresence>

          {/* ── Client nodes ── */}
          {CLIENTS.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="24"
                fill={CLIENT_COLOR + "18"} stroke={CLIENT_COLOR} strokeWidth="1.8" />
              <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="8" fill={CLIENT_COLOR} fontWeight="700">
                Client {String.fromCharCode(65 + i)}
              </text>
            </g>
          ))}

          {/* ── Static guide lines ── */}
          <AnimatePresence>
            {mode === "ObserversRpc" && (
              <motion.g key="obs-lines"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}>
                <line x1={SRC_OBS.x + 32} y1={SRC_OBS.y} x2={OBJ.x - 38} y2={OBJ.y}
                  stroke={OBS_PKT + "33"} strokeWidth="1.5" strokeDasharray="4 3" />
                {CLIENTS.map((c, i) => (
                  <line key={i} x1={OBJ.x + 38} y1={OBJ.y} x2={c.x - 24} y2={c.y}
                    stroke={OBS_PKT + "22"} strokeWidth="1" strokeDasharray="3 3" />
                ))}
              </motion.g>
            )}
            {mode === "StaticRpc" && (
              <motion.g key="sta-lines"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}>
                {CLIENTS.map((c, i) => (
                  <line key={i} x1={SRC_STA.x + 32} y1={SRC_STA.y} x2={c.x - 24} y2={c.y}
                    stroke={STA_PKT + "22"} strokeWidth="1" strokeDasharray="3 3" />
                ))}
              </motion.g>
            )}
          </AnimatePresence>

          {/* ── Packets ── */}
          <AnimatePresence>
            {packets.map((pkt) => (
              <motion.circle key={`${tick}-${pkt.id}`} r="6" fill={pkt.color}
                initial={{ cx: pkt.sx, cy: pkt.sy, opacity: 0, scale: 0.4 }}
                animate={{ cx: [pkt.sx, pkt.tx], cy: [pkt.sy, pkt.ty], opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 0.3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, delay: pkt.delay, ease: "easeInOut" }} />
            ))}
          </AnimatePresence>

          {/* ── Caption ── */}
          <text x="220" y="232" textAnchor="middle" fontSize="9.5" fill="hsl(270 40% 65%)" opacity="0.7">
            {mode === "ObserversRpc"
              ? "ObserversRpc: requires a NetworkIdentity object (two hops)"
              : "StaticRpc: NetworkManager broadcasts directly — no object needed"}
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
          <span className="text-muted-foreground">
            {mode === "ObserversRpc" ? "2 hops — object required" : "1 hop — no object required"}
          </span>
        </div>
      )}
    </div>
  );
}
