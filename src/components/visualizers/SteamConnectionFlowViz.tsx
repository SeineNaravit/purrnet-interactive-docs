"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Step-by-step Steam → PurrNet connection workflow.
 *
 * 5 phases arranged as horizontal tabs. Each phase has:
 *   Left  – animated diagram showing what's happening at that moment
 *   Right – the key C# snippet for that phase
 *
 * Controls: Play (auto-advance every 4 s), Pause, Prev, Next, click a tab.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Play, Pause,
  CheckCircle, Loader, Wifi, Users, Gamepad2, Shield,
} from "lucide-react";

// ── Phase definitions ─────────────────────────────────────────────────────────

interface Phase {
  id:          string;
  tab:         string;
  scene:       string;
  color:       string;
  glow:        string;
  description: string;
  code:        string;
}

const phases: Phase[] = [
  {
    id:      "title",
    tab:     "① Title Scene",
    scene:   "Title (Offline)",
    color:   "text-slate-300",
    glow:    "#94a3b8",
    description:
      "The game starts fully offline. SteamInitializer.Awake() calls SteamClient.Init() and stores the local player's name + SteamId. If Steam isn't running the game shows an offline warning but doesn't crash.",
    code: `// SteamInitializer.cs  (DontDestroyOnLoad)
void Awake() {
  DontDestroyOnLoad(gameObject);
  try {
    SteamClient.Init(480);          // your AppId
    LocalSteamId   = SteamClient.SteamId;
    LocalPlayerName = SteamClient.Name;
    onSteamReady?.Invoke();
  } catch (Exception e) {
    Debug.LogWarning("[Steam] " + e.Message);
    onSteamFailed?.Invoke();        // show offline UI
  }
}
void Update() => SteamClient.RunCallbacks();`,
  },
  {
    id:      "auth",
    tab:     "② Steam Auth",
    scene:   "Title → Main Menu",
    color:   "text-blue-300",
    glow:    "#60a5fa",
    description:
      "After init succeeds, fetch the player's persona name and avatar texture. Load the avatar asynchronously via SteamFriends; cache it as a Texture2D for UI display.",
    code: `// Fetch player info after onSteamReady fires
async void FetchLocalPlayer() {
  var img = await SteamFriends
    .GetLargeAvatarAsync(SteamClient.SteamId);

  if (img.HasValue) {
    _avatarTex = ConvertToTexture2D(img.Value);
    _playerCard.Set(SteamClient.Name, _avatarTex);
  }
}

// Utility: convert Steamworks Image → Texture2D
Texture2D ConvertToTexture2D(Steamworks.Data.Image img) {
  var tex = new Texture2D(img.Width, img.Height);
  for (int x = 0; x < img.Width; x++)
    for (int y = 0; y < img.Height; y++) {
      var c = img.GetPixel(x, y);
      tex.SetPixel(x, img.Height - y,
        new Color(c.r/255f, c.g/255f, c.b/255f, c.a/255f));
    }
  tex.Apply();
  return tex;
}`,
  },
  {
    id:      "lobby",
    tab:     "③ Create Party",
    scene:   "Main Menu → Lobby",
    color:   "text-indigo-300",
    glow:    "#818cf8",
    description:
      "The host clicks \"Create Party\". SteamMatchmaking.CreateLobbyAsync() opens a friends-only lobby. Set game metadata and max player count. Friends can now accept invites — their client calls JoinLobbyAsync() automatically.",
    code: `// SteamLobbyManager.cs
public async void CreateLobby() {
  var result = await SteamMatchmaking
    .CreateLobbyAsync(_maxPlayers);          // 2-8

  if (!result.HasValue) { /* error */ return; }

  _currentLobby = result.Value;
  _isHost = true;

  _currentLobby.SetFriendsOnly();           // invite-only
  _currentLobby.SetData("game",    "MyGame_v1");
  _currentLobby.SetData("version", Application.version);
  _currentLobby.SetData("host",    SteamClient.Name);
}

// Guest clicks "Accept Invite" → Steam fires this:
async void HandleJoinRequest(Lobby lobby, SteamId _) =>
  await SteamMatchmaking.JoinLobbyAsync(lobby.Id);`,
  },
  {
    id:      "party",
    tab:     "④ Party Ready",
    scene:   "Lobby",
    color:   "text-emerald-300",
    glow:    "#34d399",
    description:
      "Friends join; OnLobbyMemberJoined fires and the host's UI refreshes. The host sets max players with SetMaxPlayers(). When ready, the host calls StartGame() which writes the game server SteamId into the lobby — this fires OnLobbyGameCreated on every member.",
    code: `// React to members joining / leaving
void OnEnable() {
  SteamMatchmaking.OnLobbyMemberJoined += OnMemberJoined;
  SteamMatchmaking.OnLobbyMemberLeave  += OnMemberLeft;
}

void OnMemberJoined(Lobby l, Friend f) {
  onMemberJoined?.Invoke(f);   // → refresh slot UI
}

// Host-only: set max before or after lobby creation
public void SetMaxPlayers(int n) {
  _maxPlayers = Mathf.Clamp(n, 2, 8);
  if (_isHost && _currentLobby.Id.IsValid)
    _currentLobby.MaxMembers = _maxPlayers;
}

// Host presses "Start Game"
public void StartGame() {
  if (!_isHost) return;
  // Writing host SteamId signals ALL members to start
  _currentLobby.SetGameServer(SteamClient.SteamId);
}`,
  },
  {
    id:      "start",
    tab:     "⑤ Start Game",
    scene:   "Lobby → Game Scene",
    color:   "text-amber-300",
    glow:    "#fbbf24",
    description:
      "OnLobbyGameCreated fires on every client. SteamNetworkBridge checks: if this client IS the host, start PurrNet as server+client. Otherwise, connect PurrNet to the host's SteamId via Steam P2P. Everyone loads the game scene through PurrNet's scene management.",
    code: `// SteamNetworkBridge.cs
void OnEnable() =>
  _lobby.onGameStarting += HandleGameStarting;

void HandleGameStarting() {
  if (_lobby.IsHost) {
    // Host: start PurrNet server
    // Steam transport auto-uses host's SteamId
    _networkManager.StartServer();
    _networkManager.StartClient();   // host is also a client
  } else {
    // Guest: connect to host via Steam P2P
    SteamId hostId = _lobby.CurrentLobby.Owner.Id;
    _networkManager.Connect(hostId.ToString());
  }
}

// SteamNetworkBridge is also a NetworkBehaviour:
protected override void OnSpawned(bool asServer) {
  if (asServer)
    NetworkManager.LoadScene("GameScene");
}`,
  },
];

