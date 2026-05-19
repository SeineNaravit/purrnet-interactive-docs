"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated PlayerIdentity<T> registry showing the lifecycle of connected players.
 *
 * Layout:
 *   Left  — "Server Registry" panel: Player.allPlayers[] as animated rows.
 *           "You" (local player) always highlighted in blue.
 *           Each row shows PlayerID + name.
 *   Right — Active API snippet reacts to the last user action:
 *           Add → shows OnSpawned / allPlayers iteration
 *           Remove → shows OnPlayerLeft / despawn
 *           Query → shows TryGetLocal() / isLocalPlayer
 *
 * Buttons: [+ Add Player]  [− Remove Last]  [Query Local]
 * Player count badge on the registry panel updates live.
 * Players slide in from the right on add; slide out to the right on remove.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Server, Star, UserMinus, UserPlus, Search } from "lucide-react";

interface PlayerEntry {
  id: string;
  name: string;
  playerID: string;
  isLocal: boolean;
}

const initialPlayers: PlayerEntry[] = [
  { id: "p1", name: "Alice",   playerID: "PID:1001", isLocal: false },
  { id: "p2", name: "You",     playerID: "PID:1002", isLocal: true  },
  { id: "p3", name: "Bob",     playerID: "PID:1003", isLocal: false },
];

const guestNames = ["Carol", "Dan", "Eve", "Frank", "Grace", "Hank"];

type Action = "add" | "remove" | "query" | "idle";

const snippets: Record<Action, string> = {
  idle: `// PlayerIdentity<T> auto-registers every spawned player.
// Access the typed registry from any script — no manager needed.

// All connected players
foreach (OnlinePlayer p in OnlinePlayer.allPlayers)
{
    Debug.Log($"{p.charName} — {p.playerID}");
}

// Count
int count = OnlinePlayer.allPlayers.Count;`,

  add: `// Server spawns a player prefab on client connect.
// PlayerIdentity<T>.OnSpawned is called after registration.

protected override void OnSpawned()
{
    // isLocalPlayer == true only on the owning client
    if (isLocalPlayer)
    {
        CharacterData saved = CharacterSave.Load();
        _name.value  = saved.name;
        _level.value = saved.level;
    }

    // allPlayers now includes this instance
    Debug.Log($"Registry size: {OnlinePlayer.allPlayers.Count}");
}`,

  remove: `// Server detects disconnect — OnPlayerLeft fires before despawn.

protected override void OnPlayerLeft(PlayerID id)
{
    if (!OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p)) return;

    // Save their progress before the object is destroyed
    RpcSaveOnClient(id, new CharacterData
    {
        name   = p.charName,
        level  = p.level,
        health = p.health,
    });

    // allPlayers is automatically updated after this method returns
}`,

  query: `// Get the local player from any script — no singleton needed.

// Option A: static accessor (null if not yet spawned)
if (OnlinePlayer.localPlayer is { } me)
{
    hud.SetName(me.charName);
    hud.SetLevel(me.level);
}

// Option B: safe null-check pattern
if (OnlinePlayer.TryGetLocal(out OnlinePlayer me))
{
    Debug.Log($"I am {me.charName} [{me.playerID}]");
    Debug.Log($"isLocalPlayer: {me.isLocalPlayer}");  // always true
}`,
};

export function PlayerIdentityVisualizer() {
  const [players, setPlayers] = useState<PlayerEntry[]>(initialPlayers);
  const [lastAction, setLastAction] = useState<Action>("idle");
  const [guestIndex, setGuestIndex] = useState(0);
  const [queryFlash, setQueryFlash] = useState(false);

  const addPlayer = useCallback(() => {
    const name = guestNames[guestIndex % guestNames.length];
    const newId = `p${Date.now()}`;
    setPlayers((prev) => [
      ...prev,
      {
        id: newId,
        name,
        playerID: `PID:${1004 + guestIndex}`,
        isLocal: false,
      },
    ]);
    setGuestIndex((i) => i + 1);
    setLastAction("add");
  }, [guestIndex]);

  const removePlayer = useCallback(() => {
    setPlayers((prev) => {
      const nonLocal = prev.filter((p) => !p.isLocal);
      if (nonLocal.length === 0) return prev;
      const last = nonLocal[nonLocal.length - 1];
      return prev.filter((p) => p.id !== last.id);
    });
    setLastAction("remove");
  }, []);

  const queryLocal = useCallback(() => {
    setLastAction("query");
    setQueryFlash(true);
    setTimeout(() => setQueryFlash(false), 1200);
  }, []);

  const snippet = snippets[lastAction];

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-5 py-3 flex items-center gap-3">
        <Server className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">PlayerIdentity Registry</span>
        <div className="ml-auto flex items-center gap-1.5 bg-emerald-900/30 border border-emerald-500/30 rounded-full px-3 py-1">
          <span className="text-xs text-emerald-300 font-mono">
            allPlayers.Count: {players.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left: registry */}
        <div className="border-b md:border-b-0 md:border-r border-slate-700/40 p-5">
          <div className="text-xs text-slate-500 font-mono mb-3">
            OnlinePlayer.allPlayers[]
          </div>

          {/* Player list */}
          <div className="space-y-2 min-h-[180px]">
            <AnimatePresence initial={false}>
              {players.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors duration-300 ${
                    p.isLocal
                      ? queryFlash
                        ? "bg-blue-500/20 border-blue-400/60 shadow-[0_0_12px_2px_#3b82f680]"
                        : "bg-blue-900/30 border-blue-500/40"
                      : "bg-slate-800/60 border-slate-700/50"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${p.isLocal ? "bg-blue-900/60" : "bg-slate-700"}`}>
                    {p.isLocal ? (
                      <Star className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${p.isLocal ? "text-blue-300" : "text-slate-200"}`}>
                      {p.name}
                      {p.isLocal && <span className="ml-2 text-xs text-blue-400/70">(localPlayer)</span>}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">{p.playerID}</div>
                  </div>
                  {p.isLocal && (
                    <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                      YOU
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={addPlayer}
              disabled={players.length >= 6}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-40 transition-colors"
            >
              <UserPlus className="w-3 h-3" />
              Add Player
            </button>
            <button
              onClick={removePlayer}
              disabled={players.filter((p) => !p.isLocal).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 disabled:opacity-40 transition-colors"
            >
              <UserMinus className="w-3 h-3" />
              Remove Last
            </button>
            <button
              onClick={queryLocal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-900/40 border border-blue-500/40 text-blue-300 hover:bg-blue-900/60 transition-colors"
            >
              <Search className="w-3 h-3" />
              Query Local
            </button>
          </div>
        </div>

        {/* Right: code */}
        <div className="p-5">
          <div className="text-xs text-slate-500 font-mono mb-3">
            {lastAction === "add" && "// OnSpawned — player joined"}
            {lastAction === "remove" && "// OnPlayerLeft — player disconnected"}
            {lastAction === "query" && "// TryGetLocal — access local player"}
            {lastAction === "idle" && "// Registry overview"}
          </div>
          <AnimatePresence mode="wait">
            <motion.pre
              key={lastAction}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap"
            >
              {snippet}
            </motion.pre>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
