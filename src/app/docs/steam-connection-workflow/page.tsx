import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SteamConnectionFlowViz } from "@/components/visualizers/SteamConnectionFlowViz";
import { SteamLobbyViz } from "@/components/visualizers/SteamLobbyViz";

export const metadata = { title: "Steam Connection Workflow" };

// ── API tables ─────────────────────────────────────────────────────────────────

const steamInitParamsEN = [
  { name: "SteamClient.Init(uint appId)",         type: "void",           description: "Initialize the Steamworks client. Must be called once on the main thread before any other Steam API call. Throws if Steam is not running." },
  { name: "SteamClient.SteamId",                  type: "SteamId",        description: "The local player's 64-bit Steam ID. Available immediately after Init()." },
  { name: "SteamClient.Name",                     type: "string",         description: "The local player's Steam persona name." },
  { name: "SteamClient.RunCallbacks()",            type: "void",           description: "Must be called every frame (in Update) to dispatch pending Steam events and fire registered callbacks." },
  { name: "SteamFriends.GetLargeAvatarAsync(id)", type: "Task<Image?>",   description: "Async fetch of the player's 184×184 avatar image. Returns null if not cached; call in a try/catch." },
];

const steamInitParamsTH = [
  { name: "SteamClient.Init(uint appId)",         type: "void",         description: "เริ่มต้น Steamworks client ต้องเรียกครั้งเดียวบน main thread ก่อนเรียก Steam API อื่น ๆ ถ้า Steam ไม่ได้รันจะ throw exception" },
  { name: "SteamClient.SteamId",                  type: "SteamId",      description: "Steam ID 64-bit ของ player ในเครื่อง พร้อมใช้ทันทีหลัง Init()" },
  { name: "SteamClient.Name",                     type: "string",       description: "Steam persona name ของ player ในเครื่อง" },
  { name: "SteamClient.RunCallbacks()",            type: "void",         description: "ต้องเรียกทุก frame (ใน Update) เพื่อ dispatch Steam events และยิง callback ที่ลงทะเบียนไว้" },
  { name: "SteamFriends.GetLargeAvatarAsync(id)", type: "Task<Image?>", description: "ดึง avatar ขนาด 184×184 แบบ async คืน null ถ้ายังไม่ได้ cache ควรใช้ใน try/catch" },
];

const lobbyParamsEN = [
  { name: "SteamMatchmaking.CreateLobbyAsync(maxPlayers)", type: "Task<Lobby?>",   description: "Host creates a new Steam lobby with the given max-player count. Returns null on failure." },
  { name: "lobby.SetFriendsOnly()",                        type: "void",           description: "Restricts the lobby to friends-only. Guests must receive an explicit invite." },
  { name: "lobby.SetData(key, value)",                     type: "void",           description: "Stores arbitrary string metadata on the lobby, visible to all members." },
  { name: "lobby.MaxMembers",                              type: "int (set)",      description: "Update max player count after creation. Changes take effect immediately." },
  { name: "SteamMatchmaking.JoinLobbyAsync(lobbyId)",      type: "Task<Lobby?>",   description: "Guest joins an existing lobby by ID. Usually called via the OnLobbyInvite or GameRichPresenceJoinRequested callback." },
  { name: "lobby.SetGameServer(hostSteamId)",              type: "void",           description: "Host signals all members that the game is starting. Fires OnLobbyGameCreated on every client." },
  { name: "SteamMatchmaking.OnLobbyMemberJoined",          type: "event",          description: "Fires on all lobby members when a new player joins. Use it to refresh the roster UI." },
  { name: "SteamMatchmaking.OnLobbyMemberLeave",           type: "event",          description: "Fires on all lobby members when a player leaves or is kicked." },
];

