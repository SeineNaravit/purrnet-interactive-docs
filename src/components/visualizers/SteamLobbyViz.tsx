"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive Steam Party Lobby Simulator.
 *
 * Left panel  – live party slots (host + guests, animated arrivals)
 * Right panel – max-player slider + readiness toggles + Start Game button
 *
 * User can:
 *   • Click "Invite Friend" to animate a friend joining (up to maxPlayers-1)
 *   • Drag the MaxPlayers slider (2–8) — updates label, kicks over-limit guests
 *   • Toggle "Ready" for each guest
 *   • Press "Start Game" (enabled when host + ≥1 guest, all ready)
 *   • Press "Reset" to clear all guests
 *
 * Shows the equivalent C# one-liner for each action as a toast.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, RotateCcw, Zap, Crown, Check, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LobbyMember {
  id: number;
  name: string;
  color: string;
  ready: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FRIEND_POOL: { name: string; color: string }[] = [
  { name: "Alex",   color: "#f59e0b" },
  { name: "Jamie",  color: "#10b981" },
  { name: "Sam",    color: "#ef4444" },
  { name: "Morgan", color: "#8b5cf6" },
  { name: "Riley",  color: "#06b6d4" },
  { name: "Casey",  color: "#f472b6" },
  { name: "Jordan", color: "#84cc16" },
];

const HOST_COLOR = "#6366f1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

