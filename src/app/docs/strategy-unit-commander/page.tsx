import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { StrategyUnitCommanderViz } from "@/components/visualizers/StrategyUnitCommanderViz";

export const metadata = { title: "Strategy Unit Commander" };

const apiParamsEN = [
  { name: "IssueCommandServerRpc(NetworkId[], CommandData)", type: "ServerRpc", description: "Player sends a batch of unit IDs and a CommandData struct. Server iterates each unit and calls the appropriate command method." },
  { name: "CommandMove(Vector3 destination)", type: "Server method", description: "Server sets the unit's _moveTarget SyncVar and transitions state to Moving. The NavMeshAgent picks up the new destination." },
  { name: "CommandAttack(NetworkId target)", type: "Server method", description: "Server sets _attackTarget and transitions to Attacking state. The unit pursues the target and deals damage server-side." },
  { name: "CommandPatrol(Vector3 a, Vector3 b)", type: "Server method", description: "Server stores two patrol points and sets state to Patrolling. Unit oscillates between points until a new command is issued." },
  { name: "UseSkill(int skillId)", type: "Server method", description: "Looks up the skill from the unit's SkillSet ScriptableObject, validates cooldown, and executes the skill effect on the server." },
  { name: "_state (SyncVar<UnitState>)", type: "SyncVar", description: "The current unit state enum (Idle/Moving/Attacking/Patrolling/Dead). All peers mirror the animator and UI based on this value." },
];

const apiParamsTH = [
  { name: "IssueCommandServerRpc(NetworkId[], CommandData)", type: "ServerRpc", description: "Player ส่ง batch ของ unit IDs และ struct CommandData Server iterate แต่ละ unit และเรียก command method ที่เหมาะสม" },
  { name: "CommandMove(Vector3 destination)", type: "Server method", description: "Server ตั้ง _moveTarget SyncVar ของ unit และ transition state เป็น Moving NavMeshAgent รับ destination ใหม่" },
  { name: "CommandAttack(NetworkId target)", type: "Server method", description: "Server ตั้ง _attackTarget และ transition เป็น Attacking state unit ไล่ target และจัดการ damage ฝั่ง server" },
  { name: "CommandPatrol(Vector3 a, Vector3 b)", type: "Server method", description: "Server เก็บสอง patrol points และตั้ง state เป็น Patrolling unit แกว่งระหว่างจุดจนกว่าจะได้รับคำสั่งใหม่" },
  { name: "UseSkill(int skillId)", type: "Server method", description: "ค้นหา skill จาก SkillSet ScriptableObject ของ unit validate cooldown และ execute skill effect บน server" },
  { name: "_state (SyncVar<UnitState>)", type: "SyncVar", description: "Enum สถานะ unit ปัจจุบัน (Idle/Moving/Attacking/Patrolling/Dead) ทุก peer mirror animator และ UI ตามค่านี้" },
];

