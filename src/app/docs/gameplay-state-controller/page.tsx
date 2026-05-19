import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { CityPhaseMindMap, DungeonPhaseMindMap } from "@/components/visualizers/ComponentMindMapVisualizer";
import { GameplayStateMachineViz } from "@/components/visualizers/GameplayStateMachineViz";

export const metadata = { title: "Gameplay State Controller" };

// ── API tables ─────────────────────────────────────────────────────────────────

const apiParamsEN = [
  { name: "CmdProposeDungeon(string dungeonId)", type: "[ServerRpc] void",        description: "Any client proposes a dungeon. Server opens a vote session via VoteController." },
  { name: "CmdCastVote(bool approve)",           type: "[ServerRpc] void",        description: "Cast YES or NO. RPCInfo provides caller identity — each player votes once." },
  { name: "CmdReportFightEnd()",                 type: "[ServerRpc] void",        description: "FightController calls this when all enemies are cleared. Advances dungeon phase to EndFight." },
  { name: "onStateChanged",                      type: "event Action<GameState>", description: "Fires on all clients whenever city/dungeon state changes." },
  { name: "onPhaseChanged",                      type: "event Action<DungeonPhase>", description: "Fires on all clients whenever the dungeon phase advances." },
  { name: "onVoteChanged",                       type: "event Action<VoteSnapshot>", description: "Fires on all clients with the current vote tally whenever a player votes." },
];

const apiParamsTH = [
  { name: "CmdProposeDungeon(string dungeonId)", type: "[ServerRpc] void",           description: "Client ใดก็ได้เสนอ dungeon server เปิด vote session ผ่าน VoteController" },
  { name: "CmdCastVote(bool approve)",           type: "[ServerRpc] void",           description: "ลงคะแนน YES หรือ NO RPCInfo ระบุตัวตนผู้เรียก — แต่ละ player โหวตได้ครั้งเดียว" },
  { name: "CmdReportFightEnd()",                 type: "[ServerRpc] void",           description: "FightController เรียกเมื่อ enemy ทั้งหมดถูกกำจัด เลื่อน phase ไป EndFight" },
  { name: "onStateChanged",                      type: "event Action<GameState>",    description: "ทำงานบน clients ทั้งหมดเมื่อ city/dungeon state เปลี่ยน" },
  { name: "onPhaseChanged",                      type: "event Action<DungeonPhase>", description: "ทำงานบน clients ทั้งหมดเมื่อ dungeon phase เลื่อน" },
  { name: "onVoteChanged",                       type: "event Action<VoteSnapshot>", description: "ทำงานบน clients ทั้งหมดพร้อมคะแนนโหวตปัจจุบันทุกครั้งที่ player โหวต" },
];

// ── C# code ────────────────────────────────────────────────────────────────────

const dungeonDataCode = `using UnityEngine;

/// <summary>
/// Static configuration for one dungeon type.
/// Create via Assets → Create → PurrNet → DungeonData.
/// </summary>
[CreateAssetMenu(menuName = "PurrNet/DungeonData", fileName = "NewDungeonData")]
public class DungeonData : ScriptableObject
{
    /// <summary>Display name shown in MapUI and vote prompt.</summary>
    [field: SerializeField] public string DungeonName       { get; private set; } = "Dungeon";

    /// <summary>Unity scene name to load for this dungeon.</summary>
    [field: SerializeField] public string SceneName         { get; private set; } = "DungeonScene";

    /// <summary>Minimum connected players required before a vote can start.</summary>
    [field: SerializeField] public int    MinPlayers        { get; private set; } = 2;

    /// <summary>Seconds the vote window stays open before auto-failing.</summary>
    [field: SerializeField] public float  VoteDuration      { get; private set; } = 15f;

    /// <summary>Countdown (seconds) shown during the Prepare phase before voting opens.</summary>
    [field: SerializeField] public float  PrepareCountdown  { get; private set; } = 10f;

    /// <summary>Seconds of the EndFight celebration before the next-area vote opens.</summary>
    [field: SerializeField] public float  EndFightDelay     { get; private set; } = 5f;
}`;

