"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive character creation / save-load flow showing how the host manages
 * all player character data in a server-side dictionary.
 *
 * Left panel — "Join as…" tabs:
 *   New Player: name input + class picker (Warrior / Mage / Archer) → Confirm
 *   Returning Player: shows saved character card → Load
 *
 * Right panel — Host Database: table of stored characters, updating live when
 *   a new character is created or a returning player is confirmed.
 *
 * Flow simulation:
 *   Create: ClientRpc → ServerRpc → host stores → TargetRpc → game starts.
 *   Load:   ClientRpc → ServerRpc → host reads → TargetRpc → character loaded.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, User, Database, CheckCircle, ArrowRight } from "lucide-react";

const CLASSES = [
  { id: "warrior", label: "Warrior", icon: "⚔️", color: "text-red-400",    border: "border-red-500/50",    bg: "bg-red-900/30" },
  { id: "mage",    label: "Mage",    icon: "🔮", color: "text-violet-400", border: "border-violet-500/50", bg: "bg-violet-900/30" },
  { id: "archer",  label: "Archer",  icon: "🏹", color: "text-green-400",  border: "border-green-500/50",  bg: "bg-green-900/30" },
];

interface SavedChar {
  name: string;
  classId: string;
  level: number;
  playerId: string;
}

const INITIAL_DB: SavedChar[] = [
  { name: "Alice",  classId: "warrior", level: 14, playerId: "PID:1001" },
  { name: "Bob",    classId: "mage",    level: 9,  playerId: "PID:1002" },
];

const RETURNING: SavedChar = { name: "You",   classId: "archer",  level: 7,  playerId: "PID:1003" };

type Tab = "new" | "returning";
type FlowState = "idle" | "sending" | "done";

export function CharacterCreationViz() {
  const [tab, setTab] = useState<Tab>("returning");
  const [name, setName] = useState("Hero");
  const [selectedClass, setSelectedClass] = useState("warrior");
  const [db, setDb] = useState<SavedChar[]>(INITIAL_DB);
  const [flow, setFlow] = useState<FlowState>("idle");
  const [loadedChar, setLoadedChar] = useState<SavedChar | null>(null);

  const cls = CLASSES.find((c) => c.id === selectedClass)!;

  const handleCreate = () => {
    if (!name.trim() || flow !== "idle") return;
    setFlow("sending");
    setTimeout(() => {
      const newChar: SavedChar = { name: name.trim(), classId: selectedClass, level: 1, playerId: `PID:${1004 + db.length}` };
      setDb((prev) => [...prev, newChar]);
      setLoadedChar(newChar);
      setFlow("done");
      setTimeout(() => setFlow("idle"), 2000);
    }, 1200);
  };

  const handleLoad = () => {
    if (flow !== "idle") return;
    setFlow("sending");
    setTimeout(() => {
      setLoadedChar(RETURNING);
      setFlow("done");
      setTimeout(() => setFlow("idle"), 2000);
    }, 900);
  };

  const allChars = tab === "returning" && !db.find((c) => c.playerId === RETURNING.playerId)
    ? [...db, RETURNING]
    : db;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
      <div className="border-b border-slate-700/50 px-5 py-3 flex items-center gap-3">
        <Database className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-200">Host Character Database</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left: player flow */}
        <div className="border-b md:border-b-0 md:border-r border-slate-700/40 p-5">
          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {(["returning", "new"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setFlow("idle"); setLoadedChar(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === t
                    ? t === "new" ? "bg-violet-900/40 border border-violet-500/40 text-violet-300"
                                  : "bg-blue-900/40 border border-blue-500/40 text-blue-300"
                    : "text-slate-500 border border-transparent hover:text-slate-300"
                }`}
              >
                {t === "new" ? <UserPlus className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {t === "new" ? "New Player" : "Returning Player"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "new" ? (
              <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Character Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={16}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Class</label>
                  <div className="flex gap-2">
                    {CLASSES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClass(c.id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-colors ${
                          selectedClass === c.id ? `${c.bg} ${c.border} ${c.color}` : "border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        <span className="text-base">{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || flow !== "idle"}
                  className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {flow === "sending" ? "Sending to Host…" : flow === "done" ? <><CheckCircle className="w-4 h-4" /> Created!</> : <>Create Character <ArrowRight className="w-4 h-4" /></>}
                </button>
              </motion.div>
            ) : (
              <motion.div key="returning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="bg-slate-800/60 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{CLASSES.find((c) => c.id === RETURNING.classId)?.icon}</div>
                    <div>
                      <div className="text-white font-semibold">{RETURNING.name}</div>
                      <div className="text-xs text-slate-400">{CLASSES.find((c) => c.id === RETURNING.classId)?.label} · Lv {RETURNING.level}</div>
                      <div className="text-xs text-slate-600 font-mono">{RETURNING.playerId}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">Host found your save. Load to continue your progress.</div>
                <button
                  onClick={handleLoad}
                  disabled={flow !== "idle"}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {flow === "sending" ? "Loading from Host…" : flow === "done" ? <><CheckCircle className="w-4 h-4" /> Loaded!</> : <>Load Character <ArrowRight className="w-4 h-4" /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flow indicator */}
          <AnimatePresence>
            {flow !== "idle" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 text-xs text-slate-500 flex items-center gap-2 font-mono"
              >
                {flow === "sending" && <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> CheckSaveServerRpc → Host…</>}
                {flow === "done" && loadedChar && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> TargetRpc: character loaded</>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: host database */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400 font-semibold">Host Save Database</span>
            <span className="ml-auto text-xs text-slate-600">{allChars.length} records</span>
          </div>
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {allChars.map((char) => {
                const c = CLASSES.find((cl) => cl.id === char.classId)!;
                const isActive = loadedChar?.playerId === char.playerId;
                return (
                  <motion.div
                    key={char.playerId}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors ${
                      isActive ? `${c.bg} ${c.border}` : "bg-slate-800/50 border-slate-700/50"
                    }`}
                  >
                    <span className="text-sm">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${isActive ? c.color : "text-slate-200"}`}>{char.name}</div>
                      <div className="text-xs text-slate-500">{c.label} · Lv {char.level}</div>
                    </div>
                    <div className="text-xs text-slate-600 font-mono">{char.playerId}</div>
                    {isActive && <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
