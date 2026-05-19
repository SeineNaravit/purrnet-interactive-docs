"use client";

/**
 * Visual model: Authentication handshake flow.
 * Three nodes: Client, Server, Game
 * Animated steps: Client sends credentials → Server validates → Server accepts/denies
 * → If accepted, client joins game
 * A toggle switches between "Accept" and "Deny" modes.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ShieldCheck, ShieldX } from "lucide-react";

type Mode = "accept" | "deny";

interface Step {
  id: number;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  delay: number;
}

const NODES = {
  client: { x: 70,  y: 120, label: "Client",  color: "hsl(200 60% 65%)" },
  server: { x: 220, y: 40,  label: "Server",  color: "hsl(270 60% 65%)" },
  game:   { x: 370, y: 120, label: "Game",    color: "hsl(140 55% 55%)" },
};

function buildSteps(mode: Mode, duration: number): Step[] {
  const steps: Step[] = [
    {
      id: 0,
      label: "Send credentials",
      from: NODES.client,
      to: NODES.server,
      color: "hsl(200 60% 65%)",
      delay: 0,
    },
    {
      id: 1,
      label: "Validate payload",
      from: NODES.server,
      to: NODES.server,
      color: "hsl(270 60% 65%)",
      delay: duration + 0.2,
    },
  ];

  if (mode === "accept") {
    steps.push({
      id: 2,
      label: "Accept connection",
      from: NODES.server,
      to: NODES.client,
      color: "hsl(140 55% 55%)",
      delay: duration * 2 + 0.4,
    });
    steps.push({
      id: 3,
      label: "Join game",
      from: NODES.client,
      to: NODES.game,
      color: "hsl(140 55% 55%)",
      delay: duration * 3 + 0.6,
    });
  } else {
    steps.push({
      id: 2,
      label: "Deny connection",
      from: NODES.server,
      to: NODES.client,
      color: "hsl(10 70% 60%)",
      delay: duration * 2 + 0.4,
    });
  }
  return steps;
}

export function AuthFlowVisualizer() {
  const [mode, setMode] = useState<Mode>("accept");
  const [tick, setTick] = useState(0);
  const [activeSteps, setActiveSteps] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PACKET_DURATION = 0.7;
  const steps = buildSteps(mode, PACKET_DURATION);

  const replay = () => {
    setActiveSteps([]);
    setDone(false);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    setActiveSteps([]);
    setDone(false);
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step) => {
      const t = setTimeout(() => {
        setActiveSteps((prev) => [...prev, step.id]);
      }, step.delay * 1000);
      timeouts.push(t);
    });

    const finalDelay = (steps[steps.length - 1].delay + PACKET_DURATION + 0.5) * 1000;
    const doneTimer = setTimeout(() => setDone(true), finalDelay);
    timeouts.push(doneTimer);

    return () => timeouts.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mode]);

  const accepted = mode === "accept";

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      {/* Mode tabs */}
      <div className="flex border-b border-border">
        {(["accept", "deny"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); replay(); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
              mode === m
                ? m === "accept"
                  ? "bg-emerald-500/15 text-emerald-400 border-b-2 border-emerald-400"
                  : "bg-red-500/15 text-red-400 border-b-2 border-red-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "accept" ? <ShieldCheck className="size-3.5" /> : <ShieldX className="size-3.5" />}
            {m === "accept" ? "Accept" : "Deny"}
          </button>
        ))}
      </div>

      {/* Stage */}
      <div className="p-4">
        <svg viewBox="0 0 440 200" className="w-full">
          {/* Static connection lines */}
          <line x1={NODES.client.x} y1={NODES.client.y} x2={NODES.server.x} y2={NODES.server.y}
            stroke="hsl(270 30% 55% / 0.2)" strokeWidth="1.5" strokeDasharray="5 3" />
          <line x1={NODES.server.x} y1={NODES.server.y} x2={NODES.game.x} y2={NODES.game.y}
            stroke="hsl(270 30% 55% / 0.2)" strokeWidth="1.5" strokeDasharray="5 3" />
          <line x1={NODES.client.x} y1={NODES.client.y} x2={NODES.game.x} y2={NODES.game.y}
            stroke="hsl(270 30% 55% / 0.12)" strokeWidth="1.5" strokeDasharray="5 3" />

          {/* Nodes */}
          {Object.entries(NODES).map(([key, n]) => {
            const isGame = key === "game";
            const isActive = done && accepted && isGame;
            const isDenied = done && !accepted && key === "client";
            return (
              <g key={key}>
                <motion.circle
                  cx={n.x} cy={n.y} r="28"
                  fill={n.color + "15"}
                  stroke={isActive ? "hsl(140 55% 55%)" : isDenied ? "hsl(10 70% 60%)" : n.color}
                  strokeWidth={isActive || isDenied ? "2.5" : "1.8"}
                  animate={isActive ? { opacity: [0.6, 1, 0.6] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="9" fill={n.color} fontWeight="700">
                  {n.label}
                </text>
              </g>
            );
          })}

          {/* Animated packets */}
          <AnimatePresence mode="sync">
            {steps.map((step) => {
              if (!activeSteps.includes(step.id)) return null;
              // "validate" step is a pulse on server node, not a traveling packet
              if (step.from === NODES.server && step.to === NODES.server) return null;
              return (
                <motion.circle
                  key={`${tick}-${step.id}`}
                  r="7"
                  fill={step.color}
                  initial={{ cx: step.from.x, cy: step.from.y, opacity: 0, scale: 0.4 }}
                  animate={{
                    cx: [step.from.x, step.to.x],
                    cy: [step.from.y, step.to.y],
                    opacity: [0, 1, 1, 0],
                    scale: [0.4, 1.2, 1, 0.5],
                  }}
                  exit={{}}
                  transition={{ duration: PACKET_DURATION, ease: "easeInOut" }}
                />
              );
            })}
          </AnimatePresence>

          {/* Server validation pulse */}
          <AnimatePresence>
            {activeSteps.includes(1) && (
              <motion.circle
                key={`${tick}-validate`}
                cx={NODES.server.x} cy={NODES.server.y} r="28"
                fill="transparent"
                stroke="hsl(270 60% 65%)"
                strokeWidth="3"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.4, 1.4], opacity: [0, 0.7, 0] }}
                exit={{}}
                transition={{ duration: 0.7 }}
              />
            )}
          </AnimatePresence>

          {/* Step labels */}
          <AnimatePresence>
            {steps.map((step) => {
              if (!activeSteps.includes(step.id)) return null;
              if (step.from === NODES.server && step.to === NODES.server) {
                return (
                  <motion.text
                    key={`${tick}-label-${step.id}`}
                    x={NODES.server.x} y={NODES.server.y - 38}
                    textAnchor="middle" fontSize="8.5" fill="hsl(270 60% 75%)" fontWeight="600"
                    initial={{ opacity: 0, y: NODES.server.y - 30 }}
                    animate={{ opacity: 1, y: NODES.server.y - 38 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {step.label}
                  </motion.text>
                );
              }
              const midX = (step.from.x + step.to.x) / 2;
              const midY = (step.from.y + step.to.y) / 2 - 14;
              return (
                <motion.text
                  key={`${tick}-label-${step.id}`}
                  x={midX} y={midY}
                  textAnchor="middle" fontSize="8.5" fill={step.color} fontWeight="600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {step.label}
                </motion.text>
              );
            })}
          </AnimatePresence>

          {/* Final result badge */}
          <AnimatePresence>
            {done && (
              <motion.g key={`${tick}-result`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <rect x="150" y="150" width="140" height="26" rx="8"
                  fill={accepted ? "hsl(140 55% 55% / 0.2)" : "hsl(10 70% 60% / 0.2)"}
                  stroke={accepted ? "hsl(140 55% 55%)" : "hsl(10 70% 60%)"}
                  strokeWidth="1.5"
                />
                <text x="220" y="167" textAnchor="middle" fontSize="10" fontWeight="700"
                  fill={accepted ? "hsl(140 55% 65%)" : "hsl(10 70% 65%)"}>
                  {accepted ? "Authentication Accepted" : "Authentication Denied"}
                </text>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 flex items-center gap-3 text-xs border-t border-border pt-3">
        <button
          onClick={replay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          <RotateCcw className="size-3" />
          Replay
        </button>
        <span className="text-muted-foreground">
          {mode === "accept"
            ? "Client credentials pass validation — connection accepted"
            : "Credentials fail validation — client disconnected with denial payload"}
        </span>
      </div>
    </div>
  );
}