const gameStateCode = `using PurrNet;
using System;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Top-level state machine: City ↔ Dungeon.
/// Owns scene-load authority and responds to VoteController results.
/// </summary>
public enum GameState { City, VotingDungeon, LoadingDungeon, InDungeon }

public class GameStateManager : NetworkBehaviour
{
    [SerializeField] private DungeonData[] _availableDungeons;

    private SyncVar<GameState> _state           = new(GameState.City);
    private SyncVar<string>    _selectedDungeon = new(string.Empty);

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    /// <summary>Fires on ALL clients when the top-level state changes.</summary>
    public event Action<GameState> onStateChanged;

    public GameState CurrentState => _state.value;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        _state.onChanged += (_, s) => onStateChanged?.Invoke(s);
    }

    // -----------------------------------------------------------------------
    // Called by VoteController when a dungeon vote passes
    // -----------------------------------------------------------------------

    /// <summary>
    /// Transition to LoadingDungeon and tell all clients to load the scene.
    /// Only the server should call this — triggered internally by VoteController.
    /// </summary>
    public void LoadDungeon(string dungeonId)
    {
        if (!isServer) return;

        _selectedDungeon.value = dungeonId;
        _state.value           = GameState.LoadingDungeon;

        DungeonData data = System.Array.Find(_availableDungeons, d => d.DungeonName == dungeonId);
        if (data != null)
            RpcLoadScene(data.SceneName);
    }

    /// <summary>
    /// Tells every client to load the dungeon scene.
    /// PurrNet unloads the city scene automatically on the server.
    /// </summary>
    [ObserversRpc]
    private void RpcLoadScene(string sceneName)
    {
        SceneManager.LoadSceneAsync(sceneName);
    }

    /// <summary>Called by DungeonStateManager when the dungeon run ends.</summary>
    public void ReturnToCity()
    {
        if (!isServer) return;
        _state.value = GameState.City;
        RpcLoadScene("CityScene");
    }
}`;

const voteControllerCode = `using PurrNet;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>Snapshot of one vote session sent to all clients on every change.</summary>
public readonly struct VoteSnapshot
{
    public readonly int Yes;
    public readonly int No;
    public readonly int Total;
    public readonly bool IsOpen;

    public VoteSnapshot(int yes, int no, int total, bool isOpen)
    {
        Yes = yes; No = no; Total = total; IsOpen = isOpen;
    }
}

/// <summary>
/// Generic multiplayer vote.
/// DungeonSelector and DungeonStateManager start votes;
/// all connected players cast YES/NO via CmdCastVote.
/// </summary>
public class VoteController : NetworkBehaviour
{
    // Stores one vote per playerId. Automatically replicated to all observers.
    private SyncDictionary<string, bool> _votes  = new();
    private SyncVar<bool>                _isOpen = new(false);

    private Coroutine _timeoutCoroutine;

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    /// <summary>
    /// Fires on ALL clients whenever a vote is cast or the session opens/closes.
    /// Parameters: current vote snapshot.
    /// </summary>
    public event Action<VoteSnapshot> onVoteChanged;

    /// <summary>
    /// Fires on the SERVER ONLY when the vote session closes with a result.
    /// Parameters: (passed).
    /// </summary>
    public event Action<bool> onVoteComplete;

    // -----------------------------------------------------------------------
    // Server API — called by DungeonSelector or DungeonStateManager
    // -----------------------------------------------------------------------

    /// <summary>Opens a new vote session for <paramref name="durationSeconds"/> seconds.</summary>
    public void StartVote(float durationSeconds)
    {
        if (!isServer) return;

        _votes.Clear();
        _isOpen.value = true;
        BroadcastSnapshot();

        _timeoutCoroutine = StartCoroutine(VoteTimeout(durationSeconds));
    }

    // -----------------------------------------------------------------------
    // ServerRpc — any connected player can vote
    // -----------------------------------------------------------------------

    /// <summary>
    /// Cast a YES or NO. Each player may vote once per session.
    /// Server ignores duplicate votes from the same connection.
    /// </summary>
    [ServerRpc(requireOwnership: false)]
    public void CmdCastVote(bool approve, RPCInfo info = default)
    {
        if (!_isOpen.value) return;

        string playerId = info.sender.ToString();
        _votes[playerId] = approve;  // SyncDictionary replicates immediately

        BroadcastSnapshot();
        TryResolve();
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    private void BroadcastSnapshot()
    {
        int yes = 0, no = 0;
        foreach (var v in _votes.Values) { if (v) yes++; else no++; }
        RpcUpdateUI(new VoteSnapshot(yes, no, _votes.Count, _isOpen.value));
    }

    [ObserversRpc]
    private void RpcUpdateUI(VoteSnapshot snap)
    {
        onVoteChanged?.Invoke(snap);
    }

    private void TryResolve()
    {
        // Resolve immediately when every player has voted
        if (_votes.Count < NetworkManager.connectedCount) return;

        int yes = 0;
        foreach (var v in _votes.Values) if (v) yes++;
        CloseVote(yes > _votes.Count / 2);
    }

    private IEnumerator VoteTimeout(float seconds)
    {
        yield return new WaitForSeconds(seconds);
        if (!_isOpen.value) yield break;

        int yes = 0;
        foreach (var v in _votes.Values) if (v) yes++;
        CloseVote(yes > _votes.Count / 2);
    }

    private void CloseVote(bool passed)
    {
        if (_timeoutCoroutine != null) StopCoroutine(_timeoutCoroutine);
        _isOpen.value = false;
        BroadcastSnapshot();
        onVoteComplete?.Invoke(passed);
    }
}`;

const dungeonSelectorCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// Runs in the City scene.
/// Lets any player propose a dungeon; opens a vote via VoteController;
/// tells GameStateManager to load the dungeon when the vote passes.
/// </summary>
public class DungeonSelector : NetworkBehaviour
{
    [SerializeField] private DungeonData[]     _dungeons;
    [SerializeField] private VoteController    _vote;
    [SerializeField] private GameStateManager  _gsm;

    private string _proposedId = string.Empty;

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        if (asServer)
            _vote.onVoteComplete += HandleVoteResult;
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        if (asServer)
            _vote.onVoteComplete -= HandleVoteResult;
    }

    // -----------------------------------------------------------------------
    // Called from MapUI button
    // -----------------------------------------------------------------------

    /// <summary>
    /// Propose a dungeon for the group to vote on.
    /// Opens a vote prompt on all clients.
    /// </summary>
    [ServerRpc(requireOwnership: false)]
    public void CmdProposeDungeon(string dungeonId, RPCInfo info = default)
    {
        // Ignore proposals if a vote is already running
        if (_gsm.CurrentState != GameState.City) return;

        _proposedId = dungeonId;

        DungeonData data = System.Array.Find(_dungeons, d => d.DungeonName == dungeonId);
        if (data == null) return;

        _vote.StartVote(data.VoteDuration);
    }

    // -----------------------------------------------------------------------
    // Server-side: react to vote result
    // -----------------------------------------------------------------------

    private void HandleVoteResult(bool passed)
    {
        if (passed && !string.IsNullOrEmpty(_proposedId))
            _gsm.LoadDungeon(_proposedId);

        _proposedId = string.Empty;
    }
}`;

const dungeonStateManagerCode = `using PurrNet;
using System;
using System.Collections;
using UnityEngine;

/// <summary>Phases inside one dungeon run.</summary>
public enum DungeonPhase
{
    Prepare,       // Countdown before voting opens
    VoteToStart,   // Players vote to begin the fight
    Fighting,      // Enemies active; FightController is responsible
    EndFight,      // Brief celebration before next-area vote
    VoteNextArea,  // Players vote to continue or exit
}

