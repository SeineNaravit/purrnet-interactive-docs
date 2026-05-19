"use client";

/**
 * Visual model: A shared variable (e.g. health) lives on the server.
 * When its value changes, a "sync" pulse fans out to all clients.
 * ownerAuth=true shows that only the owner client can write; others are blocked.
 * sendInterval slider shows how frequently syncs are batched.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";

interface Props {
  variableName?: string;
  showControls?: boolean;
}

const CLIENTS = [
  { id: "server", label: "Server", x: 210, y: 30, color: "hsl(270 60% 65%)", isServer: true },
  { id: "clientA", label: "Client A (Owner)", x: 60, y: 150, color: "hsl(140 55% 55%)" },
  { id: "clientB", label: "Client B", x: 210, y: 190, color: "hsl(300 55% 65%)" },
  { id: "clientC", label: "Client C", x: 360, y: 150, color: "hsl(200 55% 65%)" },
];

export function SyncVarVisualizer({ variableName = "health", showControls = true }: Props) {
  const [value, setValue] = useState(100);
  const [ownerAuth, setOwnerAuth] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [sendInterval, setSendInterval] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerSync = () => {
    const next = Math.max(0, Math.min(100, value + (Math.random() > 0.5 ? -1 : 1) * Math.floor(5 + Math.random() * 20)));
    setValue(next);
    setSyncing(true);
    setTimeout(() => setSyncing(false), 800);
  };

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    const delay = 1500 + sendInterval * 100;
    intervalRef.current = setInterval(triggerSync, delay);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, value, sendInterval]);

  const healthPct = value / 100;
  const barColor = healthPct > 0.6 ? "hsl(140 55% 55%)" : healthPct > 0.3 ? "hsl(45 80% 55%)" : "hsl(10 70% 55%)";

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <code className="text-xs px-2 py-0.5 rounded bg-muted text-primary font-mono">SyncVar&lt;int&gt; {variableName}</code>
          <span className="text-xs text-muted-foreground">= {value}</span>
        </div>
        <div className="flex items-center gap-2">
          {ownerAuth && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">ownerAuth: true</span>}
        </div>
      </div>

      <div className="p-4">
        {/* Health bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{variableName}</span><span>{value}/100</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: barColor }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Network diagram */}
        <svg viewBox="0 0 440 230" className="w-full">
          {/* Lines from server to clients */}
          {CLIENTS.filter(c => !c.isServer).map(c => (
            <line key={c.id} x1={210} y1={50} x2={c.x} y2={c.y}
              stroke="hsl(270 30% 55% / 0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
          ))}

          {/* Sync pulses */}
          <AnimatePresence>
            {syncing && CLIENTS.filter(c => !c.isServer).map((c, i) => (
              <motion.circle
                key={`pulse-${c.id}`}
                r="6" fill="hsl(270 60% 65%)"
                initial={{ cx: 210, cy: 50, opacity: 0, scale: 0.5 }}
                animate={{ cx: c.x, cy: c.y, opacity: [0, 1, 0.8, 0], scale: [0.5, 1.2, 1, 0.6] }}
                exit={{}}
                transition={{ duration: 0.65, delay: i * 0.08, ease: "easeOut" }}
              />
            ))}
          </AnimatePresence>

          {/* Nodes */}
          {CLIENTS.map(c => (
            <g key={c.id}>
              <circle cx={c.x} cy={c.y} r={c.isServer ? 28 : 24}
                fill={c.color + "15"} stroke={c.color} strokeWidth="1.8" />
              <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="8" fill={c.color} fontWeight="700">
                {c.label}
              </text>
              {!c.isServer && (
                <text x={c.x} y={c.y + 15} textAnchor="middle" fontSize="8" fill="hsl(270 60% 65%)" opacity="0.7">
                  {value}
                </text>
              )}
              {ownerAuth && c.id === "clientC" && (
                <text x={c.x} y={c.y + 26} textAnchor="middle" fontSize="7" fill="hsl(10 70% 55%)">🔒 read-only</text>
              )}
            </g>
          ))}

          {syncing && (
            <motion.text x="210" y="225" textAnchor="middle" fontSize="9" fill="hsl(270 60% 65%)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Syncing {variableName} = {value}
            </motion.text>
          )}
        </svg>
      </div>

      {showControls && (
        <div className="px-4 pb-4 flex flex-wrap items-center gap-3 text-xs border-t border-border pt-3">
          <button onClick={() => setPlaying(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={triggerSync}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground font-medium">
            Force Sync
          </button>
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={ownerAuth} onChange={e => setOwnerAuth(e.target.checked)} className="accent-primary" />
            ownerAuth
          </label>
          <label className="flex items-center gap-2 text-muted-foreground">
            Interval
            <input type="range" min={0} max={20} value={sendInterval} onChange={e => setSendInterval(+e.target.value)} className="w-20 accent-primary" />
            <span className="font-mono text-foreground w-10">{sendInterval === 0 ? "every tick" : `${sendInterval * 100}ms`}</span>
          </label>
        </div>
      )}
    </div>
  );
}
