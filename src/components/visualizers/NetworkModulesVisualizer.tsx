"use client";

/**
 * Visual model:
 * - Center-left: A "Player (NetworkBehaviour)" box (purple).
 * - Attached to it via lines: 3 module boxes —
 *     HealthModule (rose), StaminaModule (amber), AbilityModule (blue).
 *   Each module shows a small live value (bar / number / countdown).
 * - Right side: "Client A" and "Client B" nodes.
 * - Every ~1.5 s one module "fires": it glows, a colored packet flies from
 *   that module to each client, and the client node briefly flashes the
 *   updated value.
 * - Controls: Play / Pause. Caption: "Each module syncs its slice of state independently".
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";

const PLAYER_COLOR = "hsl(270 60% 65%)";
const HEALTH_COLOR = "hsl(10 70% 60%)";
const STAMINA_COLOR = "hsl(45 80% 60%)";
const ABILITY_COLOR = "hsl(210 65% 60%)";
const CLIENT_COLOR = "hsl(200 55% 65%)";

type ModuleKey = "health" | "stamina" | "ability";

interface ModuleDef {
  key: ModuleKey;
  label: string;
  color: string;
  unit: string;
}

const MODULES: ModuleDef[] = [
  { key: "health",  label: "HealthModule",  color: HEALTH_COLOR,  unit: "hp"  },
  { key: "stamina", label: "StaminaModule", color: STAMINA_COLOR, unit: "%"   },
  { key: "ability", label: "AbilityModule", color: ABILITY_COLOR, unit: "s cd" },
];

function randomValue(key: ModuleKey) {
  if (key === "health")  return Math.floor(Math.random() * 100);
  if (key === "stamina") return Math.floor(Math.random() * 100);
  return Math.floor(Math.random() * 8) + 1;
}

interface Packet { id: number; moduleKey: ModuleKey; color: string; target: "A" | "B"; delay: number }

export function NetworkModulesVisualizer({ showControls = true }: { showControls?: boolean }) {
  const [playing, setPlaying]         = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
  const [packets, setPackets]         = useState<Packet[]>([]);
  const [values, setValues]           = useState<Record<ModuleKey, number>>({ health: 80, stamina: 55, ability: 3 });
  const [clientFlash, setClientFlash] = useState<{ A: string | null; B: string | null }>({ A: null, B: null });
  const tickRef  = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fire = useCallback(() => {
    const mod = MODULES[Math.floor(Math.random() * 3)];
    const newVal = randomValue(mod.key);
    setValues((v) => ({ ...v, [mod.key]: newVal }));
    setActiveModule(mod.key);
    const id = ++tickRef.current;
    setPackets([
      { id: id * 10 + 0, moduleKey: mod.key, color: mod.color, target: "A", delay: 0   },
      { id: id * 10 + 1, moduleKey: mod.key, color: mod.color, target: "B", delay: 0.15 },
    ]);
    setTimeout(() => {
      setClientFlash({ A: mod.color, B: mod.color });
      setTimeout(() => setClientFlash({ A: null, B: null }), 600);
    }, 900);
    setTimeout(() => setActiveModule(null), 700);
  }, []);

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    fire();
    timerRef.current = setInterval(fire, 2000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, fire]);

  // SVG coordinate constants
  const PX = 110; const PY = 130;               // Player centre
  const modY  = [70, 130, 190];                  // module Y positions (left column)
  const modX  = 240;
  const clAX  = 390; const clAY = 95;
  const clBX  = 390; const clBY = 175;

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 pt-4">
        <svg viewBox="0 0 480 260" className="w-full">
          {/* ── connection lines: Player → modules ── */}
          {MODULES.map((m, i) => (
            <line key={m.key}
              x1={PX + 38} y1={PY + (modY[i] - PY) * 0.3}
              x2={modX - 46} y2={modY[i]}
              stroke={m.color + "44"} strokeWidth="1.5" strokeDasharray="4 3" />
          ))}

          {/* ── connection lines: modules → clients ── */}
          {MODULES.map((m, i) => (
            <g key={m.key + "-to-clients"}>
              <line x1={modX + 46} y1={modY[i]} x2={clAX - 26} y2={clAY}
                stroke={m.color + "22"} strokeWidth="1" strokeDasharray="3 3" />
              <line x1={modX + 46} y1={modY[i]} x2={clBX - 26} y2={clBY}
                stroke={m.color + "22"} strokeWidth="1" strokeDasharray="3 3" />
            </g>
          ))}

          {/* ── Player node ── */}
          <rect x={PX - 42} y={PY - 28} width={84} height={56} rx="8"
            fill={PLAYER_COLOR + "18"} stroke={PLAYER_COLOR} strokeWidth="1.8" />
          <text x={PX} y={PY - 8} textAnchor="middle" fontSize="8" fill={PLAYER_COLOR} fontWeight="700">Player</text>
          <text x={PX} y={PY + 6} textAnchor="middle" fontSize="7" fill={PLAYER_COLOR + "bb"}>NetworkBehaviour</text>

          {/* ── Module nodes ── */}
          {MODULES.map((m, i) => {
            const active = activeModule === m.key;
            return (
              <g key={m.key}>
                <motion.rect
                  x={modX - 46} y={modY[i] - 22} width={92} height={44} rx="7"
                  fill={m.color + (active ? "30" : "14")}
                  stroke={m.color}
                  strokeWidth={active ? 2.2 : 1.5}
                  animate={{ filter: active ? `drop-shadow(0 0 6px ${m.color})` : "none" }}
                  transition={{ duration: 0.25 }}
                />
                <text x={modX} y={modY[i] - 6} textAnchor="middle" fontSize="8" fill={m.color} fontWeight="700">{m.label}</text>
                <text x={modX} y={modY[i] + 8} textAnchor="middle" fontSize="9" fill={m.color + "dd"} fontWeight="600">
                  {values[m.key]}{m.unit}
                </text>
              </g>
            );
          })}

          {/* ── Client A ── */}
          <motion.circle cx={clAX} cy={clAY} r="26"
            fill={clientFlash.A ? clientFlash.A + "30" : CLIENT_COLOR + "18"}
            stroke={clientFlash.A ?? CLIENT_COLOR} strokeWidth="1.8"
            animate={{ scale: clientFlash.A ? 1.1 : 1 }} transition={{ duration: 0.2 }} />
          <text x={clAX} y={clAY + 4} textAnchor="middle" fontSize="9" fill={CLIENT_COLOR} fontWeight="700">Client A</text>

          {/* ── Client B ── */}
          <motion.circle cx={clBX} cy={clBY} r="26"
            fill={clientFlash.B ? clientFlash.B + "30" : CLIENT_COLOR + "18"}
            stroke={clientFlash.B ?? CLIENT_COLOR} strokeWidth="1.8"
            animate={{ scale: clientFlash.B ? 1.1 : 1 }} transition={{ duration: 0.2 }} />
          <text x={clBX} y={clBY + 4} textAnchor="middle" fontSize="9" fill={CLIENT_COLOR} fontWeight="700">Client B</text>

          {/* ── Packets ── */}
          <AnimatePresence>
            {packets.map((pkt) => {
              const mi = MODULES.findIndex((m) => m.key === pkt.moduleKey);
              const sx = modX + 46; const sy = modY[mi];
              const tx = pkt.target === "A" ? clAX - 26 : clBX - 26;
              const ty = pkt.target === "A" ? clAY : clBY;
              return (
                <motion.circle key={pkt.id} r="6" fill={pkt.color}
                  initial={{ cx: sx, cy: sy, opacity: 0, scale: 0.4 }}
                  animate={{ cx: [sx, tx], cy: [sy, ty], opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 0.3] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, delay: pkt.delay, ease: "easeInOut" }} />
              );
            })}
          </AnimatePresence>

          {/* ── Caption ── */}
          <text x="240" y="252" textAnchor="middle" fontSize="9.5" fill="hsl(270 40% 65%)" opacity="0.7">
            Each module syncs its slice of state independently
          </text>
        </svg>
      </div>

      {showControls && (
        <div className="px-4 pb-4 flex items-center gap-3 text-xs">
          <button onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <span className="text-muted-foreground">3 modules — each syncs independently</span>
        </div>
      )}
    </div>
  );
}
