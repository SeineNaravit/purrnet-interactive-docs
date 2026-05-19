"use client";

/**
 * Visual model: Three nodes (Client A, Server, Client B/All Clients).
 * A "packet" dot animates along the path according to RPC type:
 *   ServerRpc   → Client A → Server
 *   ObserversRpc→ Server   → Client A + Client B (fan-out)
 *   TargetRpc   → Server   → Client B (single arrow)
 * Latency slider stretches the animation duration.
 * runLocally option also flashes Client A immediately when true.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

type RpcType = "ServerRpc" | "ObserversRpc" | "TargetRpc";

interface Props {
  defaultType?: RpcType;
  showControls?: boolean;
}

const NODE = {
  clientA: { x: 60,  y: 130, label: "Client A", color: "hsl(300 60% 65%)" },
  server:  { x: 220, y: 40,  label: "Server",   color: "hsl(270 60% 65%)" },
  clientB: { x: 380, y: 130, label: "Client B",  color: "hsl(300 60% 65%)" },
};

interface Packet { id: number; from: keyof typeof NODE; to: keyof typeof NODE; delay: number; color: string }

function buildPackets(type: RpcType, latency: number, runLocally: boolean): Packet[] {
  const base = latency / 1000;
  const pkts: Packet[] = [];
  let id = 0;
  if (type === "ServerRpc") {
    pkts.push({ id: id++, from: "clientA", to: "server", delay: 0, color: "hsl(300 60% 65%)" });
    if (runLocally) pkts.push({ id: id++, from: "clientA", to: "clientA", delay: 0, color: "hsl(120 60% 55%)" });
  }
  if (type === "ObserversRpc") {
    pkts.push({ id: id++, from: "server", to: "clientA", delay: 0, color: "hsl(270 60% 65%)" });
    pkts.push({ id: id++, from: "server", to: "clientB", delay: 0.1, color: "hsl(270 60% 65%)" });
  }
  if (type === "TargetRpc") {
    pkts.push({ id: id++, from: "server", to: "clientB", delay: 0, color: "hsl(270 60% 65%)" });
  }
  return pkts;
}

export function RpcFlowVisualizer({ defaultType = "ServerRpc", showControls = true }: Props) {
  const [rpcType, setRpcType] = useState<RpcType>(defaultType);
  const [latency, setLatency] = useState(150);
  const [runLocally, setRunLocally] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const packets = buildPackets(rpcType, latency, runLocally);
  const duration = 0.6 + (latency / 500) * 1.2;

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setTick((t) => t + 1), (duration + 1.2) * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, duration, rpcType, latency, runLocally]);

  const reset = () => { setTick(0); setTimeout(() => setTick(1), 50); };

  const getPos = (key: keyof typeof NODE) => ({ x: NODE[key].x, y: NODE[key].y });

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      {/* RPC type tabs */}
      <div className="flex border-b border-border">
        {(["ServerRpc", "ObserversRpc", "TargetRpc"] as RpcType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setRpcType(t); reset(); }}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
              rpcType === t ? "bg-primary/15 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* SVG stage */}
      <div className="p-4 pb-2">
        <svg viewBox="0 0 440 200" className="w-full">
          {/* Static lines */}
          <line x1={NODE.clientA.x} y1={NODE.clientA.y} x2={NODE.server.x} y2={NODE.server.y}
            stroke="hsl(270 30% 55% / 0.25)" strokeWidth="1.5" strokeDasharray="5 3" />
          <line x1={NODE.server.x} y1={NODE.server.y} x2={NODE.clientB.x} y2={NODE.clientB.y}
            stroke="hsl(270 30% 55% / 0.25)" strokeWidth="1.5" strokeDasharray="5 3" />

          {/* Nodes */}
          {Object.entries(NODE).map(([key, n]) => (
            <g key={key}>
              <circle cx={n.x} cy={n.y} r="26" fill={n.color + "18"} stroke={n.color} strokeWidth="1.8" />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="9" fill={n.color} fontWeight="700">{n.label}</text>
            </g>
          ))}

          {/* Packets */}
          <AnimatePresence mode="wait">
            {packets.map((pkt) => {
              const from = getPos(pkt.from);
              const to = pkt.from === pkt.to
                ? { x: from.x + 40, y: from.y - 25 }
                : getPos(pkt.to);
              return (
                <motion.circle
                  key={`${tick}-${pkt.id}`}
                  r="7" fill={pkt.color}
                  initial={{ cx: from.x, cy: from.y, opacity: 0, scale: 0.5 }}
                  animate={{
                    cx: [from.x, to.x],
                    cy: [from.y, to.y],
                    opacity: [0, 1, 1, 0],
                    scale: [0.5, 1.2, 1, 0.5],
                  }}
                  transition={{ duration, delay: pkt.delay, ease: "easeInOut" }}
                />
              );
            })}
          </AnimatePresence>

          {/* Labels */}
          <text x="220" y="195" textAnchor="middle" fontSize="10" fill="hsl(270 40% 65%)" opacity="0.7">
            {rpcType === "ServerRpc" ? "Client → Server execution" :
             rpcType === "ObserversRpc" ? "Server → All observing clients" :
             "Server → Single target client"}
          </text>
        </svg>
      </div>

      {/* Controls */}
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
          <label className="flex items-center gap-2 text-muted-foreground">
            Latency
            <input type="range" min={0} max={400} value={latency} onChange={(e) => { setLatency(+e.target.value); reset(); }} className="w-24 accent-primary" />
            <span className="font-mono text-foreground w-14">{latency} ms</span>
          </label>
          {rpcType === "ServerRpc" && (
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={runLocally} onChange={(e) => { setRunLocally(e.target.checked); reset(); }} className="accent-primary" />
              RunLocally
            </label>
          )}
        </div>
      )}
    </div>
  );
}