const lobbyParamsTH = [
  { name: "SteamMatchmaking.CreateLobbyAsync(maxPlayers)", type: "Task<Lobby?>",  description: "Host สร้าง Steam lobby ใหม่พร้อม max player ที่กำหนด คืน null เมื่อเกิดข้อผิดพลาด" },
  { name: "lobby.SetFriendsOnly()",                        type: "void",          description: "จำกัด lobby เฉพาะเพื่อน ผู้เข้าร่วมต้องรับ invite โดยตรง" },
  { name: "lobby.SetData(key, value)",                     type: "void",          description: "เก็บ metadata แบบ string บน lobby มองเห็นได้จากสมาชิกทั้งหมด" },
  { name: "lobby.MaxMembers",                              type: "int (set)",     description: "อัปเดตจำนวน player สูงสุดหลังสร้าง lobby มีผลทันที" },
  { name: "SteamMatchmaking.JoinLobbyAsync(lobbyId)",      type: "Task<Lobby?>",  description: "Guest เข้าร่วม lobby ที่มีอยู่โดยใช้ ID มักเรียกผ่าน callback ของ OnLobbyInvite" },
  { name: "lobby.SetGameServer(hostSteamId)",              type: "void",          description: "Host ส่งสัญญาณให้สมาชิกทุกคนทราบว่าเกมกำลังจะเริ่ม ยิง OnLobbyGameCreated บนทุก client" },
  { name: "SteamMatchmaking.OnLobbyMemberJoined",          type: "event",         description: "ยิงบนสมาชิก lobby ทั้งหมดเมื่อ player ใหม่เข้าร่วม ใช้รีเฟรช UI รายชื่อ" },
  { name: "SteamMatchmaking.OnLobbyMemberLeave",           type: "event",         description: "ยิงบนสมาชิก lobby ทั้งหมดเมื่อ player ออกหรือถูก kick" },
];

// ── C# code snippets ───────────────────────────────────────────────────────────

const steamInitializerCode = `using System;
using Steamworks;
using UnityEngine;

/// <summary>
/// Boots the Steamworks client on startup.
/// Attach to a DontDestroyOnLoad singleton.
/// </summary>
public class SteamInitializer : MonoBehaviour
{
    public static SteamId   LocalSteamId    { get; private set; }
    public static string    LocalPlayerName { get; private set; } = "Player";
    public static bool      IsInitialized   { get; private set; }

    [SerializeField] private uint _appId = 480;   // 480 = Spacewar (dev/test)

    public event Action onSteamReady;
    public event Action onSteamFailed;

    void Awake()
    {
        DontDestroyOnLoad(gameObject);
        try
        {
            SteamClient.Init(_appId);
            LocalSteamId    = SteamClient.SteamId;
            LocalPlayerName = SteamClient.Name;
            IsInitialized   = true;
            onSteamReady?.Invoke();
        }
        catch (Exception e)
        {
            Debug.LogWarning("[Steam] Init failed: " + e.Message);
            onSteamFailed?.Invoke();   // show offline / retry UI
        }
    }

    void Update()
    {
        // REQUIRED every frame — dispatches pending Steam callbacks
        if (IsInitialized)
            SteamClient.RunCallbacks();
    }

    void OnDestroy() => SteamClient.Shutdown();
}`;

const fetchPlayerCode = `using Steamworks;
using Steamworks.Data;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Fetches the local player's Steam avatar and persona name.
/// Call FetchLocalPlayer() after SteamInitializer.onSteamReady fires.
/// </summary>
public class SteamPlayerFetcher : MonoBehaviour
{
    [SerializeField] private RawImage _avatarImage;
    [SerializeField] private Text     _playerNameText;

    public async void FetchLocalPlayer()
    {
        _playerNameText.text = SteamClient.Name;

        try
        {
            Image? img = await SteamFriends
                .GetLargeAvatarAsync(SteamClient.SteamId);

            if (img.HasValue)
                _avatarImage.texture = ConvertToTexture2D(img.Value);
        }
        catch (Exception e)
        {
            Debug.LogWarning("[Steam] Avatar fetch failed: " + e.Message);
        }
    }

    // ── Helper: Steamworks.Data.Image → UnityEngine.Texture2D ──────────────
    private static Texture2D ConvertToTexture2D(Image img)
    {
        var tex = new Texture2D((int)img.Width, (int)img.Height,
                                TextureFormat.ARGB32, false);
        for (int x = 0; x < img.Width;  x++)
        for (int y = 0; y < img.Height; y++)
        {
            var pixel = img.GetPixel(x, y);
            // Steam stores pixels top-down; Unity expects bottom-up
            tex.SetPixel(x, (int)img.Height - y - 1,
                new Color(pixel.r / 255f, pixel.g / 255f,
                          pixel.b / 255f, pixel.a / 255f));
        }
        tex.Apply();
        return tex;
    }
}`;