const unitCode = `using PurrNet;
using UnityEngine;
using UnityEngine.AI;

public enum UnitState { Idle, Moving, Attacking, Patrolling, Dead }

[RegisterNetworkType(typeof(CommandData))]
public struct CommandData : IPackedAuto
{
    public CommandType type;
    public Vector3     position;   // for Move / Patrol A
    public Vector3     positionB;  // for Patrol B
    public NetworkId   targetId;   // for Attack
    public int         skillId;    // for Skill
}

public enum CommandType { Move, Attack, Patrol, Skill }

// ── NetworkUnit ───────────────────────────────────────────────────────────────

[RequireComponent(typeof(NavMeshAgent))]
public class NetworkUnit : NetworkBehaviour
{
    [SerializeField] private SkillSet  _skills;   // ScriptableObject with skill list
    [SerializeField] private int       _maxHealth = 100;
    [SerializeField] private Animator  _anim;

    // Synced state
    private SyncVar<UnitState> _state     = new(UnitState.Idle);
    private SyncVar<int>       _health    = new(100);
    private SyncVar<Vector3>   _moveTarget = new(Vector3.zero);

    private NavMeshAgent _nav;

    protected override void OnSpawned()
    {
        _nav = GetComponent<NavMeshAgent>();
        _health.value = _maxHealth;

        _state.onChanged  += (_, s) => _anim.SetInteger("State", (int)s);
        _health.onChanged += (_, hp) => UIManager.UpdateUnitHP(this, hp, _maxHealth);
    }

    // ── Server-side commands (called by NetworkUnitCommander) ─────────────────

    [Server]
    public void CommandMove(Vector3 destination)
    {
        _moveTarget.value = destination;
        _state.value      = UnitState.Moving;
        _nav.SetDestination(destination);
    }

    [Server]
    public void CommandAttack(NetworkUnit target)
    {
        if (target == null || target._state.value == UnitState.Dead) return;
        _state.value = UnitState.Attacking;
        StartCoroutine(AttackLoop(target));
    }

    [Server]
    public void CommandPatrol(Vector3 pointA, Vector3 pointB)
    {
        _state.value = UnitState.Patrolling;
        StartCoroutine(PatrolLoop(pointA, pointB));
    }

    [Server]
    public void UseSkill(int skillId)
    {
        if (!_skills.TryGet(skillId, out Skill skill)) return;
        if (!skill.IsReady()) return;

        skill.Activate(this);          // runs entirely on server
        RpcPlaySkillEffect(skillId);   // visual feedback on all peers
    }

    [Server]
    public void TakeDamage(int amount)
    {
        if (_state.value == UnitState.Dead) return;
        _health.value = Mathf.Max(0, _health.value - amount);
        if (_health.value == 0)
        {
            _state.value = UnitState.Dead;
            _nav.enabled = false;
            RpcOnDeath();
        }
    }

    // ── RPCs ─────────────────────────────────────────────────────────────────

    [ObserversRpc(runLocally: true)]
    private void RpcPlaySkillEffect(int skillId) => VFXManager.PlaySkill(skillId, transform);

    [ObserversRpc(runLocally: true)]
    private void RpcOnDeath() => VFXManager.PlayDeath(transform.position);

    // ── Private coroutines ────────────────────────────────────────────────────

    private System.Collections.IEnumerator AttackLoop(NetworkUnit target)
    {
        while (target != null && target._state.value != UnitState.Dead && _state.value == UnitState.Attacking)
        {
            float dist = Vector3.Distance(transform.position, target.transform.position);
            if (dist < 2f) { target.TakeDamage(10); yield return new WaitForSeconds(1f); }
            else            { _nav.SetDestination(target.transform.position); yield return null; }
        }
        if (_state.value == UnitState.Attacking) _state.value = UnitState.Idle;
    }

    private System.Collections.IEnumerator PatrolLoop(Vector3 a, Vector3 b)
    {
        Vector3 current = b;
        while (_state.value == UnitState.Patrolling)
        {
            _nav.SetDestination(current);
            yield return new WaitUntil(() => _nav.remainingDistance < 0.5f || _state.value != UnitState.Patrolling);
            current = current == a ? b : a;
        }
    }
}`;