/// <summary>
/// Server-authoritative state machine for the dungeon run.
/// Drives VoteController for the two vote phases and FightController
/// for the fight phase. Loops: VoteNextArea → Prepare (next area)
/// or exits back to city when the group votes NO.
/// </summary>
public class DungeonStateManager : NetworkBehaviour
{
    [SerializeField] private DungeonData      _data;
    [SerializeField] private VoteController   _vote;
    [SerializeField] private FightController  _fight;
    [SerializeField] private GameStateManager _gsm;

    private SyncVar<DungeonPhase> _phase = new(DungeonPhase.Prepare);

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    /// <summary>Fires on ALL clients when the dungeon phase changes.</summary>
    public event Action<DungeonPhase> onPhaseChanged;

    public DungeonPhase CurrentPhase => _phase.value;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        _phase.onChanged += (_, p) => onPhaseChanged?.Invoke(p);

        if (asServer)
        {
            _vote.onVoteComplete  += HandleVoteResult;
            _fight.onAreaCleared  += HandleAreaCleared;
            StartCoroutine(RunPreparePhase());
        }
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        if (asServer)
        {
            _vote.onVoteComplete  -= HandleVoteResult;
            _fight.onAreaCleared  -= HandleAreaCleared;
        }
    }

    // -----------------------------------------------------------------------
    // Phase coroutines — server only
    // -----------------------------------------------------------------------

    private IEnumerator RunPreparePhase()
    {
        _phase.value = DungeonPhase.Prepare;
        yield return new WaitForSeconds(_data.PrepareCountdown);

        _phase.value = DungeonPhase.VoteToStart;
        _vote.StartVote(_data.VoteDuration);
        // Waits for onVoteComplete → HandleVoteResult
    }

    private IEnumerator RunEndFightPhase()
    {
        _phase.value = DungeonPhase.EndFight;
        yield return new WaitForSeconds(_data.EndFightDelay);

        _phase.value = DungeonPhase.VoteNextArea;
        _vote.StartVote(_data.VoteDuration);
        // Waits for onVoteComplete → HandleVoteResult
    }

    // -----------------------------------------------------------------------
    // Event handlers — server only
    // -----------------------------------------------------------------------

    private void HandleVoteResult(bool passed)
    {
        switch (_phase.value)
        {
            case DungeonPhase.VoteToStart:
                if (passed)
                {
                    _phase.value = DungeonPhase.Fighting;
                    _fight.ActivateArea();
                }
                else
                {
                    // Failed to agree — re-open prepare phase
                    StartCoroutine(RunPreparePhase());
                }
                break;

            case DungeonPhase.VoteNextArea:
                if (passed)
                    StartCoroutine(RunPreparePhase()); // next area
                else
                    _gsm.ReturnToCity();
                break;
        }
    }

    private void HandleAreaCleared()
    {
        if (_phase.value != DungeonPhase.Fighting) return;
        StartCoroutine(RunEndFightPhase());
    }
}`;

const fightControllerCode = `using PurrNet;
using System;
using UnityEngine;

/// <summary>
/// Manages enemies and objectives during the Fighting phase.
/// When all enemies are cleared it raises onAreaCleared so
/// DungeonStateManager can advance to EndFight.
/// </summary>
public class FightController : NetworkBehaviour
{
    [SerializeField] private DungeonData _data;

    private SyncVar<int> _enemiesRemaining = new(0);

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    /// <summary>Fires on the SERVER when every enemy in the area is dead.</summary>
    public event Action onAreaCleared;

    /// <summary>Fires on ALL clients when the enemy count changes.</summary>
    public event Action<int> onEnemyCountChanged;

    // -----------------------------------------------------------------------
    // Called by DungeonStateManager when the Fighting phase begins
    // -----------------------------------------------------------------------

    /// <summary>Spawns enemies for the current area and starts tracking kills.</summary>
    public void ActivateArea()
    {
        if (!isServer) return;

        // TODO: spawn enemies from _data.EnemyWaves[currentWave]
        _enemiesRemaining.value = 10; // placeholder
        _enemiesRemaining.onChanged += (_, n) =>
        {
            onEnemyCountChanged?.Invoke(n);
            if (n <= 0) onAreaCleared?.Invoke();
        };
    }