const lobbyManagerCode = `using System;
using Steamworks;
using Steamworks.Data;
using UnityEngine;

/// <summary>
/// Creates, joins, and manages a Steam friends-only lobby.
/// Designed as a singleton used by both host and guest.
/// </summary>
public class SteamLobbyManager : MonoBehaviour
{
    // ── State ──────────────────────────────────────────────────────────────
    public  Lobby  CurrentLobby { get; private set; }
    public  bool   IsHost       { get; private set; }

    [SerializeField] private int _maxPlayers = 4;

    public event Action<Friend> onMemberJoined;
    public event Action<Friend> onMemberLeft;
    public event Action         onGameStarting;

    // ── Unity lifecycle ────────────────────────────────────────────────────
    void OnEnable()
    {
        SteamMatchmaking.OnLobbyMemberJoined  += HandleMemberJoined;
        SteamMatchmaking.OnLobbyMemberLeave   += HandleMemberLeft;
        SteamMatchmaking.OnLobbyGameCreated   += HandleGameCreated;
    }

    void OnDisable()
    {
        SteamMatchmaking.OnLobbyMemberJoined  -= HandleMemberJoined;
        SteamMatchmaking.OnLobbyMemberLeave   -= HandleMemberLeft;
        SteamMatchmaking.OnLobbyGameCreated   -= HandleGameCreated;
    }

    // ── Host: Create Lobby ─────────────────────────────────────────────────
    public async void CreateLobby()
    {
        var result = await SteamMatchmaking.CreateLobbyAsync(_maxPlayers);
        if (!result.HasValue)
        {
            Debug.LogError("[Steam] CreateLobby failed.");
            return;
        }

        CurrentLobby = result.Value;
        IsHost       = true;

        // Configure lobby metadata
        CurrentLobby.SetFriendsOnly();
        CurrentLobby.SetData("game",    Application.productName);
        CurrentLobby.SetData("version", Application.version);
        CurrentLobby.SetData("host",    SteamClient.Name);

        Debug.Log($"[Steam] Lobby created: {CurrentLobby.Id}");
    }

    // ── Guest: Join Lobby ──────────────────────────────────────────────────
    // Usually called automatically by Steam rich-presence / invite acceptance
    public async void JoinLobby(SteamId lobbyId)
    {
        var result = await SteamMatchmaking.JoinLobbyAsync(lobbyId);
        if (!result.HasValue)
        {
            Debug.LogError("[Steam] JoinLobby failed.");
            return;
        }
        CurrentLobby = result.Value;
        IsHost       = false;
    }

    // ── Host only: change max player count after creation ──────────────────
    public void SetMaxPlayers(int count)
    {
        _maxPlayers = Mathf.Clamp(count, 2, 8);
        if (IsHost && CurrentLobby.Id.IsValid)
            CurrentLobby.MaxMembers = _maxPlayers;
    }

    // ── Host only: signal everyone to start ───────────────────────────────
    public void StartGame()
    {
        if (!IsHost) return;
        // Writing the host SteamId as the "game server" fires
        // OnLobbyGameCreated on ALL connected members.
        CurrentLobby.SetGameServer(SteamClient.SteamId);
    }

    // ── Callbacks ──────────────────────────────────────────────────────────
    void HandleMemberJoined(Lobby _, Friend f) => onMemberJoined?.Invoke(f);
    void HandleMemberLeft  (Lobby _, Friend f) => onMemberLeft?.Invoke(f);
    void HandleGameCreated  (Lobby _, uint __, ushort ___, SteamId ____) =>
        onGameStarting?.Invoke();
}`;