function CodeToast({ text, visible }: { text: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute bottom-3 left-3 right-3 rounded-lg bg-slate-950 border border-indigo-500/50 px-3 py-2 z-10"
        >
          <div className="text-[9px] text-slate-500 mb-0.5 font-semibold">C# equivalent</div>
          <code className="text-[10px] text-indigo-300 font-mono">{text}</code>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SteamLobbyViz() {
  const [maxPlayers, setMaxPlayers]   = useState(4);
  const [guests, setGuests]           = useState<LobbyMember[]>([]);
  const [nextFriendIdx, setNext]      = useState(0);
  const [toast, setToast]             = useState<string | null>(null);
  const [toastKey, setToastKey]       = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const showToast = useCallback((code: string) => {
    setToast(code);
    setToastKey((k) => k + 1);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const allReady  = guests.length > 0 && guests.every((g) => g.ready);
  const canStart  = allReady && guests.length + 1 <= maxPlayers;
  const slotsUsed = guests.length + 1; // +1 for host

  function inviteFriend() {
    if (slotsUsed >= maxPlayers || nextFriendIdx >= FRIEND_POOL.length) return;
    const friend = FRIEND_POOL[nextFriendIdx];
    const newMember: LobbyMember = {
      id:    nextFriendIdx,
      name:  friend.name,
      color: friend.color,
      ready: false,
    };
    setGuests((prev) => [...prev, newMember]);
    setNext((n) => n + 1);
    showToast(`SteamMatchmaking.OnLobbyMemberJoined += OnMemberJoined;`);
  }

  function toggleReady(id: number) {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, ready: !g.ready } : g,
      ),
    );
    showToast(`lobby.SetData("member_${id}_ready", "true");`);
  }

  function kickGuest(id: number) {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    showToast(`lobby.KickMember(friendId); // host only`);
  }

  function changeMax(val: number) {
    setMaxPlayers(val);
    // Kick any guests beyond new limit
    setGuests((prev) => prev.slice(0, val - 1));
    showToast(`_currentLobby.MaxMembers = ${val};`);
  }

  function startGame() {
    if (!canStart) return;
    setGameStarted(true);
    showToast(`_currentLobby.SetGameServer(SteamClient.SteamId);`);
  }

  function reset() {
    setGuests([]);
    setNext(0);
    setGameStarted(false);
    setToast(null);
  }

  if (gameStarted) {
    return (
      <div className="rounded-xl border border-amber-500/60 bg-slate-900 overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-4 p-10">
          <motion.div
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="text-5xl"
          >
            🚀
          </motion.div>
          <div className="text-amber-300 font-bold text-lg">Game Starting!</div>
          <div className="text-slate-400 text-sm text-center max-w-xs">
            <span className="font-mono text-amber-400">SetGameServer()</span> fired on all {slotsUsed} members.
            PurrNet server starting on host, clients connecting via Steam P2P.
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            {[{ name: "You (Host)", color: HOST_COLOR }, ...guests].map((m) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-600"
              >
                <Avatar name={m.name[0]} color={m.color} size={20} />
                <span className="text-[10px] text-slate-300">{m.name}</span>
                <Check size={10} className="text-emerald-400" />
              </motion.div>
            ))}
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors mt-2"
          >
            <RotateCcw size={12} /> Simulate Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-950">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">Steam Lobby Simulator</span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-0" style={{ minHeight: 280 }}>
        {/* Left: lobby roster */}
        <div className="border-r border-slate-700/60 p-4 relative flex flex-col gap-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Party Members ({slotsUsed} / {maxPlayers})
          </div>

          {/* Host row */}
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/60 border border-indigo-500/30">
            <Avatar name="Y" color={HOST_COLOR} size={34} />
            <div className="flex-1 min-w-0">
              <div className="text-white text-[11px] font-semibold">You</div>
              <div className="flex items-center gap-1">
                <Crown size={9} className="text-amber-400" />
                <span className="text-[9px] text-amber-400">Host</span>
              </div>
            </div>
            <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900 text-emerald-400 border border-emerald-500/40">
              Ready
            </div>
          </div>

          {/* Guest rows */}
          <AnimatePresence>
            {guests.map((g) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, x: -16, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: 16, height: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50"
              >
                <Avatar name={g.name} color={g.color} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 text-[11px] font-semibold">{g.name}</div>
                  <div className="text-[9px] text-slate-500">Guest</div>
                </div>
                {/* Ready toggle */}
                <button
                  onClick={() => toggleReady(g.id)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    g.ready
                      ? "bg-emerald-900 text-emerald-400 border-emerald-500/40"
                      : "bg-slate-900 text-slate-500 border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {g.ready ? "Ready" : "Not ready"}
                </button>
                {/* Kick */}
                <button
                  onClick={() => kickGuest(g.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  title="Kick (host only)"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, maxPlayers - slotsUsed) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-dashed border-slate-700/50 opacity-40"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-slate-800 border border-dashed border-slate-600" />
              <span className="text-[10px] text-slate-600">Waiting for player…</span>
            </div>
          ))}

          {/* Code toast */}
          <CodeToast key={toastKey} text={toast ?? ""} visible={!!toast} />
        </div>

        {/* Right: controls */}
        <div className="p-4 flex flex-col gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Max Players
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={2}
                max={8}
                value={maxPlayers}
                onChange={(e) => changeMax(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-white font-bold text-base w-5 text-center">{maxPlayers}</span>
            </div>
            <div className="text-[9px] text-slate-600 mt-1 font-mono">
              _currentLobby.MaxMembers = {maxPlayers};
            </div>
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Actions
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={inviteFriend}
                disabled={slotsUsed >= maxPlayers || nextFriendIdx >= FRIEND_POOL.length}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                <UserPlus size={13} />
                Simulate Friend Joining
              </button>

              <button
                onClick={startGame}
                disabled={!canStart}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 text-xs font-bold transition-colors"
              >
                <Zap size={13} />
                Start Game
              </button>
            </div>
          </div>

          {/* Checklist */}
          <div className="mt-auto">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Start Requirements
            </div>
            {[
              { label: "At least 1 guest",   met: guests.length >= 1 },
              { label: "All guests ready",    met: allReady },
              { label: "Within max players",  met: slotsUsed <= maxPlayers },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full flex items-center justify-center ${item.met ? "bg-emerald-500" : "bg-slate-700"}`}>
                  {item.met && <Check size={7} className="text-white" />}
                </div>
                <span className={`text-[10px] ${item.met ? "text-emerald-400" : "text-slate-500"}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