// ── Phase visual components ───────────────────────────────────────────────────

function TitleVisual({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <motion.div
        animate={active ? { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-16 h-16 rounded-xl bg-slate-700 border border-slate-500 flex items-center justify-center text-3xl shadow-lg"
      >
        🎮
      </motion.div>
      <div className="text-center">
        <div className="text-slate-300 font-semibold text-sm">Game Start</div>
        <div className="text-slate-500 text-xs mt-1">Title Scene (Offline)</div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={active ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-600"
      >
        <motion.div
          animate={active ? { rotate: 360 } : {}}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        >
          <Loader size={12} className="text-blue-400" />
        </motion.div>
        <span className="text-xs text-slate-300">SteamClient.Init(480)…</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={active ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: 1.2 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950 border border-emerald-500"
      >
        <CheckCircle size={12} className="text-emerald-400" />
        <span className="text-xs text-emerald-300">Steam OK · AppId 480</span>
      </motion.div>
    </div>
  );
}

const AVATAR_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4"];
function AvatarCircle({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

function AuthVisual({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-2xl">🔷</div>
      <div className="text-slate-400 text-xs">Steam Platform</div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={active ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.6, type: "spring" }}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-950 border border-indigo-400 shadow-lg"
      >
        <AvatarCircle name="You" color="#6366f1" size={38} />
        <div>
          <div className="text-white text-sm font-semibold">YourSteamName</div>
          <div className="text-indigo-400 text-[10px] font-mono">76561198…</div>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 text-[10px]">Online</span>
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ delay: 1.1 }}
        className="text-[10px] text-slate-500 text-center"
      >
        Avatar + Name fetched via<br />SteamFriends.GetLargeAvatarAsync()
      </motion.div>
    </div>
  );
}

const LOBBY_NAMES = ["Alex", "Jamie", "Sam"];
function LobbyCreateVisual({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="text-xs text-indigo-300 font-semibold">Steam Lobby</div>
      <div className="w-full max-w-[200px] rounded-xl bg-slate-800 border border-indigo-500/60 p-3 shadow-lg">
        {/* Host slot */}
        <div className="flex items-center gap-2 mb-2">
          <AvatarCircle name="Y" color="#6366f1" />
          <div>
            <div className="text-white text-[11px] font-semibold">You</div>
            <div className="text-[9px] text-amber-400">👑 Host</div>
          </div>
        </div>
        <hr className="border-slate-700 mb-2" />
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-2 mb-1.5 opacity-40">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-dashed border-slate-600" />
            <span className="text-[10px] text-slate-500">Waiting…</span>
          </div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ delay: 0.8 }}
        className="text-[10px] text-slate-500 text-center"
      >
        SetFriendsOnly() · SetData("game","…")
      </motion.div>
    </div>
  );
}

function PartyVisual({ active }: { active: boolean }) {
  const joined = active ? LOBBY_NAMES.slice(0, 2) : [];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="text-xs text-emerald-300 font-semibold">Party ({joined.length + 1}/4)</div>
      <div className="w-full max-w-[200px] rounded-xl bg-slate-800 border border-emerald-500/60 p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <AvatarCircle name="Y" color="#6366f1" />
          <div>
            <div className="text-white text-[11px] font-semibold">You</div>
            <div className="text-[9px] text-amber-400">👑 Host</div>
          </div>
        </div>
        {LOBBY_NAMES.slice(0, 2).map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, x: -12 }}
            animate={active ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.5 + i * 0.6, type: "spring" }}
            className="flex items-center gap-2 mb-1.5"
          >
            <AvatarCircle name={name} color={AVATAR_COLORS[i + 1]} />
            <div className="text-[11px] text-slate-300">{name}</div>
          </motion.div>
        ))}
        <div className="flex items-center gap-2 opacity-35">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-dashed border-slate-600" />
          <span className="text-[10px] text-slate-500">Waiting…</span>
        </div>
      </div>
    </div>
  );
}