const networkBridgeCode = `using PurrNet;
using Steamworks;
using UnityEngine;

/// <summary>
/// Bridges Steam lobby signals to PurrNet startup.
/// Attach to the same GameObject as NetworkManager.
///
/// When the host calls lobby.SetGameServer():
///   Host  → starts PurrNet server + joins as client
///   Guest → connects PurrNet to host's SteamId via Steam P2P
/// </summary>
public class SteamNetworkBridge : NetworkBehaviour
{
    [SerializeField] private SteamLobbyManager _lobby;
    [SerializeField] private NetworkManager    _networkManager;
    [SerializeField] private string            _gameScene = "GameScene";

    void OnEnable()  => _lobby.onGameStarting += HandleGameStarting;
    void OnDisable() => _lobby.onGameStarting -= HandleGameStarting;

    // ── Called on ALL clients when host fires SetGameServer() ─────────────
    void HandleGameStarting()
    {
        if (_lobby.IsHost)
        {
            // Host becomes the PurrNet server AND a client
            _networkManager.StartServer();
            _networkManager.StartClient();
        }
        else
        {
            // Guests connect to host via Steam P2P transport
            // PurrNet's Steam transport uses the SteamId as the address
            SteamId hostId = _lobby.CurrentLobby.Owner.Id;
            _networkManager.Connect(hostId.ToString());
        }
    }

    // ── After server is running: load the game scene for all clients ───────
    protected override void OnSpawned(bool asServer)
    {
        if (asServer)
            NetworkManager.LoadScene(_gameScene);
    }
}`;

