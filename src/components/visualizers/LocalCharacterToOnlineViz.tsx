"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * 6-phase step-by-step journey: local character data → live online session.
 *
 * Phases:
 *   1. Local Save   — character card stored in PlayerPrefs / JSON file
 *   2. Connect      — client joins a PurrNet session (host or join)
 *   3. Data Sync    — character SyncVars sent to server on spawn
 *   4. Friend Lobby — all players visible in the lobby room
 *   5. Host Reads   — host iterates Player.allPlayers, reads each character
 *   6. Leave & Save — client disconnects, server persists their data
 *
 * Each phase: animated diagram (left) + C# code snippet (right).
 * Controls: Prev / Next / Play (auto-advance 4 s) / step dots.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, ChevronLeft, ChevronRight,
  Save, Wifi, Users, Server, Database, LogOut, User, Shield, CheckCircle, ArrowRight,
} from "lucide-react";

// ── Phase data ─────────────────────────────────────────────────────────────────

interface Phase {
  id: string;
  step: string;
  color: string;
  accent: string;
  description: string;
  code: string;
}

const phases: Phase[] = [
  {
    id: "local-save",
    step: "① Local Character",
    color: "text-blue-400",
    accent: "#60a5fa",
    description:
      "Character data lives locally before any network connection. Save stats, level, and progress to PlayerPrefs or a JSON file so the player owns their character across sessions.",
    code: `[Serializable]
public class CharacterData
{
    public string name    = "Hero";
    public int    level   = 1;
    public float  health  = 100f;
    public int    xp      = 0;
}

public static class CharacterSave
{
    const string KEY = "CharacterData";

    public static void Save(CharacterData data)
    {
        PlayerPrefs.SetString(KEY, JsonUtility.ToJson(data));
        PlayerPrefs.Save();
    }

    public static CharacterData Load()
    {
        string json = PlayerPrefs.GetString(KEY, "{}");
        return JsonUtility.FromJson<CharacterData>(json)
               ?? new CharacterData();
    }
}`,
  },
  {
    id: "connect",
    step: "② Connect to Session",
    color: "text-emerald-400",
    accent: "#34d399",
    description:
      "Start PurrNet as Host or join an existing session as Client. The NetworkManager handles transport, peer discovery, and connection handshake automatically.",
    code: `public class SessionManager : MonoBehaviour
{
    [SerializeField] private NetworkManager _network;

    /// <summary>Host a new session — you are server + client.</summary>
    public void Host()
    {
        _network.StartHost();
        // PurrNet spawns your PlayerPrefab automatically
    }

    /// <summary>Join a friend's session by IP / Steam ID.</summary>
    public void Join(string hostAddress)
    {
        _network.StartClient(hostAddress);
    }

    private void OnEnable()
    {
        _network.onClientConnected    += OnConnected;
        _network.onClientDisconnected += OnDisconnected;
    }

    private void OnConnected(PlayerID id) =>
        Debug.Log($"[Net] Connected as {id}");

    private void OnDisconnected(PlayerID id) =>
        CharacterSave.Save(localCharacterData); // always save on exit
}`,
  },
  {
    id: "sync",
    step: "③ Sync Character Data",
    color: "text-violet-400",
    accent: "#a78bfa",
    description:
      "When the server spawns your player object, load the saved character data and push it into SyncVars. All connected peers receive the values automatically.",
    code: `using PurrNet;
using UnityEngine;

public class OnlinePlayer : PlayerIdentity<OnlinePlayer>
{
    // ownerAuth: true — the owner can write directly
    private SyncVar<string> _name   = new("Hero",  ownerAuth: true);
    private SyncVar<int>    _level  = new(1,        ownerAuth: true);
    private SyncVar<float>  _health = new(100f,     ownerAuth: true);
    private SyncVar<int>    _xp     = new(0,        ownerAuth: true);

    public string charName  => _name.value;
    public int    level     => _level.value;
    public float  health    => _health.value;

    protected override void OnSpawned()
    {
        if (!isLocalPlayer) return;

        // Load local save and push to the network
        CharacterData saved = CharacterSave.Load();
        _name.value   = saved.name;
        _level.value  = saved.level;
        _health.value = saved.health;
        _xp.value     = saved.xp;
    }
}`,
  },
  {
    id: "lobby",
    step: "④ Friend Lobby",
    color: "text-amber-400",
    accent: "#fbbf24",
    description:
      "Once connected, every client can iterate Player.allPlayers to build a lobby roster. The list is always sorted by join order and updates automatically as players connect.",
    code: `public class LobbyUI : MonoBehaviour
{
    [SerializeField] private PlayerRowUI _rowPrefab;
    [SerializeField] private Transform   _listRoot;

    private void OnEnable()
    {
        NetworkManager.onPlayerJoined += _ => Refresh();
        NetworkManager.onPlayerLeft   += _ => Refresh();
        Refresh();
    }

    private void OnDisable()
    {
        NetworkManager.onPlayerJoined -= _ => Refresh();
        NetworkManager.onPlayerLeft   -= _ => Refresh();
    }

    private void Refresh()
    {
        foreach (Transform t in _listRoot) Destroy(t.gameObject);

        foreach (OnlinePlayer p in OnlinePlayer.allPlayers)
        {
            var row = Instantiate(_rowPrefab, _listRoot);
            row.Set(
                name:    p.charName,
                level:   p.level,
                isYou:   p.isLocalPlayer,
                isHost:  p.isServer
            );
        }
    }
}`,
  },
  {
    id: "host-data",
    step: "⑤ Host Handles Data",
    color: "text-rose-400",
    accent: "#fb7185",
    description:
      "The host (server) can read any player's character data through the typed registry. Use this to enforce game rules, match players by level, or send targeted RPCs.",
    code: `public class MatchManager : NetworkBehaviour
{
    // Runs only on the server / host
    [Server]
    private void OnMatchStart()
    {
        foreach (OnlinePlayer p in OnlinePlayer.allPlayers)
        {
            Debug.Log($"{p.charName} lv{p.level} — {p.health} HP");

            // Example: balance health by level
            float bonus = p.level * 10f;
            RpcSetMaxHealth(p.playerID, 100f + bonus);
        }
    }

    [TargetRpc]
    private void RpcSetMaxHealth(PlayerID target, float maxHp)
    {
        // Runs only on the targeted client
        GetComponent<HealthBar>().SetMax(maxHp);
    }

    // Look up a single player by ID
    [Server]
    public void BuffPlayer(PlayerID id)
    {
        if (!OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p)) return;
        Debug.Log($"Buffing {p.charName}");
    }
}`,
  },
  {
    id: "leave-save",
    step: "⑥ Leave → Save Data",
    color: "text-cyan-400",
    accent: "#22d3ee",
    description:
      "When a player disconnects, the server fires OnPlayerLeft. Use this to save their final character state back to persistent storage before despawning the object.",
    code: `public class SessionManager : NetworkBehaviour
{
    // Server: called when any client leaves
    protected override void OnPlayerLeft(PlayerID id)
    {
        if (!OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p)) return;

        // Build a snapshot of their final state
        var snapshot = new CharacterData
        {
            name   = p.charName,
            level  = p.level,
            health = p.health,
            xp     = p._xp.value,
        };

        // Persist to your backend or notify the leaving client
        RpcSaveOnClient(id, snapshot);
        StartCoroutine(SaveToBackend(id, snapshot));
    }

    // Tell the leaving client to save locally too
    [TargetRpc]
    private void RpcSaveOnClient(PlayerID target, CharacterData data)
    {
        CharacterSave.Save(data);
        Debug.Log("[Save] Character data persisted before disconnect.");
    }
}`,
  },
];

