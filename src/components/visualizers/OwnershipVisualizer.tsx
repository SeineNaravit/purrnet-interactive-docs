"use client";

/**
 * Visual model: A game object (cube) sits in the middle.
 * The current owner has a glowing border + crown icon.
 * Clicking "Transfer" animates the ownership token moving to a new player.
 * The diagram also shows how server always has authority even without ownership.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PLAYERS = [
  { id: "server", label: "Server",   color: "hsl(270 60% 65%)", x: 200, y: 40  },
  { id: "p1",     label: "Player 1", color: "hsl(140 55% 55%)", x: 50,  y: 160 },
  { id: "p2",     label: "Player 2", color: "hsl(200 55% 65%)", x: 200, y: 200 },
  { id: "p3",     label: "Player 3", color: "hsl(300 55% 65%)", x: 350, y: 160 },
] as const;
type PlayerId = typeof PLAYERS[number]["id"];

export function OwnershipVisualizer() {
  const [owner, setOwner] = useState<PlayerId>("p1");
  const [prev, setPrev] = useState<PlayerId | null>(null);
  const [transferring, setTransferring] = useState(false);

  const transfer = (to: PlayerId) => {
    if (to === owner || transferring) return;
    setPrev(owner);
    setTransferring(true);
    setTimeout(() => {
      setOwner(to);
      setPrev(null);
      setTransferring(false);
    }, 700);
  };

  const ownerNode = PLAYERS.find(p => p.id === owner)!;
  const prevNode  = prev ? PLAYERS.find(p => p.id === prev)! : null;

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>Click a player to transfer ownership</span>
        <code className="text-primary">GiveOwnership(playerID)</code>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 400 260" className="w-full">
          {/* Lines server → all */}
          {PLAYERS.filter(p => p.id !== "server").map(p => (
            <line key={p.id} x1={200} y1={60} x2={p.x} y2={p.y}
              stroke="hsl(270 30% 55% / 0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
          ))}

          {/* Ownership transfer animation */}
          <AnimatePresence>
            {transferring && prevNode && (
              <motion.circle
                key="transfer-dot"
                r="7" fill="hsl(45 80% 65%)"
                initial={{ cx: prevNode.x, cy: prevNode.y, opacity: 1 }}
                animate={{ cx: ownerNode.x, cy: ownerNode.y, opacity: 0 }}
                exit={{}}
                transition={{ duration: 0.65, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>

          {/* Player nodes */}
          {PLAYERS.map(p => {
            const isOwner = p.id === owner && !transferring;
            const isServer = p.id === "server";
            return (
              <g key={p.id} onClick={() => !isServer && transfer(p.id)} style={{ cursor: isServer ? "default" : "pointer" }}>
                {/* Glow for owner */}
                {isOwner && !isServer && (
                  <motion.circle cx={p.x} cy={p.y} r="32"
                    fill={p.color + "25"} stroke={p.color} strokeWidth="2.5"
                    animate={{ r: [30, 34, 30] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={isServer ? 28 : 24}
                  fill={p.color + "15"} stroke={p.color}
                  strokeWidth={isOwner && !isServer ? "2.5" : "1.5"} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="8" fill={p.color} fontWeight="700">
                  {p.label}
                </text>
                {isOwner && !isServer && (
                  <text x={p.x} y={p.y - 30} textAnchor="middle" fontSize="14">👑</text>
                )}
                {isServer && (
                  <text x={p.x} y={p.y - 30} textAnchor="middle" fontSize="11" fill="hsl(270 60% 65%)" opacity="0.7">Always Auth</text>
                )}
              </g>
            );
          })}

          <text x="200" y="252" textAnchor="middle" fontSize="9" fill="hsl(270 40% 65%)" opacity="0.7">
            Owner: {PLAYERS.find(p => p.id === owner)?.label} · Server always retains authority
          </text>
        </svg>
      </div>
    </div>
  );
}