function StartVisual({ active }: { active: boolean }) {
  const clients = ["You (Host)", "Alex", "Jamie"];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="text-xs text-amber-300 font-semibold">PurrNet via Steam P2P</div>
      {/* Server node */}
      <motion.div
        animate={active ? { boxShadow: ["0 0 0px #fbbf2440", "0 0 16px #fbbf2480", "0 0 0px #fbbf2440"] } : {}}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="px-4 py-1.5 rounded-lg bg-amber-950 border border-amber-400 text-amber-200 text-[11px] font-semibold"
      >
        PurrNet Server (Host)
      </motion.div>
      {/* Client connections */}
      <div className="flex gap-3">
        {clients.map((c, i) => (
          <motion.div
            key={c}
            initial={{ opacity: 0, y: 10 }}
            animate={active ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 + i * 0.3, type: "spring" }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-1 h-5 bg-amber-500/50 rounded" />
            <div className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-[9px] text-slate-300 text-center">
              {c}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ delay: 1.2 }}
        className="text-[10px] text-slate-500 text-center"
      >
        Steam P2P transport · no dedicated server
      </motion.div>
    </div>
  );
}

const visuals = [TitleVisual, AuthVisual, LobbyCreateVisual, PartyVisual, StartVisual];

// ── Main component ────────────────────────────────────────────────────────────

export function SteamConnectionFlowViz() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(
        () => setCurrent((c) => (c + 1) % phases.length),
        4200,
      );
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  const phase = phases[current];
  const Visual = visuals[current];

  const prev = () => { setPlaying(false); setCurrent((c) => (c - 1 + phases.length) % phases.length); };
  const next = () => { setPlaying(false); setCurrent((c) => (c + 1) % phases.length); };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
      {/* Phase tabs */}
      <div className="flex overflow-x-auto border-b border-slate-700 bg-slate-950">
        {phases.map((p, i) => (
          <button
            key={p.id}
            onClick={() => { setPlaying(false); setCurrent(i); }}
            className={`flex-shrink-0 px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${
              i === current
                ? "border-current text-white bg-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
            style={i === current ? { borderColor: p.glow, color: p.glow } : {}}
          >
            {p.tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-2 gap-0"
          style={{ minHeight: 280 }}
        >
          {/* Left: animated visual */}
          <div className="border-r border-slate-700/60 p-4 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {phase.scene}
            </div>
            <div className="flex-1">
              <Visual active />
            </div>
          </div>

          {/* Right: code snippet */}
          <div className="p-4 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Key Code
            </div>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">{phase.description}</p>
            <pre
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-3 text-[10px] font-mono text-slate-300 overflow-auto leading-relaxed"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {phase.code}
            </pre>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-700 bg-slate-950">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
        >
          {playing ? <Pause size={11} /> : <Play size={11} />}
          {playing ? "Pause" : "Auto-play"}
        </button>
        <button onClick={prev} className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <button onClick={next} className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <ChevronRight size={14} />
        </button>
        <div className="flex gap-1.5 ml-1">
          {phases.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setPlaying(false); setCurrent(i); }}
              className="w-2 h-2 rounded-full transition-all"
              style={{ backgroundColor: i === current ? p.glow : "#334155" }}
            />
          ))}
        </div>
        <span className="ml-auto text-[10px] text-slate-600">
          Step {current + 1} / {phases.length}
        </span>
      </div>
    </div>
  );
}
