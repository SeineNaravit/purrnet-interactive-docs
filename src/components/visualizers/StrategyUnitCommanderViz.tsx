"use client";

// Visual concept: RTS unit command flow showing how commands travel from
// player → ServerRpc → server → individual unit components.
// Left: 5×4 grid map with 4 coloured unit tokens. Click to select (multi).
// Right: command buttons send an animated "Command Packet" badge that flies
// upward from selected units, and appends to a rolling command log below.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Move, Crosshair, Navigation, Zap } from "lucide-react";

const COLS = 5;
const ROWS = 4;
const CELL = 36;

type UnitId = "U1" | "U2" | "U3" | "U4";

interface Unit {
  id: UnitId;
  col: number;
  row: number;
  color: string;
  ring: string;
  hp: number;
}

const INITIAL_UNITS: Unit[] = [
  { id: "U1", col: 1, row: 1, color: "#ef4444", ring: "#fca5a5", hp: 80 },
  { id: "U2", col: 3, row: 1, color: "#3b82f6", ring: "#93c5fd", hp: 100 },
  { id: "U3", col: 1, row: 3, color: "#22c55e", ring: "#86efac", hp: 60 },
  { id: "U4", col: 4, row: 2, color: "#eab308", ring: "#fde047", hp: 90 },
];

const COMMANDS = [
  { label: "Move",   icon: Move,      color: "bg-blue-700 hover:bg-blue-600 text-blue-100" },
  { label: "Attack", icon: Crosshair, color: "bg-red-700 hover:bg-red-600 text-red-100" },
  { label: "Patrol", icon: Navigation,color: "bg-green-700 hover:bg-green-600 text-green-100" },
  { label: "Skill",  icon: Zap,       color: "bg-yellow-700 hover:bg-yellow-600 text-yellow-100" },
];

interface Packet { id: number; label: string }

export function StrategyUnitCommanderViz() {
  const [selected, setSelected] = useState<Set<UnitId>>(new Set());
  const [packets, setPackets] = useState<Packet[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [nextId, setNextId] = useState(0);

  const toggleUnit = (id: UnitId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sendCommand = (cmd: string) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(", ");
    const pid = nextId;
    setNextId((n) => n + 1);
    setPackets((p) => [...p, { id: pid, label: cmd }]);
    setLog((l) => [`${ids} → ${cmd} command sent`, ...l].slice(0, 3));
    setTimeout(() => setPackets((p) => p.filter((x) => x.id !== pid)), 1500);
  };

  const mapW = COLS * CELL;
  const mapH = ROWS * CELL;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 select-none">
      <div className="flex gap-4 flex-wrap">
        {/* Map */}
        <div className="relative flex-shrink-0" style={{ width: mapW, height: mapH }}>
          {/* Grid cells */}
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: COLS }).map((_, c) => (
              <div
                key={`${r}-${c}`}
                className="absolute border border-slate-700 bg-slate-800"
                style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
              />
            ))
          )}

          {/* Units */}
          {INITIAL_UNITS.map((u) => {
            const isSel = selected.has(u.id);
            const cx = u.col * CELL + CELL / 2;
            const cy = u.row * CELL + CELL / 2;
            return (
              <div key={u.id}>
                {/* Unit token */}
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleUnit(u.id)}
                  className="absolute cursor-pointer"
                  style={{
                    left: cx - 14,
                    top: cy - 14,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: u.color,
                    border: isSel ? `2.5px solid ${u.ring}` : "2px solid transparent",
                    boxShadow: isSel ? `0 0 8px ${u.ring}` : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "white",
                    zIndex: 2,
                  }}
                >
                  {u.id}
                </motion.div>

                {/* HP bar */}
                <div
                  className="absolute"
                  style={{ left: cx - 14, top: cy + 16, width: 28, height: 3, background: "#334155", borderRadius: 2 }}
                >
                  <div style={{ width: `${u.hp}%`, height: "100%", background: u.color, borderRadius: 2 }} />
                </div>

                {/* Packet animation — fires from unit toward top-center of map */}
                <AnimatePresence>
                  {packets.map((pkt) =>
                    isSel ? (
                      <motion.div
                        key={pkt.id}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 0.8 }}
                        animate={{ x: mapW / 2 - cx, y: -(cy + 30), opacity: 0, scale: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="absolute pointer-events-none z-10 text-[9px] font-mono text-white bg-slate-600 rounded px-1 py-0.5 whitespace-nowrap"
                        style={{ left: cx - 14, top: cy - 14 }}
                      >
                        ServerRpc → {pkt.label}
                      </motion.div>
                    ) : null
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Command panel */}
        <div className="flex flex-col gap-2 justify-start pt-1">
          <div className="text-xs text-slate-400 font-mono mb-1">
            {selected.size === 0 ? "Select a unit" : `${selected.size} unit(s) selected`}
          </div>
          {COMMANDS.map(({ label, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => sendCommand(label)}
              disabled={selected.size === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${color} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 space-y-1 min-h-[56px]">
        <div className="text-xs text-slate-500 font-mono mb-1">Command Log</div>
        <AnimatePresence initial={false}>
          {log.map((entry, i) => (
            <motion.div
              key={entry + i}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-mono text-slate-300"
            >
              {entry}
            </motion.div>
          ))}
        </AnimatePresence>
        {log.length === 0 && <div className="text-xs text-slate-600 font-mono">No commands yet.</div>}
      </div>
    </div>
  );
}