const commanderCode = `using PurrNet;
using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// One per player. Handles unit selection and command dispatch.
/// Only this player's NetworkUnitCommander sends commands — server validates.
/// </summary>
public class NetworkUnitCommander : NetworkBehaviour
{
    private readonly List<NetworkUnit> _selected = new();

    // ── Selection ─────────────────────────────────────────────────────────────

    public void SelectUnit(NetworkUnit unit, bool additive)
    {
        if (!isOwner) return;
        if (!additive) _selected.Clear();
        if (!_selected.Contains(unit)) _selected.Add(unit);
    }

    public void ClearSelection() { if (isOwner) _selected.Clear(); }

    // ── Command dispatch ──────────────────────────────────────────────────────

    public void IssueMove(Vector3 destination)
    {
        if (!isOwner || _selected.Count == 0) return;
        var ids = GetSelectedIds();
        var cmd = new CommandData { type = CommandType.Move, position = destination };
        IssueCommandServerRpc(ids, cmd);
    }

    public void IssueAttack(NetworkUnit target)
    {
        if (!isOwner || _selected.Count == 0 || target == null) return;
        var ids = GetSelectedIds();
        var cmd = new CommandData { type = CommandType.Attack, targetId = target.networkId };
        IssueCommandServerRpc(ids, cmd);
    }

    public void IssuePatrol(Vector3 a, Vector3 b)
    {
        if (!isOwner || _selected.Count == 0) return;
        var ids = GetSelectedIds();
        var cmd = new CommandData { type = CommandType.Patrol, position = a, positionB = b };
        IssueCommandServerRpc(ids, cmd);
    }

    public void IssueSkill(int skillId)
    {
        if (!isOwner || _selected.Count == 0) return;
        var ids = GetSelectedIds();
        var cmd = new CommandData { type = CommandType.Skill, skillId = skillId };
        IssueCommandServerRpc(ids, cmd);
    }

    // ── Server validation ─────────────────────────────────────────────────────

    [ServerRpc]
    private void IssueCommandServerRpc(NetworkId[] unitIds, CommandData cmd)
    {
        foreach (var id in unitIds)
        {
            if (!networkManager.TryGetBehaviour<NetworkUnit>(id, out var unit)) continue;
            switch (cmd.type)
            {
                case CommandType.Move:
                    unit.CommandMove(cmd.position);
                    break;
                case CommandType.Attack:
                    if (networkManager.TryGetBehaviour<NetworkUnit>(cmd.targetId, out var target))
                        unit.CommandAttack(target);
                    break;
                case CommandType.Patrol:
                    unit.CommandPatrol(cmd.position, cmd.positionB);
                    break;
                case CommandType.Skill:
                    unit.UseSkill(cmd.skillId);
                    break;
            }
        }
    }

    private NetworkId[] GetSelectedIds()
    {
        var ids = new NetworkId[_selected.Count];
        for (int i = 0; i < _selected.Count; i++) ids[i] = _selected[i].networkId;
        return ids;
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Strategy Unit Commander"
          description="A PurrNet RTS framework. Players select one or more units and issue commands (Move, Attack, Patrol, Skill). Commands travel as a single batched ServerRpc to the server, which executes them with full authority — preventing cheats and keeping physics deterministic across all peers."
          badge="Example"
          href="/docs/strategy-unit-commander"
        >
          <StrategyUnitCommanderViz />

          <div className="prose">
            <h2>Architecture: Commander → Server → Units</h2>
            <p>The key design principle is <strong>server-authoritative units</strong>. Players never move units directly — they send <em>intent</em> via <code>IssueCommandServerRpc</code>, and the server executes the resulting state changes. This means:</p>
            <ul>
              <li>All unit physics and damage run on the server.</li>
              <li>Multiple players can issue competing commands without races.</li>
              <li>Cheating by manipulating unit state client-side is impossible.</li>
              <li>Unique skills can run complex server-side logic without any client trust.</li>
            </ul>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsEN} /></div>

          <div className="prose"><h2>NetworkUnit — server-authoritative unit</h2></div>
          <CodeBlock filename="NetworkUnit.cs" language="csharp" code={unitCode} />

          <div className="prose"><h2>NetworkUnitCommander — per-player command dispatcher</h2></div>
          <CodeBlock filename="NetworkUnitCommander.cs" language="csharp" code={commanderCode} />

          <Callout type="tip" title="Batch commands into one ServerRpc">
            Pass an array of <code>NetworkId[]</code> in a single RPC call rather than one RPC per
            unit. This keeps bandwidth proportional to the number of commands, not the number of
            selected units — critical when a player selects 50 units and right-clicks.
          </Callout>
          <Callout type="warning" title="Skills must validate on the server">
            Always check cooldowns and costs inside <code>UseSkill()</code> on the server. A client
            could call <code>IssueSkill()</code> with an invalid or negative cooldown — the server is
            the only trusted source for game state.
          </Callout>
          <Callout type="info" title="Unique abilities via ScriptableObject SkillSet">
            Each unit prefab holds a reference to a <code>SkillSet</code> ScriptableObject with a
            list of <code>Skill</code> entries. This lets designers configure different skill loadouts
            per unit type without touching the networking code.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Strategy Unit Commander"
          description="Framework RTS สำหรับ PurrNet ผู้เล่น select หน่วยหนึ่งหรือหลายหน่วยและออกคำสั่ง (Move, Attack, Patrol, Skill) คำสั่งเดินทางเป็น ServerRpc แบบ batch เดียวไปยัง server ซึ่ง execute พวกมันด้วย authority เต็มรูปแบบ — ป้องกันการโกงและรักษา physics ให้ deterministic ในทุก peer"
          badge="Example"
          href="/docs/strategy-unit-commander"
        >
          <StrategyUnitCommanderViz />
          <div className="prose">
            <h2>สถาปัตยกรรม: Commander → Server → Units</h2>
            <p>หลักการออกแบบสำคัญคือ <strong>units ที่ server เป็น authoritative</strong> ผู้เล่นไม่เคยย้าย units โดยตรง — พวกเขาส่ง <em>intent</em> ผ่าน <code>IssueCommandServerRpc</code> และ server execute การเปลี่ยนแปลง state ที่ตามมา</p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>
          <div className="prose"><h2>NetworkUnit — unit แบบ server-authoritative</h2></div>
          <CodeBlock filename="NetworkUnit.cs" language="csharp" code={unitCode} />
          <div className="prose"><h2>NetworkUnitCommander — command dispatcher ต่อ player</h2></div>
          <CodeBlock filename="NetworkUnitCommander.cs" language="csharp" code={commanderCode} />
          <Callout type="tip" title="Batch คำสั่งเป็น ServerRpc เดียว">ส่ง array ของ <code>NetworkId[]</code> ใน RPC call เดียวแทนที่จะเป็น RPC ต่อหน่วย วิธีนี้ทำให้ bandwidth เป็นสัดส่วนกับจำนวนคำสั่ง ไม่ใช่จำนวน units ที่ select</Callout>
          <Callout type="warning" title="Skills ต้อง validate บน server">ตรวจสอบ cooldowns และ costs ภายใน <code>UseSkill()</code> บน server เสมอ client อาจเรียก <code>IssueSkill()</code> ด้วย cooldown ที่ไม่ถูกต้อง server เป็นแหล่งที่เชื่อถือได้เพียงอย่างเดียวสำหรับ game state</Callout>
        </DocPage>
      }
    />
  );
}