// ── Diagram components ────────────────────────────────────────────────────────

function LocalSaveDiagram() {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/80 border border-blue-500/40 rounded-xl p-4 w-52"
      >
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold text-sm">Hero</span>
          <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Lv 12</span>
        </div>
        {[
          { label: "HP", pct: 78, color: "bg-green-500" },
          { label: "XP", pct: 55, color: "bg-violet-500" },
        ].map(({ label, pct, color }) => (
          <div key={label} className="mb-2">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-1 mt-3 flex-wrap">
          {["Sword+3", "Shield", "Magic"].map((item) => (
            <span key={item} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
              {item}
            </span>
          ))}
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        className="flex items-center gap-2 text-slate-400 text-xs"
      >
        <Save className="w-4 h-4 text-blue-400" />
        <span>Saved to PlayerPrefs</span>
      </motion.div>
      <div className="text-xs text-slate-600 bg-slate-800/60 rounded px-3 py-1 font-mono">
        OFFLINE — no network needed
      </div>
    </div>
  );
}

function ConnectDiagram() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex items-center gap-4 py-2 justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-1"
      >
        <div className="w-12 h-12 rounded-full bg-slate-800 border border-blue-500/50 flex items-center justify-center">
          <User className="w-6 h-6 text-blue-400" />
        </div>
        <span className="text-xs text-slate-400">You</span>
      </motion.div>
      <div className="flex flex-col items-center gap-1 flex-1 relative">
        <div className="h-px w-full bg-slate-700 relative overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: connected ? "100%" : "50%" }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <span className="text-xs text-slate-500">
          {connected ? "Connected" : "Connecting…"}
        </span>
        {!connected && (
          <motion.div
            className="absolute top-0 w-2 h-2 rounded-full bg-emerald-400"
            animate={{ x: [0, 60, 0] }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
          />
        )}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-1"
      >
        <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors duration-700 ${connected ? "bg-emerald-900/40 border-emerald-500/60" : "bg-slate-800 border-slate-600"}`}>
          <Server className="w-6 h-6 text-emerald-400" />
        </div>
        <span className="text-xs text-slate-400">Host</span>
      </motion.div>
      {connected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
        >
          <div className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-900/30 border border-emerald-500/30 rounded-full px-3 py-1">
            <CheckCircle className="w-3 h-3" />
            <span>Session active</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function SyncDiagram() {
  const fields = ["name: Hero", "level: 12", "health: 78", "xp: 4200"];
  return (
    <div className="flex items-start gap-3 py-2 justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-violet-500/50 flex items-center justify-center">
          <User className="w-5 h-5 text-violet-400" />
        </div>
        <span className="text-xs text-slate-400">Client</span>
        <div className="space-y-1">
          {fields.map((f) => (
            <div key={f} className="text-xs bg-slate-800 text-violet-300 px-2 py-0.5 rounded font-mono border border-violet-500/20">
              {f}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 pt-4">
        {fields.map((f, i) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 + 0.2 }}
          >
            <ArrowRight className="w-4 h-4 text-violet-400" />
          </motion.div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-emerald-500/50 flex items-center justify-center">
          <Server className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="text-xs text-slate-400">Server</span>
        <div className="space-y-1">
          {fields.map((f, i) => (
            <motion.div
              key={f}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.15 + 0.5 }}
              className="text-xs bg-emerald-900/30 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-500/20"
            >
              ✓ {f}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LobbyDiagram() {
  const players = [
    { name: "Alice", level: 8, isHost: true, isYou: false, color: "text-amber-400", border: "border-amber-500/40" },
    { name: "You", level: 12, isHost: false, isYou: true, color: "text-blue-400", border: "border-blue-500/60" },
    { name: "Bob", level: 5, isHost: false, isYou: false, color: "text-slate-400", border: "border-slate-600" },
  ];
  return (
    <div className="flex gap-2 py-2 justify-center">
      {players.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.2 }}
          className={`bg-slate-800/80 border ${p.border} rounded-lg p-3 flex flex-col items-center gap-1.5 w-24`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.isYou ? "bg-blue-900/50" : "bg-slate-700"}`}>
            <User className={`w-4 h-4 ${p.color}`} />
          </div>
          <span className={`text-xs font-semibold ${p.color}`}>{p.name}</span>
          <span className="text-xs text-slate-500">Lv {p.level}</span>
          {p.isHost && (
            <span className="text-xs bg-amber-900/40 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
              HOST
            </span>
          )}
          {p.isYou && (
            <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
              YOU
            </span>
          )}
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
            className="w-2 h-2 rounded-full bg-emerald-400"
          />
        </motion.div>
      ))}
    </div>
  );
}

