"use client";

/**
 * Visual model: Broadcast packet vs RPC.
 * Left scene: packet tied to a NetworkIdentity object (RPC).
 * Right scene: broadcast from manager directly to all connections, no object required.
 * Animated packets flow in both scenes simultaneously.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

const CONN_COLOR = "hsl(200 60% 65%)";
const RPC_COLOR  = "hsl(270 60% 65%)";
const BC_COLOR   = "hsl(45 80% 60%)";
const OBJ_COLOR  = "hsl(300 55% 65%)";

// Left scene: RPC via NetworkIdentity
// Server(220,40) → Object(220,120) → Client A(70,190) + Client B(370,190)
const LEFT = {
  server:  { x: 110, y: 30 },
  object:  { x: 110, y: 100 },
  clientA: { x: 30,  y: 180 },
  clientB: { x: 190, y: 180 },
};

// Right scene: Broadcast — Manager(330,40) → Client A(260,180) + Client B(400,180)
const RIGHT = {
  manager: { x: 330, y: 30 },
  clientA: { x: 250, y: 180 },
  clientB: { x: 410, y: 180 },
};

interface Pkt { id: string; x1: number; y1: number; x2: number; y2: number; color: string; delay: number }

function buildPackets(tick: number, duration: number): Pkt[] {
  const pkts: Pkt[] = [];
  // Left: server → object → clients (two hops)
  pkts.push({ id: `${tick}-l0`, x1: LEFT.server.x, y1: LEFT.server.y, x2: LEFT.object.x, y2: LEFT.object.y, color: RPC_COLOR, delay: 0 });
  pkts.push({ id: `${tick}-l1`, x1: LEFT.object.x, y1: LEFT.object.y, x2: LEFT.clientA.x, y2: LEFT.clientA.y, color: RPC_COLOR, delay: duration });
  pkts.push({ id: `${tick}-l2`, x1: LEFT.object.x, y1: LEFT.object.y, x2: LEFT.clientB.x, y2: LEFT.clientB.y, color: RPC_COLOR, delay: duration + 0.08 });
  // Right: manager → clients directly (one hop)
  pkts.push({ id: `${tick}-r0`, x1: RIGHT.manager.x, y1: RIGHT.manager.y, x2: RIGHT.clientA.x, y2: RIGHT.clientA.y, color: BC_COLOR, delay: 0 });
  pkts.push({ id: `${tick}-r1`, x1: RIGHT.manager.x, y1: RIGHT.manager.y, x2: RIGHT.clientB.x, y2: RIGHT.clientB.y, color: BC_COLOR, delay: 0.08 });
  return pkts;
}

export function BroadcastVisualizer() {
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 0.65;
  const CYCLE = (DURATION * 2 + 1.4) * 1000;

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setTick((t) => t + 1), CYCLE);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, CYCLE]);

  const reset = () => { setTick(0); setTimeout(() => setTick(1), 40); };
  const packets = buildPackets(tick, DURATION);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      {/* Header tabs */}
      <div className="grid grid-cols-2 border-b border-border text-xs font-semibold">
        <div className="px-4 py-2.5 border-r border-border text-center" style={{ color: RPC_COLOR }}>
          ObserversRpc (via NetworkIdentity)
        </div>
        <div className="px-4 py-2.5 text-center" style={{ color: BC_COLOR }}>
          Broadcast (connection-level)
        </div>
      </div>

      <div className="p-4">
        <svg viewBox="0 0 440 220" className="w-full">
          {/* Divider */}
          <line x1="220" y1="0" x2="220" y2="220" stroke="hsl(270 20% 35% / 0.4)" strokeWidth="1" strokeDasharray="4 3" />

          {/* === LEFT SCENE === */}
          {/* Lines */}
          <line x1={LEFT.server.x} y1={LEFT.server.y} x2={LEFT.object.x} y2={LEFT.object.y}
            stroke={RPC_COLOR + "30"} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1={LEFT.object.x} y1={LEFT.object.y} x2={LEFT.clientA.x} y2={LEFT.clientA.y}
            stroke={RPC_COLOR + "30"} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1={LEFT.object.x} y1={LEFT.object.y} x2={LEFT.clientB.x} y2={LEFT.clientB.y}
            stroke={RPC_COLOR + "30"} strokeWidth="1.5" strokeDasharray="4 3" />

          {/* Server node */}
          <circle cx={LEFT.server.x} cy={LEFT.server.y} r="22"
            fill={RPC_COLOR + "15"} stroke={RPC_COLOR} strokeWidth="1.8" />
          <text x={LEFT.server.x} y={LEFT.server.y + 4} textAnchor="middle" fontSize="8" fill={RPC_COLOR} fontWeight="700">Server</text>

          {/* NetworkIdentity object */}
          <rect x={LEFT.object.x - 26} y={LEFT.object.y - 16} width="52" height="32" rx="6"
            fill={OBJ_COLOR + "18"} stroke={OBJ_COLOR} strokeWidth="1.8" />
          <text x={LEFT.object.x} y={LEFT.object.y - 3} textAnchor="middle" fontSize="7.5" fill={OBJ_COLOR} fontWeight="700">Network</text>
          <text x={LEFT.object.x} y={LEFT.object.y + 9} textAnchor="middle" fontSize="7.5" fill={OBJ_COLOR} fontWeight="600">Identity</text>

          {/* Left clients */}
          {[LEFT.clientA, LEFT.clientB].map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="20" fill={CONN_COLOR + "15"} stroke={CONN_COLOR} strokeWidth="1.5" />
              <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="8" fill={CONN_COLOR} fontWeight="600">
                Client {i === 0 ? "A" : "B"}
              </text>
            </g>
          ))}

          {/* Left label */}
          <text x="110" y="215" textAnchor="middle" fontSize="8.5" fill={RPC_COLOR} opacity="0.7">
            2 hops: Server → Object → Clients
          </text>

          {/* === RIGHT SCENE === */}
          {/* Lines */}
          <line x1={RIGHT.manager.x} y1={RIGHT.manager.y} x2={RIGHT.clientA.x} y2={RIGHT.clientA.y}
            stroke={BC_COLOR + "30"} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1={RIGHT.manager.x} y1={RIGHT.manager.y} x2={RIGHT.clientB.x} y2={RIGHT.clientB.y}
            stroke={BC_COLOR + "30"} strokeWidth="1.5" strokeDasharray="4 3" />

          {/* Manager (no NetworkIdentity needed) */}
          <circle cx={RIGHT.manager.x} cy={RIGHT.manager.y} r="22"
            fill={BC_COLOR + "15"} stroke={BC_COLOR} strokeWidth="1.8" />
          <text x={RIGHT.manager.x} y={RIGHT.manager.y + 4} textAnchor="middle" fontSize="8" fill={BC_COLOR} fontWeight="700">Manager</text>

          {/* Right clients */}
          {[RIGHT.clientA, RIGHT.clientB].map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="20" fill={CONN_COLOR + "15"} stroke={CONN_COLOR} strokeWidth="1.5" />
              <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="8" fill={CONN_COLOR} fontWeight="600">
                Client {i === 0 ? "A" : "B"}
              </text>
            </g>
          ))}

          {/* Right label */}
          <text x="330" y="215" textAnchor="middle" fontSize="8.5" fill={BC_COLOR} opacity="0.7">
            1 hop: Manager → Connections directly
          </text>

          {/* Animated packets */}
          <AnimatePresence mode="sync">
            {packets.map((pkt) => (
              <motion.circle
                key={pkt.id}
                r="6"
                fill={pkt.color}
                initial={{ cx: pkt.x1, cy: pkt.y1, opacity: 0, scale: 0.4 }}
                animate={{
                  cx: [pkt.x1, pkt.x2],
                  cy: [pkt.y1, pkt.y2],
                  opacity: [0, 1, 1, 0],
                  scale: [0.4, 1.2, 1, 0.5],
                }}
                exit={{}}
                transition={{ duration: DURATION, delay: pkt.delay, ease: "easeInOut" }}
              />
            ))}
          </AnimatePresence>
        </svg>
      </div>

      {/* Key differences */}
      <div className="mx-4 mb-4 grid grid-cols-2 gap-3 text-[10px]">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="font-semibold mb-1" style={{ color: RPC_COLOR }}>RPC (ObserversRpc)</div>
          <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
            <li>Requires a NetworkIdentity on the object</li>
            <li>Only observers of that object receive it</li>
            <li>Cannot be sent before spawn</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="font-semibold mb-1" style={{ color: BC_COLOR }}>Broadcast</div>
          <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
            <li>No NetworkIdentity required</li>
            <li>Sent on the connection channel directly</li>
            <li>Works before any object is spawned</li>
          </ul>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 flex items-center gap-3 text-xs border-t border-border pt-3">
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
      </div>
    </div>
  );
}
