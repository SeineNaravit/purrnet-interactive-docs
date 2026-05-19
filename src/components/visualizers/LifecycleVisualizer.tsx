"use client";

/**
 * Visual model: NetworkBehaviour lifecycle timeline.
 * A vertical timeline of events lights up in sequence with staggered animation.
 * Color-coded: green=server, blue=client, yellow=both.
 * Each node shows a tooltip describing when it fires.
 * Replay button re-triggers the animation.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

type EventScope = "server" | "client" | "both";

interface LifecycleEvent {
  id: string;
  name: string;
  scope: EventScope;
  description: string;
  optional?: boolean;
}

const EVENTS: LifecycleEvent[] = [
  {
    id: "awake",
    name: "Awake()",
    scope: "both",
    description: "Called by Unity before network init. Safe for component refs only — network state not available yet.",
  },
  {
    id: "onspawned",
    name: "OnSpawned()",
    scope: "both",
    description: "First networked callback. isServer, isOwner, and SyncVars are valid here. Register callbacks and initialize state.",
  },
  {
    id: "active",
    name: "[Active: SyncVars / RPCs]",
    scope: "both",
    description: "While the object lives, SyncVars replicate and RPCs can be sent freely in any direction.",
  },
  {
    id: "ownerchanged",
    name: "OnOwnerChanged()",
    scope: "both",
    description: "Fires when GiveOwnership() is called and the owner changes. Receives old and new PlayerID.",
    optional: true,
  },
  {
    id: "ondespawned",
    name: "OnDespawned()",
    scope: "both",
    description: "Called just before the object is removed from the network. Clean up subscriptions and timers here.",
  },
  {
    id: "onpoolreset",
    name: "OnPoolReset()",
    scope: "server",
    description: "Only fires if the object is returned to a pool instead of destroyed. Reset to default state for reuse.",
    optional: true,
  },
];

const SCOPE_COLOR: Record<EventScope, string> = {
  server: "hsl(140 55% 55%)",
  client: "hsl(200 60% 65%)",
  both:   "hsl(45 80% 60%)",
};

const SCOPE_LABEL: Record<EventScope, string> = {
  server: "Server",
  client: "Client",
  both:   "Both",
};

const SCOPE_BG: Record<EventScope, string> = {
  server: "hsl(140 55% 55% / 0.12)",
  client: "hsl(200 60% 65% / 0.12)",
  both:   "hsl(45 80% 60% / 0.12)",
};

export function LifecycleVisualizer() {
  const [tick, setTick] = useState(0);
  const [litEvents, setLitEvents] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    setLitEvents([]);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    EVENTS.forEach((evt, i) => {
      const t = setTimeout(() => {
        setLitEvents((prev) => [...prev, evt.id]);
      }, 300 + i * 480);
      timeouts.push(t);
    });
    return () => timeouts.forEach(clearTimeout);
  }, [tick]);

  const replay = () => {
    setLitEvents([]);
    setTick((t) => t + 1);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">NetworkBehaviour lifecycle — events in order</span>
        <div className="flex items-center gap-3 text-[10px]">
          {(["both", "server", "client"] as EventScope[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: SCOPE_COLOR[s] }} />
              <span className="text-muted-foreground">{SCOPE_LABEL[s]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="relative flex flex-col items-center">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

          {EVENTS.map((evt, i) => {
            const lit = litEvents.includes(evt.id);
            const color = SCOPE_COLOR[evt.scope];
            const isLeft = i % 2 === 0;

            return (
              <div key={evt.id} className="relative w-full flex items-center mb-6 last:mb-0">
                {/* Left content */}
                <div className={`flex-1 flex ${isLeft ? "justify-end pr-5" : "justify-start pl-5"}`}>
                  {isLeft && (
                    <motion.div
                      className="max-w-[170px] w-full"
                      initial={{ opacity: 0, x: -16 }}
                      animate={lit ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      <EventCard evt={evt} color={color} hovered={hoveredId === evt.id}
                        onMouseEnter={() => setHoveredId(evt.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    </motion.div>
                  )}
                </div>

                {/* Center node */}
                <div className="relative z-10 flex items-center justify-center">
                  <motion.div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: lit ? color : "hsl(270 20% 40%)",
                      backgroundColor: lit ? color + "30" : "hsl(270 10% 15%)",
                    }}
                    animate={lit ? { scale: [1, 1.5, 1], boxShadow: [`0 0 0px ${color}`, `0 0 10px ${color}`, `0 0 4px ${color}`] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    {lit && (
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Right content */}
                <div className={`flex-1 flex ${!isLeft ? "justify-start pl-5" : "justify-end pr-5"}`}>
                  {!isLeft && (
                    <motion.div
                      className="max-w-[170px] w-full"
                      initial={{ opacity: 0, x: 16 }}
                      animate={lit ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      <EventCard evt={evt} color={color} hovered={hoveredId === evt.id}
                        onMouseEnter={() => setHoveredId(evt.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredId && (
          <motion.div
            key={hoveredId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mb-3 px-3 py-2 rounded-lg bg-muted border border-border text-xs text-muted-foreground leading-relaxed"
          >
            <span className="font-semibold text-foreground mr-1">
              {EVENTS.find((e) => e.id === hoveredId)?.name}:
            </span>
            {EVENTS.find((e) => e.id === hoveredId)?.description}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="px-4 pb-4 flex items-center gap-3 text-xs border-t border-border pt-3">
        <button
          onClick={replay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          <RotateCcw className="size-3" />
          Replay
        </button>
        <span className="text-muted-foreground">Hover any event node for details</span>
      </div>
    </div>
  );
}

function EventCard({
  evt,
  color,
  hovered,
  onMouseEnter,
  onMouseLeave,
}: {
  evt: LifecycleEvent;
  color: string;
  hovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className="rounded-lg border px-2.5 py-2 cursor-default transition-all duration-200"
      style={{
        borderColor: hovered ? color : "hsl(270 15% 30%)",
        backgroundColor: hovered ? SCOPE_BG[evt.scope] : "hsl(270 10% 12%)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <code className="text-[10px] font-mono font-semibold" style={{ color }}>
          {evt.name}
        </code>
        {evt.optional && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">optional</span>
        )}
      </div>
      <div className="mt-0.5 text-[9px] px-1 py-0.5 rounded-full inline-block font-medium"
        style={{ color, backgroundColor: color + "18" }}>
        {SCOPE_LABEL[evt.scope]}
      </div>
    </div>
  );
}