function HostDataDiagram() {
  const rows = [
    { name: "Alice", level: 8, hp: "180 HP", badge: "HOST" },
    { name: "You", level: 12, hp: "220 HP", badge: "CLIENT" },
    { name: "Bob", level: 5, hp: "150 HP", badge: "CLIENT" },
  ];
  return (
    <div className="py-2">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-rose-400" />
        <span className="text-xs text-slate-400 font-mono">Player.allPlayers — 3 online</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 }}
            className="flex items-center gap-2 bg-slate-800/70 border border-rose-500/20 rounded-lg px-3 py-2"
          >
            <User className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="text-xs text-white font-medium w-12">{r.name}</span>
            <span className="text-xs text-slate-500">Lv {r.level}</span>
            <span className="text-xs text-rose-300 ml-auto">{r.hp}</span>
            <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{r.badge}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function LeaveSaveDiagram() {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSaved(true), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-center gap-4">
        <motion.div
          animate={{ opacity: saved ? 0.3 : 1, scale: saved ? 0.9 : 1 }}
          transition={{ duration: 0.8 }}
          className="bg-slate-800/80 border border-slate-600 rounded-xl p-3 flex flex-col items-center gap-1"
        >
          <User className="w-6 h-6 text-slate-400" />
          <span className="text-xs text-slate-400">Bob</span>
          <div className="flex items-center gap-1 text-xs text-red-400">
            <LogOut className="w-3 h-3" />
            <span>leaving</span>
          </div>
        </motion.div>
        <ArrowRight className="w-4 h-4 text-slate-500" />
        <motion.div
          animate={{ borderColor: saved ? "#22d3ee" : "#334155", backgroundColor: saved ? "rgb(8 51 68 / 0.4)" : "transparent" }}
          transition={{ duration: 0.5 }}
          className="rounded-xl border p-3 flex flex-col items-center gap-1 transition-colors"
        >
          <Database className="w-6 h-6 text-cyan-400" />
          <span className="text-xs text-slate-400">Server</span>
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-xs text-cyan-400"
              >
                <CheckCircle className="w-3 h-3" />
                <span>Saved!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-cyan-300 bg-cyan-900/20 border border-cyan-500/30 rounded-full px-3 py-1"
        >
          Character data persisted — progress kept for next session
        </motion.div>
      )}
    </div>
  );
}