    // -----------------------------------------------------------------------
    // ServerRpc — enemies (or any game object) call this on death
    // -----------------------------------------------------------------------

    /// <summary>
    /// Report one enemy killed. No ownership required — traps, AoE,
    /// and other players can all trigger this.
    /// </summary>
    [ServerRpc(requireOwnership: false)]
    public void CmdReportEnemyKilled(RPCInfo info = default)
    {
        if (_enemiesRemaining.value <= 0) return;
        _enemiesRemaining.value--;
    }
}`;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Gameplay State Controller"
          description="A networked game loop spanning two scenes: a City map where players vote to enter a dungeon, and a Dungeon scene with a five-phase state machine — Prepare, Vote to Start, Fight, End Fight, and Vote for Next Area."
          badge="Example"
          href="/docs/gameplay-state-controller"
        >
          {/* ── Overview ── */}
          <div className="prose">
            <h2>Overview — two scenes, one game loop</h2>
            <p>
              This example teaches how to coordinate multiplayer game state across scene boundaries.
              The system has two distinct runtime phases:
            </p>
            <ul>
              <li>
                <strong>City Phase</strong> — players browse a map, select a dungeon, and vote as a
                group. When the vote passes, the server loads the dungeon scene for everyone.
              </li>
              <li>
                <strong>Dungeon Phase</strong> — a five-state machine runs on the server:
                a prepare countdown, a vote to start the fight, the fight itself, a celebration
                window, then a vote to continue or leave.
              </li>
            </ul>
            <p>
              All state lives on the server and replicates via <code>SyncVar</code> and{" "}
              <code>SyncDictionary</code>. Clients display whatever the server says and send input
              only through <code>[ServerRpc]</code> calls.
            </p>
          </div>

          {/* ── City phase map ── */}
          <div className="prose">
            <h2>City Phase — component map</h2>
          </div>
          <div className="not-prose">
            <CityPhaseMindMap />
          </div>

          {/* ── Dungeon phase map ── */}
          <div className="prose">
            <h2>Dungeon Phase — component map</h2>
          </div>
          <div className="not-prose">
            <DungeonPhaseMindMap />
          </div>

          {/* ── State machine visualizer ── */}
          <div className="prose">
            <h2>Dungeon State Machine</h2>
            <p>
              <code>DungeonStateManager</code> drives five phases in a loop. Press{" "}
              <strong>Play</strong> to animate the cycle, or <strong>Step</strong> / click a node
              to jump to any phase.
            </p>
          </div>
          <div className="not-prose">
            <GameplayStateMachineViz />
          </div>

          {/* ── Script 1 ── */}
          <div className="prose">
            <h2>Script 1 — DungeonData (ScriptableObject)</h2>
            <p>
              A single asset per dungeon type. Holds everything needed to set up a run: the Unity
              scene name, player minimums, vote timers, and phase durations. Creating separate
              assets means designers can add new dungeons without changing any C#.
            </p>
          </div>
          <CodeBlock filename="DungeonData.cs" language="csharp" code={dungeonDataCode} />

          {/* ── Script 2 ── */}
          <div className="prose">
            <h2>Script 2 — GameStateManager (NetworkBehaviour)</h2>
            <p>
              The root coordinator. Owns a <code>SyncVar&lt;GameState&gt;</code> (City,
              VotingDungeon, LoadingDungeon, InDungeon) and holds the authority to load scenes.
              When <code>VoteController</code> reports a passed dungeon vote,{" "}
              <code>DungeonSelector</code> calls <code>LoadDungeon()</code> here, which fires an{" "}
              <code>[ObserversRpc]</code> that makes every client load the dungeon scene.
            </p>
          </div>
          <CodeBlock filename="GameStateManager.cs" language="csharp" code={gameStateCode} />

          {/* ── Script 3 ── */}
          <div className="prose">
            <h2>Script 3 — VoteController (NetworkBehaviour)</h2>
            <p>
              A reusable vote engine used in both phases. It owns a{" "}
              <code>SyncDictionary&lt;string, bool&gt;</code> that maps each player&apos;s
              connection ID to their vote. Any change triggers an <code>[ObserversRpc]</code> that
              broadcasts a <code>VoteSnapshot</code> struct to all clients so the UI can update
              immediately.
            </p>
            <p>
              The server auto-resolves the vote as soon as every connected player has voted, or
              closes it via a timeout coroutine, whichever comes first. The result is sent only
              once through the <code>onVoteComplete</code> event (server-only), so the caller —
              <code>DungeonSelector</code> or <code>DungeonStateManager</code> — can act on it
              without any additional RPC round-trip.
            </p>
          </div>
          <CodeBlock filename="VoteController.cs" language="csharp" code={voteControllerCode} />

          <Callout type="tip">
            <code>VoteController</code> is generic — it does not know whether the vote is for
            a dungeon entry or a next-area decision. This means you can reuse it for any group
            decision in your game (kick vote, difficulty vote, etc.).
          </Callout>

          {/* ── Script 4 ── */}
          <div className="prose">
            <h2>Script 4 — DungeonSelector (NetworkBehaviour)</h2>
            <p>
              Lives in the City scene. When a player taps a dungeon button, <code>MapUI</code>{" "}
              calls <code>CmdProposeDungeon()</code>. The server stores the proposed ID, opens a
              vote, and waits. When <code>onVoteComplete</code> fires on the server with{" "}
              <code>passed = true</code>, it delegates to <code>GameStateManager.LoadDungeon()</code>.
            </p>
          </div>
          <CodeBlock filename="DungeonSelector.cs" language="csharp" code={dungeonSelectorCode} />

          <Callout type="warning">
            Only one dungeon proposal can be active at a time. <code>CmdProposeDungeon</code>{" "}
            returns early if <code>CurrentState != GameState.City</code> — this prevents a second
            player from hijacking the vote mid-session.
          </Callout>

          {/* ── Script 5 ── */}
          <div className="prose">
            <h2>Script 5 — DungeonStateManager (NetworkBehaviour)</h2>
            <p>
              The heart of the dungeon loop. Runs entirely on the server via coroutines. Each
              phase either waits for a timer or for an external event (<code>onVoteComplete</code>{" "}
              or <code>onAreaCleared</code>) before advancing. Because transitions are driven by
              server coroutines and replicated via <code>SyncVar&lt;DungeonPhase&gt;</code>, every
              client sees the correct phase without any additional messaging.
            </p>
            <p>
              The loop: <code>Prepare</code> (countdown) → <code>VoteToStart</code> → if passed,{" "}
              <code>Fighting</code> → <code>EndFight</code> → <code>VoteNextArea</code> → if
              passed, back to <code>Prepare</code> for the next area; if failed, server calls{" "}
              <code>GameStateManager.ReturnToCity()</code>.
            </p>
          </div>
          <CodeBlock filename="DungeonStateManager.cs" language="csharp" code={dungeonStateManagerCode} />

          {/* ── Script 6 ── */}
          <div className="prose">
            <h2>Script 6 — FightController (NetworkBehaviour)</h2>
            <p>
              Tracks enemy count in a <code>SyncVar&lt;int&gt;</code> so every client can display
              a kill counter. When the count reaches zero it fires <code>onAreaCleared</code> on
              the server, which <code>DungeonStateManager</code> has subscribed to.
            </p>
            <p>
              <code>CmdReportEnemyKilled</code> is <code>requireOwnership: false</code> so traps,
              AoE spells, and any other game object can report kills — not just the player who owns
              the FightController.
            </p>
          </div>
          <CodeBlock filename="FightController.cs" language="csharp" code={fightControllerCode} />

          {/* ── API ── */}
          <div className="prose">
            <h2>API Reference</h2>
          </div>
          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          {/* ── Scene Setup ── */}
          <div className="prose">
            <h2>Scene Setup</h2>
            <ol>
              <li>
                Create a <strong>DungeonData</strong> asset per dungeon:{" "}
                <em>Assets → Create → PurrNet → DungeonData</em>. Fill in SceneName, VoteDuration,
                PrepareCountdown, and EndFightDelay.
              </li>
              <li>
                In the <strong>City scene</strong>, create a Manager GameObject and add{" "}
                <code>GameStateManager</code>, <code>DungeonSelector</code>, and{" "}
                <code>VoteController</code>. Register it with PurrNet&apos;s NetworkManager
                as a persistent object (do not destroy on scene load).
              </li>
              <li>
                Add a <strong>MapUI</strong> MonoBehaviour with buttons for each{" "}
                <code>DungeonData</code> asset. Wire button <code>onClick</code> to call{" "}
                <code>DungeonSelector.CmdProposeDungeon(data.DungeonName)</code>.
              </li>
              <li>
                In the <strong>Dungeon scene</strong>, create a Manager GameObject and add{" "}
                <code>DungeonStateManager</code>, <code>VoteController</code>,{" "}
                <code>FightController</code>, and <code>DungeonUI</code>.
              </li>
              <li>
                Wire <code>DungeonStateManager._vote</code> and{" "}
                <code>DungeonStateManager._fight</code> in the Inspector. Assign the matching{" "}
                <code>DungeonData</code> asset to both <code>DungeonStateManager._data</code>{" "}
                and <code>FightController._data</code>.
              </li>
              <li>
                Build the dungeon scene into your Build Settings and make sure its name matches{" "}
                <code>DungeonData.SceneName</code> exactly.
              </li>
            </ol>
          </div>

          {/* ── Best Practices ── */}
          <Callout type="danger">
            Never call <code>SceneManager.LoadSceneAsync</code> from a client directly. All scene
            transitions must go through <code>GameStateManager.RpcLoadScene</code> (an
            ObserversRpc) so every client loads simultaneously. Asynchronous client-only loads
            cause desync.
          </Callout>

          <Callout type="warning">
            <code>VoteController._votes</code> is a <code>SyncDictionary</code>. Call{" "}
            <code>_votes.Clear()</code> at the start of every new vote session (already done in{" "}
            <code>StartVote</code>). Forgetting to clear it means late-joining players inherit
            old vote data.
          </Callout>

          <Callout type="tip">
            To add a spectator UI that shows the current dungeon phase on the city screen while
            other players are inside, subscribe to <code>GameStateManager.onStateChanged</code>{" "}
            and display the last known <code>DungeonPhase</code> via a separate{" "}
            <code>SyncVar</code> on <code>DungeonStateManager</code> that persists across the
            scene boundary.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Gameplay State Controller"
          description="Game loop สำหรับ multiplayer ครอบคลุม 2 scene: City map ที่ผู้เล่นโหวตเข้า dungeon และ Dungeon scene ที่มี state machine 5 phase"
          badge="Example"
          href="/docs/gameplay-state-controller"
        >
          <div className="prose">
            <h2>ภาพรวม — สอง scene, หนึ่ง game loop</h2>
            <p>
              ตัวอย่างนี้สอนการประสาน multiplayer game state ข้าม scene boundaries ระบบมีสอง runtime phase:
            </p>
            <ul>
              <li><strong>City Phase</strong> — ผู้เล่นเลือก dungeon และโหวตเป็นกลุ่ม เมื่อผ่าน server โหลด dungeon scene ให้ทุกคน</li>
              <li><strong>Dungeon Phase</strong> — state machine 5 ขั้นตอนรันบน server: countdown, vote start fight, fight, celebration, vote next area</li>
            </ul>
          </div>

          <div className="prose"><h2>City Phase — component map</h2></div>
          <div className="not-prose"><CityPhaseMindMap /></div>

          <div className="prose"><h2>Dungeon Phase — component map</h2></div>
          <div className="not-prose"><DungeonPhaseMindMap /></div>

          <div className="prose">
            <h2>Dungeon State Machine</h2>
            <p>DungeonStateManager ขับ 5 phase เป็น loop กด Play เพื่อ animate หรือ Step เพื่อกระโดดทีละ phase</p>
          </div>
          <div className="not-prose"><GameplayStateMachineViz /></div>

          <div className="prose"><h2>Script 1 — DungeonData (ScriptableObject)</h2>
            <p>Asset ต่อ dungeon ประเภท เก็บ scene name, player minimum, timer ทั้งหมด สร้างจาก Assets → Create → PurrNet → DungeonData</p>
          </div>
          <CodeBlock filename="DungeonData.cs" language="csharp" code={dungeonDataCode} />

          <div className="prose"><h2>Script 2 — GameStateManager (NetworkBehaviour)</h2>
            <p>Coordinator หลัก ถือ SyncVar&lt;GameState&gt; และ authority ในการโหลด scene เมื่อ VoteController รายงานผล DungeonSelector เรียก LoadDungeon() ที่นี่</p>
          </div>
          <CodeBlock filename="GameStateManager.cs" language="csharp" code={gameStateCode} />

          <div className="prose"><h2>Script 3 — VoteController (NetworkBehaviour)</h2>
            <p>Engine โหวตที่ใช้ซ้ำได้ ถือ SyncDictionary&lt;string, bool&gt; map connection ID → vote ส่ง VoteSnapshot ไปยัง clients ทุกครั้งที่ state เปลี่ยน</p>
          </div>
          <CodeBlock filename="VoteController.cs" language="csharp" code={voteControllerCode} />

          <div className="prose"><h2>Script 4 — DungeonSelector (NetworkBehaviour)</h2>
            <p>อยู่ใน City scene เมื่อผู้เล่นกดปุ่ม dungeon CmdProposeDungeon() เปิด vote session เมื่อผ่านจะเรียก GameStateManager.LoadDungeon()</p>
          </div>
          <CodeBlock filename="DungeonSelector.cs" language="csharp" code={dungeonSelectorCode} />

          <div className="prose"><h2>Script 5 — DungeonStateManager (NetworkBehaviour)</h2>
            <p>หัวใจของ dungeon loop รันบน server ผ่าน coroutines แต่ละ phase รอ timer หรือ event ก่อนเลื่อน replicate ผ่าน SyncVar&lt;DungeonPhase&gt;</p>
          </div>
          <CodeBlock filename="DungeonStateManager.cs" language="csharp" code={dungeonStateManagerCode} />

          <div className="prose"><h2>Script 6 — FightController (NetworkBehaviour)</h2>
            <p>ติดตาม enemy count ใน SyncVar&lt;int&gt; เมื่อถึงศูนย์ fires onAreaCleared บน server ซึ่ง DungeonStateManager subscribe อยู่</p>
          </div>
          <CodeBlock filename="FightController.cs" language="csharp" code={fightControllerCode} />

          <div className="prose"><h2>API Reference</h2></div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>

          <div className="prose">
            <h2>การตั้งค่า Scene</h2>
            <ol>
              <li>สร้าง DungeonData asset ต่อ dungeon กรอก SceneName, VoteDuration, PrepareCountdown, EndFightDelay</li>
              <li>ใน City scene สร้าง Manager GameObject เพิ่ม GameStateManager, DungeonSelector, VoteController</li>
              <li>เพิ่ม MapUI พร้อมปุ่มสำหรับแต่ละ DungeonData ผูก onClick → DungeonSelector.CmdProposeDungeon()</li>
              <li>ใน Dungeon scene เพิ่ม DungeonStateManager, VoteController, FightController, DungeonUI</li>
              <li>ผูก reference ทั้งหมดใน Inspector และตรวจสอบ SceneName ตรงกับ Build Settings</li>
            </ol>
          </div>

          <Callout type="danger">
            อย่าเรียก SceneManager.LoadSceneAsync จาก client โดยตรง ต้องผ่าน GameStateManager.RpcLoadScene เสมอเพื่อให้ทุก client โหลดพร้อมกัน
          </Callout>
        </DocPage>
      }
    />
  );
}