const titleSceneSetupCode = `// TitleSceneManager.cs
// Attach to a single GameObject in your Title / Boot scene.
using UnityEngine;
using UnityEngine.SceneManagement;

public class TitleSceneManager : MonoBehaviour
{
    [SerializeField] private SteamInitializer _steamInit;
    [SerializeField] private GameObject       _offlineWarning;
    [SerializeField] private string           _mainMenuScene = "MainMenu";

    void Awake()
    {
        _steamInit.onSteamReady  += OnSteamReady;
        _steamInit.onSteamFailed += OnSteamFailed;
    }

    void OnSteamReady()
    {
        // Hide any "Steam not running" UI
        _offlineWarning.SetActive(false);
        // Proceed to main menu — fetch avatar here or after scene load
        SceneManager.LoadScene(_mainMenuScene);
    }

    void OnSteamFailed()
    {
        // Show offline warning; player can retry or quit
        _offlineWarning.SetActive(true);
    }
}`;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SteamConnectionWorkflowPage() {
  return (
    <DocPage
      title="Steam Connection Workflow"
      description="Step-by-step guide to integrating PurrNet with Facepunch.Steamworks: offline boot, player identity, lobby creation, party management, and P2P game start."
      href="/docs/steam-connection-workflow"
    >
      <BilingualContent
        en={
          <>
            {/* ── Overview ── */}
            <p>
              This guide walks you through connecting <strong>PurrNet</strong> with{" "}
              <strong>Facepunch.Steamworks</strong> step by step: booting the Steam client offline,
              fetching the player&rsquo;s Steam identity, creating a friends-only lobby, managing
              party slots, and finally handing the network connection off to PurrNet via Steam P2P
              transport so your game scene can load with everyone connected.
            </p>

            <Callout type="info">
              This workflow assumes <strong>Facepunch.Steamworks</strong> (the managed C# wrapper —
              not the raw Steamworks.NET). Install it via the Unity Package Manager or drop the DLL
              into your Plugins folder. Your game must also be registered on Steamworks and have a
              valid AppId.
            </Callout>

            {/* ── Flow visualizer ── */}
            <div className="not-prose my-6">
              <SteamConnectionFlowViz />
            </div>

            {/* ── Prerequisites ── */}
            <h2>Prerequisites</h2>
            <ul>
              <li>Unity 6 (or 2022 LTS) with PurrNet installed</li>
              <li>Facepunch.Steamworks package imported</li>
              <li>A valid Steamworks AppId (use <code>480</code> for local testing — Spacewar)</li>
              <li>Steam client running on the developer machine</li>
              <li>PurrNet&rsquo;s <strong>Steam transport</strong> added to your NetworkManager</li>
            </ul>

            <Callout type="warning">
              AppId <code>480</code> (Spacewar) is only for development testing. Before shipping,
              replace it with your real AppId and ensure your{" "}
              <code>steam_appid.txt</code> file in the project root contains that AppId.
            </Callout>

            {/* ── Scene Architecture ── */}
            <h2>Scene Architecture</h2>
            <p>
              The workflow spans three scenes. Keep <strong>SteamInitializer</strong> and{" "}
              <strong>SteamLobbyManager</strong> on DontDestroyOnLoad objects so they survive scene
              loads.
            </p>
            <ul>
              <li>
                <strong>Title / Boot Scene</strong> — offline startup, Steam init,
                optional offline warning UI
              </li>
              <li>
                <strong>Main Menu Scene</strong> — fetch player avatar, show lobby UI,
                create / join party
              </li>
              <li>
                <strong>Game Scene</strong> — loaded by PurrNet after the host calls{" "}
                <code>SetGameServer()</code>; all players arrive connected
              </li>
            </ul>

            {/* ── Step 1: SteamInitializer ── */}
            <h2>Step 1 — SteamInitializer (Title Scene)</h2>
            <p>
              Create a <strong>DontDestroyOnLoad</strong> GameObject in the Title scene and attach{" "}
              <code>SteamInitializer</code>. It calls <code>SteamClient.Init()</code> in{" "}
              <code>Awake</code>, stores the local SteamId + name, and exposes two UnityEvents for
              the title scene to react to.
            </p>
            <div className="not-prose">
              <CodeBlock code={steamInitializerCode} language="csharp" filename="SteamInitializer.cs" />
            </div>

            <div className="not-prose mt-4">
              <CodeBlock code={titleSceneSetupCode} language="csharp" filename="TitleSceneManager.cs" />
            </div>

            <Callout type="tip">
              Always call <code>SteamClient.RunCallbacks()</code> in <code>Update()</code>.
              Without it, none of the event callbacks (lobby member joined, game created, etc.)
              will ever fire.
            </Callout>

            <h3>SteamInitializer API</h3>
            <div className="not-prose">
              <ParamTable params={steamInitParamsEN} />
            </div>

            {/* ── Step 2: Fetch Player ── */}
            <h2>Step 2 — Fetch Steam Player Data</h2>
            <p>
              Once <code>onSteamReady</code> fires, load the Main Menu scene and immediately fetch
              the player&rsquo;s persona name and avatar. The name is available synchronously; the
              avatar requires an async call to <code>SteamFriends.GetLargeAvatarAsync()</code>.
            </p>
            <div className="not-prose">
              <CodeBlock code={fetchPlayerCode} language="csharp" filename="SteamPlayerFetcher.cs" />
            </div>

            <Callout type="info">
              Steam stores pixel rows top-down while Unity Texture2D expects bottom-up.
              The <code>img.Height - y - 1</code> flip in <code>ConvertToTexture2D</code> is
              mandatory — omitting it produces an upside-down avatar.
            </Callout>

            {/* ── Step 3: Lobby Manager ── */}
            <h2>Step 3 — Create and Join a Steam Lobby</h2>
            <p>
              <code>SteamLobbyManager</code> handles all lobby operations for both host and guest.
              The host calls <code>CreateLobby()</code>; guests are invited through Steam and their
              client auto-calls <code>JoinLobby()</code> when the invite is accepted.
            </p>
            <div className="not-prose">
              <CodeBlock code={lobbyManagerCode} language="csharp" filename="SteamLobbyManager.cs" />
            </div>

            <h3>Lobby API Reference</h3>
            <div className="not-prose">
              <ParamTable params={lobbyParamsEN} />
            </div>

            {/* ── Interactive Lobby ── */}
            <h2>Interactive Lobby Simulator</h2>
            <p>
              Try it yourself — simulate friends joining, set max players, mark everyone ready, and
              press Start Game to see the handoff flow.
            </p>
            <div className="not-prose my-4">
              <SteamLobbyViz />
            </div>

            {/* ── Step 4: Network Bridge ── */}
            <h2>Step 4 — SteamNetworkBridge (PurrNet Handoff)</h2>
            <p>
              When the host calls <code>lobby.SetGameServer(SteamClient.SteamId)</code>, Steam fires{" "}
              <code>OnLobbyGameCreated</code> on every member simultaneously.{" "}
              <code>SteamNetworkBridge</code> listens to the <code>onGameStarting</code> event from{" "}
              <code>SteamLobbyManager</code> and starts PurrNet accordingly: the host becomes the
              server, guests connect via Steam P2P.
            </p>
            <div className="not-prose">
              <CodeBlock code={networkBridgeCode} language="csharp" filename="SteamNetworkBridge.cs" />
            </div>

            <Callout type="tip">
              PurrNet&rsquo;s Steam transport accepts a SteamId string as the connection address.
              You do not need to know the host&rsquo;s IP — Steam P2P handles routing automatically
              through the Steam relay network.
            </Callout>

            <Callout type="warning">
              <strong>Host migration is not automatic.</strong> If the host disconnects mid-game
              you must either: (a) promote a guest to host and call{" "}
              <code>NetworkManager.StartServer()</code> on their machine, or (b) use a dedicated
              server. Plan for this before shipping.
            </Callout>

            {/* ── Best Practices ── */}
            <h2>Best Practices</h2>

            <Callout type="tip">
              Keep <code>SteamInitializer</code> and <code>SteamLobbyManager</code> on separate
              DontDestroyOnLoad GameObjects. Mixing them onto a single object makes it impossible
              to destroy the lobby without also destroying the Steam init state.
            </Callout>

            <Callout type="tip">
              Set lobby metadata (<code>SetData</code>) for game version and mode before sending
              invites. Friends can read this from the invite overlay and decide whether to join
              before your server wastes a slot.
            </Callout>

            <Callout type="danger">
              Never call <code>SteamClient.Init()</code> more than once per process. Unity will
              enter playmode and stop it many times in the editor — guard Init with a static bool
              or check <code>SteamClient.IsValid</code> first.
            </Callout>

            <Callout type="danger">
              Do not ship with AppId <code>480</code> (Spacewar). Any live Steam player could
              accidentally join your lobby. Replace with your real AppId before any public build.
            </Callout>
          </>
        }
        th={
          <>
            {/* ── Overview TH ── */}
            <p>
              คู่มือนี้จะพาคุณเชื่อมต่อ <strong>PurrNet</strong> กับ{" "}
              <strong>Facepunch.Steamworks</strong> ทีละขั้นตอน ตั้งแต่การบูต Steam client แบบ
              offline การดึงข้อมูล Steam identity ของผู้เล่น การสร้าง lobby แบบ friends-only
              การจัดการ party slot ไปจนถึงการส่งมอบการเชื่อมต่อเครือข่ายให้ PurrNet ผ่าน Steam P2P
              transport เพื่อให้ทุกคนเชื่อมต่อกันก่อนโหลด game scene
            </p>

            <Callout type="info">
              คู่มือนี้ใช้ <strong>Facepunch.Steamworks</strong> (C# wrapper) ไม่ใช่ Steamworks.NET
              ติดตั้งผ่าน Unity Package Manager หรือนำ DLL วางใน Plugins folder เกมต้องลงทะเบียนใน
              Steamworks และมี AppId ที่ถูกต้อง
            </Callout>

            {/* ── Flow visualizer ── */}
            <div className="not-prose my-6">
              <SteamConnectionFlowViz />
            </div>

            {/* ── Prerequisites TH ── */}
            <h2>สิ่งที่ต้องมีก่อน</h2>
            <ul>
              <li>Unity 6 (หรือ 2022 LTS) ติดตั้ง PurrNet แล้ว</li>
              <li>Import package Facepunch.Steamworks แล้ว</li>
              <li>AppId Steamworks ที่ถูกต้อง (ใช้ <code>480</code> สำหรับทดสอบในเครื่อง — Spacewar)</li>
              <li>Steam client รันอยู่บนเครื่อง developer</li>
              <li>เพิ่ม <strong>Steam transport</strong> ของ PurrNet ให้กับ NetworkManager แล้ว</li>
            </ul>

            <Callout type="warning">
              AppId <code>480</code> (Spacewar) ใช้ได้เฉพาะสำหรับทดสอบในการพัฒนา ก่อน ship
              ให้เปลี่ยนเป็น AppId จริงของคุณ และตรวจสอบให้แน่ใจว่าไฟล์{" "}
              <code>steam_appid.txt</code> ใน project root มี AppId นั้น
            </Callout>

            {/* ── Scene Architecture TH ── */}
            <h2>โครงสร้าง Scene</h2>
            <p>
              workflow นี้ครอบคลุม 3 scene เก็บ <strong>SteamInitializer</strong> และ{" "}
              <strong>SteamLobbyManager</strong> ไว้บน DontDestroyOnLoad เพื่อให้อยู่รอดข้าม
              scene load
            </p>
            <ul>
              <li>
                <strong>Title / Boot Scene</strong> — เริ่มต้นแบบ offline, Steam init,
                UI แจ้งเตือนกรณี offline
              </li>
              <li>
                <strong>Main Menu Scene</strong> — ดึง avatar ผู้เล่น, แสดง lobby UI,
                สร้าง / เข้าร่วม party
              </li>
              <li>
                <strong>Game Scene</strong> — โหลดโดย PurrNet หลัง host เรียก{" "}
                <code>SetGameServer()</code>; ทุกคนมาถึงพร้อมเชื่อมต่อ
              </li>
            </ul>

            {/* ── Step 1 TH ── */}
            <h2>ขั้นตอนที่ 1 — SteamInitializer (Title Scene)</h2>
            <p>
              สร้าง GameObject แบบ DontDestroyOnLoad ใน Title scene และ attach{" "}
              <code>SteamInitializer</code> จะเรียก <code>SteamClient.Init()</code> ใน{" "}
              <code>Awake</code> เก็บ SteamId + ชื่อ และ expose UnityEvents สองตัวให้ title scene
              ตอบสนอง
            </p>
            <div className="not-prose">
              <CodeBlock code={steamInitializerCode} language="csharp" filename="SteamInitializer.cs" />
            </div>
            <div className="not-prose mt-4">
              <CodeBlock code={titleSceneSetupCode} language="csharp" filename="TitleSceneManager.cs" />
            </div>

            <Callout type="tip">
              ต้องเรียก <code>SteamClient.RunCallbacks()</code> ใน <code>Update()</code> เสมอ
              ถ้าไม่เรียก event callback ต่าง ๆ (lobby member joined, game created ฯลฯ) จะไม่ทำงานเลย
            </Callout>

            <h3>Steam Initializer API</h3>
            <div className="not-prose">
              <ParamTable params={steamInitParamsTH} />
            </div>

            {/* ── Step 2 TH ── */}
            <h2>ขั้นตอนที่ 2 — ดึงข้อมูล Steam Player</h2>
            <p>
              เมื่อ <code>onSteamReady</code> ยิง ให้โหลด Main Menu scene และดึง persona name +
              avatar ของผู้เล่นทันที ชื่อดึงได้แบบ synchronous ส่วน avatar ต้องเรียก async ผ่าน{" "}
              <code>SteamFriends.GetLargeAvatarAsync()</code>
            </p>
            <div className="not-prose">
              <CodeBlock code={fetchPlayerCode} language="csharp" filename="SteamPlayerFetcher.cs" />
            </div>

            <Callout type="info">
              Steam เก็บ pixel แบบ top-down ส่วน Unity Texture2D ต้องการ bottom-up การ flip{" "}
              <code>img.Height - y - 1</code> ใน <code>ConvertToTexture2D</code> จำเป็นต้องทำ
              ถ้าข้ามจะได้ avatar หัวกลับ
            </Callout>

            {/* ── Step 3 TH ── */}
            <h2>ขั้นตอนที่ 3 — สร้างและเข้าร่วม Steam Lobby</h2>
            <p>
              <code>SteamLobbyManager</code> จัดการ lobby operation ทั้งหมดทั้ง host และ guest
              host เรียก <code>CreateLobby()</code>; guest รับ invite ผ่าน Steam และ client
              auto-เรียก <code>JoinLobby()</code> เมื่อยอมรับ invite
            </p>
            <div className="not-prose">
              <CodeBlock code={lobbyManagerCode} language="csharp" filename="SteamLobbyManager.cs" />
            </div>

            <h3>Lobby API Reference</h3>
            <div className="not-prose">
              <ParamTable params={lobbyParamsTH} />
            </div>

            {/* ── Interactive Lobby TH ── */}
            <h2>ทดลอง Lobby Simulator</h2>
            <p>
              ลองด้วยตัวเอง — จำลองเพื่อนเข้าร่วม ตั้ง max player, กด ready ทุกคน
              แล้วกด Start Game เพื่อดูขั้นตอนการส่งมอบ
            </p>
            <div className="not-prose my-4">
              <SteamLobbyViz />
            </div>

            {/* ── Step 4 TH ── */}
            <h2>ขั้นตอนที่ 4 — SteamNetworkBridge (PurrNet Handoff)</h2>
            <p>
              เมื่อ host เรียก <code>lobby.SetGameServer(SteamClient.SteamId)</code> Steam ยิง{" "}
              <code>OnLobbyGameCreated</code> บนสมาชิกทุกคนพร้อมกัน{" "}
              <code>SteamNetworkBridge</code> รับฟัง event <code>onGameStarting</code> จาก{" "}
              <code>SteamLobbyManager</code> และเริ่ม PurrNet: host กลายเป็น server
              ส่วน guest เชื่อมต่อผ่าน Steam P2P
            </p>
            <div className="not-prose">
              <CodeBlock code={networkBridgeCode} language="csharp" filename="SteamNetworkBridge.cs" />
            </div>

            <Callout type="tip">
              PurrNet Steam transport รับ SteamId string เป็น connection address
              ไม่จำเป็นต้องรู้ IP ของ host เพราะ Steam P2P จัดการ routing ผ่าน Steam relay network
              โดยอัตโนมัติ
            </Callout>

            <Callout type="warning">
              <strong>Host migration ไม่ทำงานอัตโนมัติ</strong> ถ้า host disconnect ระหว่างเกม
              คุณต้องจัดการเอง: (a) promote guest ขึ้นเป็น host แล้วเรียก{" "}
              <code>NetworkManager.StartServer()</code> บนเครื่องนั้น หรือ (b) ใช้ dedicated server
              วางแผนรับมือก่อน ship
            </Callout>

            {/* ── Best Practices TH ── */}
            <h2>Best Practices</h2>

            <Callout type="tip">
              เก็บ <code>SteamInitializer</code> และ <code>SteamLobbyManager</code> ไว้บน
              DontDestroyOnLoad แยกกัน ถ้ารวมกัน GameObject เดียวจะทำลาย lobby โดยไม่ตั้งใจเมื่อ
              destroy Steam init state
            </Callout>

            <Callout type="tip">
              ตั้ง lobby metadata (<code>SetData</code>) สำหรับ game version และ mode ก่อนส่ง invite
              เพื่อนสามารถอ่านจาก invite overlay และตัดสินใจว่าจะ join หรือไม่ก่อน server เสีย slot
            </Callout>

            <Callout type="danger">
              ห้ามเรียก <code>SteamClient.Init()</code> มากกว่าหนึ่งครั้งต่อ process ใน editor
              Unity จะเข้าและออก playmode หลายครั้ง — ป้องกัน Init ด้วย static bool หรือตรวจ{" "}
              <code>SteamClient.IsValid</code> ก่อน
            </Callout>

            <Callout type="danger">
              ห้าม ship ด้วย AppId <code>480</code> (Spacewar) เพราะ Steam player ทุกคนอาจเข้า
              lobby ของคุณโดยไม่ตั้งใจ เปลี่ยนเป็น AppId จริงก่อน build สาธารณะทุกครั้ง
            </Callout>
          </>
        }
      />
    </DocPage>
  );
}