const diagrams = [
  LocalSaveDiagram,
  ConnectDiagram,
  SyncDiagram,
  LobbyDiagram,
  HostDataDiagram,
  LeaveSaveDiagram,
];

// ── Main component ────────────────────────────────────────────────────────────

export function LocalCharacterToOnlineViz() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setStep((s) => (s + 1) % phases.length);
  }, []);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(advance, 4000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, advance]);

  const DiagramComponent = diagrams[step];
  const phase = phases[step];

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
      {/* Step tabs */}
      <div className="flex overflow-x-auto border-b border-slate-700/50 scrollbar-none">
        {phases.map((p, i) => (
          <button
            key={p.id}
            onClick={() => { setStep(i); setPlaying(false); }}
            className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              i === step
                ? `${p.color} border-current bg-slate-800/60`
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {p.step}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[320px]">
        {/* Left: diagram */}
        <div className="border-b md:border-b-0 md:border-r border-slate-700/40 p-5 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{phase.description}</p>
              <div className="flex-1 flex items-center justify-center relative">
                <DiagramComponent key={step} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: code */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4"
          >
            <pre className="text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
              {phase.code}
            </pre>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="border-t border-slate-700/40 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
        >
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => { setStep((s) => Math.max(s - 1, 0)); setPlaying(false); }}
          disabled={step === 0}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setStep((s) => Math.min(s + 1, phases.length - 1)); setPlaying(false); }}
          disabled={step === phases.length - 1}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {/* Step dots */}
        <div className="flex gap-1.5 ml-2">
          {phases.map((_, i) => (
            <button
              key={i}
              onClick={() => { setStep(i); setPlaying(false); }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? "bg-slate-300 scale-110" : "bg-slate-600 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-600">
          {step + 1} / {phases.length}
        </span>
      </div>
    </div>
  );
}
