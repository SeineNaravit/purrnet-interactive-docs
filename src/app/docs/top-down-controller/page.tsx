import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { TopDownMindMap } from "@/components/visualizers/ComponentMindMapVisualizer";

export const metadata = { title: "Top Down Character Controller" };

// ── API tables ─────────────────────────────────────────────────────────────────

const apiParamsEN = [
  {
    name: "CmdMove(Vector2 direction)",
    type: "[ServerRpc] void",
    description:
      "Sets the movement velocity on the server. direction must be normalized. Only the owner may call this.",
  },
  {
    name: "CmdStop()",
    type: "[ServerRpc] void",
    description:
      "Zeroes velocity and sets isMoving to false. Call when the input axis returns to zero.",
  },
  {
    name: "CmdJump()",
    type: "[ServerRpc] void",
    description:
      "Applies jump force if the character is grounded. No-op in the air.",
  },
  {
    name: "onMovementChanged",
    type: "event Action<Vector2, bool>",
    description:
      "Fires on all clients whenever velocity or isMoving changes. Parameters: (velocity, isMoving).",
  },
  {
    name: "IsGrounded",
    type: "bool",
    description: "Read-only. Backed by SyncVar<bool> — true when CharacterController reports grounded.",
  },
];

const apiParamsTH = [
  {
    name: "CmdMove(Vector2 direction)",
    type: "[ServerRpc] void",
    description:
      "ตั้งค่า velocity บน server direction ต้องถูก normalize ไว้แล้ว เรียกได้เฉพาะ owner",
  },
  {
    name: "CmdStop()",
    type: "[ServerRpc] void",
    description:
      "ตั้ง velocity เป็นศูนย์และ isMoving เป็น false เรียกเมื่อ input axis กลับสู่ศูนย์",
  },
  {
    name: "CmdJump()",
    type: "[ServerRpc] void",
    description:
      "ใช้ jump force ถ้าตัวละครอยู่บนพื้น ไม่มีผลขณะอยู่กลางอากาศ",
  },
  {
    name: "onMovementChanged",
    type: "event Action<Vector2, bool>",
    description:
      "ทำงานบน clients ทั้งหมดเมื่อ velocity หรือ isMoving เปลี่ยน พารามิเตอร์: (velocity, isMoving)",
  },
  {
    name: "IsGrounded",
    type: "bool",
    description: "Read-only รองรับโดย SyncVar<bool> — true เมื่อ CharacterController รายงานว่าอยู่บนพื้น",
  },
];

// ── C# code blocks ─────────────────────────────────────────────────────────────

const characterDataCode = `using UnityEngine;

/// <summary>
/// Immutable per-character-type configuration asset.
/// Create via Assets → Create → PurrNet → CharacterData.
/// </summary>
[CreateAssetMenu(menuName = "PurrNet/CharacterData", fileName = "NewCharacterData")]
public class CharacterData : ScriptableObject
{
    /// <summary>Horizontal movement speed in units/second.</summary>
    [field: SerializeField] public float MoveSpeed     { get; private set; } = 5f;

    /// <summary>Degrees per second for rotation towards movement direction.</summary>
    [field: SerializeField] public float RotationSpeed { get; private set; } = 720f;

    /// <summary>Initial vertical velocity applied on jump.</summary>
    [field: SerializeField] public float JumpForce     { get; private set; } = 8f;

    /// <summary>Downward acceleration while airborne (should be negative).</summary>
    [field: SerializeField] public float Gravity       { get; private set; } = -20f;
}`;

const playerInputHandlerCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// Reads local player input every frame and forwards it to the server via RPC.
/// Only sends when this client is the owner — non-owners do nothing.
/// </summary>
public class PlayerInputHandler : MonoBehaviour
{
    [SerializeField] private TopDownMovement _movement;

    private void Update()
    {
        // Non-owners must never send input for another player's character.
        if (!_movement.IsOwner) return;

        Vector2 dir = new Vector2(
            Input.GetAxisRaw("Horizontal"),
            Input.GetAxisRaw("Vertical")
        ).normalized;

        if (dir.sqrMagnitude > 0.01f)
            _movement.CmdMove(dir);
        else
            _movement.CmdStop();

        if (Input.GetButtonDown("Jump"))
            _movement.CmdJump();
    }
}`;

const topDownMovementCode = `using PurrNet;
using System;
using UnityEngine;

/// <summary>
/// Owns all networked movement state for one player character.
/// Server is the sole writer of velocity and grounded state.
/// All clients receive changes through SyncVar replication.
/// </summary>
public class TopDownMovement : NetworkBehaviour
{
    [SerializeField] private CharacterData _data;

    // SyncVar replicates every write to all observers automatically.
    private SyncVar<Vector2> _velocity   = new(Vector2.zero);
    private SyncVar<bool>    _isMoving   = new(false);
    private SyncVar<bool>    _isGrounded = new(true);

    private CharacterController _cc;
    private float               _verticalVelocity;

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    /// <summary>
    /// Fires on ALL clients when velocity or isMoving changes.
    /// Parameters: (velocity, isMoving)
    /// </summary>
    public event Action<Vector2, bool> onMovementChanged;

    /// <summary>True when CharacterController.isGrounded. Replicated.</summary>
    public bool IsGrounded => _isGrounded.value;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        _cc = GetComponent<CharacterController>();

        // Raise the event on every client whenever state changes.
        _velocity.onChanged  += (_, v) => onMovementChanged?.Invoke(v, _isMoving.value);
        _isMoving.onChanged  += (_, m) => onMovementChanged?.Invoke(_velocity.value, m);
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        _velocity.onChanged  -= (_, v) => onMovementChanged?.Invoke(v, _isMoving.value);
        _isMoving.onChanged  -= (_, m) => onMovementChanged?.Invoke(_velocity.value, m);
    }

    // -----------------------------------------------------------------------
    // ServerRpcs — only the owning client may call these
    // -----------------------------------------------------------------------

    /// <summary>Starts movement in the given (normalized) direction.</summary>
    [ServerRpc(requireOwnership: true)]
    public void CmdMove(Vector2 direction)
    {
        _velocity.value = direction * _data.MoveSpeed;
        _isMoving.value = true;
    }

    /// <summary>Stops horizontal movement.</summary>
    [ServerRpc(requireOwnership: true)]
    public void CmdStop()
    {
        _velocity.value = Vector2.zero;
        _isMoving.value = false;
    }

    /// <summary>Applies jump force. No-op if already airborne.</summary>
    [ServerRpc(requireOwnership: true)]
    public void CmdJump()
    {
        if (!_isGrounded.value) return;
        _verticalVelocity = _data.JumpForce;
    }

    // -----------------------------------------------------------------------
    // Server-side physics tick
    // -----------------------------------------------------------------------

    private void Update()
    {
        // Physics runs on the server only; clients read replicated state.
        if (!isServer || _cc == null) return;

        // Gravity accumulation
        if (_cc.isGrounded) _verticalVelocity = Mathf.Max(_verticalVelocity, -2f);
        else                _verticalVelocity += _data.Gravity * Time.deltaTime;

        _isGrounded.value = _cc.isGrounded;

        // Build motion vector and move
        Vector3 horizontal = new Vector3(_velocity.value.x, 0f, _velocity.value.y);
        _cc.Move((horizontal + Vector3.up * _verticalVelocity) * Time.deltaTime);

        // Rotate to face the movement direction
        if (horizontal.sqrMagnitude > 0.01f)
        {
            Quaternion target = Quaternion.LookRotation(horizontal);
            transform.rotation = Quaternion.RotateTowards(
                transform.rotation, target,
                _data.RotationSpeed * Time.deltaTime);
        }
    }
}`;

const topDownAnimatorCode = `using UnityEngine;

/// <summary>
/// Pure visual script — drives the Animator from replicated movement state.
/// No network traffic: runs on every client from the SyncVar-backed event.
/// </summary>
public class TopDownAnimator : MonoBehaviour
{
    [SerializeField] private TopDownMovement _movement;

    private Animator _animator;

    // Cache parameter hashes to avoid per-frame string lookups.
    private static readonly int SpeedHash      = Animator.StringToHash("Speed");
    private static readonly int IsMovingHash   = Animator.StringToHash("IsMoving");
    private static readonly int IsGroundedHash = Animator.StringToHash("IsGrounded");

    private void Awake()    => _animator = GetComponent<Animator>();

    private void Start()    => _movement.onMovementChanged += HandleMovementChanged;

    private void OnDestroy() => _movement.onMovementChanged -= HandleMovementChanged;

    // -----------------------------------------------------------------------
    // Event handler — called on every client whenever movement state changes
    // -----------------------------------------------------------------------

    private void HandleMovementChanged(Vector2 velocity, bool isMoving)
    {
        _animator.SetFloat(SpeedHash,      velocity.magnitude);
        _animator.SetBool(IsMovingHash,    isMoving);
        _animator.SetBool(IsGroundedHash,  _movement.IsGrounded);
    }
}`;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Top Down Character Controller"
          description="A multiplayer top-down character with server-authoritative movement, jump, and animator sync — built from four focused scripts that each own exactly one responsibility."
          badge="Example"
          href="/docs/top-down-controller"
        >
          {/* ── Overview ── */}
          <div className="prose">
            <h2>Overview — how the scripts connect</h2>
            <p>
              This example splits the controller into four scripts so that each one is easy
              to read, test, and swap. The server owns all physics; clients send input only.
            </p>
            <ul>
              <li>
                <strong>CharacterData</strong> — a ScriptableObject holding speed, rotation rate,
                jump force, and gravity. Create one asset per character type; no code changes needed.
              </li>
              <li>
                <strong>PlayerInputHandler</strong> — reads Unity&apos;s Input system every frame
                and calls the matching <code>[ServerRpc]</code>. Guards with{" "}
                <code>IsOwner</code> so only the local player&apos;s client sends input.
              </li>
              <li>
                <strong>TopDownMovement</strong> — the only <code>NetworkBehaviour</code> in
                the system. It owns <code>SyncVar&lt;Vector2&gt; _velocity</code> and{" "}
                <code>SyncVar&lt;bool&gt; _isGrounded</code>, runs <code>CharacterController</code>{" "}
                physics on the server, and raises <code>onMovementChanged</code> on every client
                whenever state changes.
              </li>
              <li>
                <strong>TopDownAnimator</strong> — subscribes to <code>onMovementChanged</code>{" "}
                and drives the <code>Animator</code> parameters. Zero network traffic — it reacts
                to the already-replicated SyncVar values.
              </li>
            </ul>
            <p>The data flow for one input frame:</p>
            <ol>
              <li>Owner client reads WASD → calls <code>CmdMove(dir)</code>.</li>
              <li>Server validates and writes <code>_velocity</code>.</li>
              <li>PurrNet replicates the SyncVar to every observer.</li>
              <li><code>onMovementChanged</code> fires on all clients → <code>TopDownAnimator</code> updates the blend tree.</li>
            </ol>
          </div>

          {/* ── Mind Map ── */}
          <div className="not-prose">
            <TopDownMindMap />
          </div>

          {/* ── Script 1 ── */}
          <div className="prose">
            <h2>Script 1 — CharacterData (ScriptableObject)</h2>
            <p>
              A plain data asset with no runtime logic. Create one per character type in{" "}
              <em>Assets → Create → PurrNet → CharacterData</em>. Designers adjust values in the
              Inspector; no C# changes needed.
            </p>
          </div>

          <CodeBlock filename="CharacterData.cs" language="csharp" code={characterDataCode} />

          {/* ── Script 2 ── */}
          <div className="prose">
            <h2>Script 2 — PlayerInputHandler (MonoBehaviour)</h2>
            <p>
              Runs every frame on the owner&apos;s machine. The <code>IsOwner</code> guard at
              the top of <code>Update</code> is the single rule that prevents every connected
              client from flooding the server with input for a character they don&apos;t control.
            </p>
          </div>

          <CodeBlock filename="PlayerInputHandler.cs" language="csharp" code={playerInputHandlerCode} />

          <Callout type="tip">
            Replace <code>Input.GetAxisRaw</code> with your project&apos;s input system (Unity Input
            System&apos;s <code>InputAction.ReadValue&lt;Vector2&gt;()</code>, etc.) — only this
            script needs to change.
          </Callout>

          {/* ── Script 3 ── */}
          <div className="prose">
            <h2>Script 3 — TopDownMovement (NetworkBehaviour)</h2>
            <p>
              This is the only networked script. It holds two SyncVars and runs{" "}
              <code>CharacterController.Move()</code> inside a server-only <code>Update</code>.
              Because the CharacterController is driven on the server, position is naturally
              authoritative; PurrNet&apos;s <strong>NetworkTransform</strong> component handles
              position replication to remote clients automatically.
            </p>
            <p>
              The <code>onMovementChanged</code> event is raised via the SyncVar{" "}
              <code>onChanged</code> callbacks, which run on every client (including the host)
              after replication — so sibling scripts never need to poll.
            </p>
          </div>

          <CodeBlock filename="TopDownMovement.cs" language="csharp" code={topDownMovementCode} />

          <Callout type="warning">
            <strong>Add a NetworkTransform component</strong> to the prefab alongside{" "}
            <code>TopDownMovement</code>. Without it the server moves the object correctly but
            remote clients see it frozen at spawn position.
          </Callout>

          {/* ── Script 4 ── */}
          <div className="prose">
            <h2>Script 4 — TopDownAnimator (MonoBehaviour)</h2>
            <p>
              A plain <code>MonoBehaviour</code> — no networking at all. It subscribes to{" "}
              <code>onMovementChanged</code> in <code>Start</code> and feeds the three Animator
              parameters every time movement state changes. Because the event fires from a
              SyncVar callback it already runs locally on every client.
            </p>
          </div>

          <CodeBlock filename="TopDownAnimator.cs" language="csharp" code={topDownAnimatorCode} />

          <Callout type="info">
            The Animator requires three parameters: <code>Speed</code> (Float),{" "}
            <code>IsMoving</code> (Bool), and <code>IsGrounded</code> (Bool). Create a blend
            tree on <code>Speed</code> for walk/run transitions, and a transition from{" "}
            <code>IsGrounded = false</code> into a jump/fall state.
          </Callout>

          {/* ── API Reference ── */}
          <div className="prose">
            <h2>API Reference — TopDownMovement</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          {/* ── Scene Setup ── */}
          <div className="prose">
            <h2>Scene Setup</h2>
            <ol>
              <li>
                Create a <strong>CharacterData</strong> asset:{" "}
                <em>Assets → Create → PurrNet → CharacterData</em>. Set{" "}
                <code>MoveSpeed</code>, <code>JumpForce</code>, and <code>Gravity</code>.
              </li>
              <li>
                On the player prefab, add a <code>CharacterController</code> component. Set its
                radius and height to match your model.
              </li>
              <li>
                Add <strong>TopDownMovement</strong>, <strong>PlayerInputHandler</strong>,{" "}
                <strong>TopDownAnimator</strong>, and a PurrNet{" "}
                <strong>NetworkTransform</strong> component to the prefab.
              </li>
              <li>
                Assign the <code>CharacterData</code> asset to <code>TopDownMovement._data</code>,
                wire <code>PlayerInputHandler._movement</code> and{" "}
                <code>TopDownAnimator._movement</code> to the same <code>TopDownMovement</code>.
              </li>
              <li>
                Create an Animator Controller with <code>Speed</code> (Float),{" "}
                <code>IsMoving</code> (Bool), and <code>IsGrounded</code> (Bool) parameters.
                Assign it to the <code>Animator</code> component on the model child.
              </li>
              <li>
                Register the prefab with PurrNet&apos;s <strong>NetworkManager</strong> and
                call <code>SpawnPlayer()</code> on connection.
              </li>
            </ol>
          </div>

          <Callout type="danger">
            Never call <code>CmdMove</code> or <code>CmdJump</code> from server-only code — they
            are <code>requireOwnership: true</code> ServerRpcs and will be rejected if the caller
            is not the owner. Use direct field assignment on the server instead.
          </Callout>

          {/* ── Best Practices ── */}
          <div className="prose">
            <h2>Best Practices</h2>
          </div>

          <Callout type="tip">
            Send <strong>normalised</strong> direction from <code>PlayerInputHandler</code>. Raw
            axis values let a cheater send magnitude &gt; 1 and move faster than{" "}
            <code>MoveSpeed</code> allows. Alternatively validate magnitude server-side in{" "}
            <code>CmdMove</code>.
          </Callout>

          <Callout type="warning">
            If you use a <strong>rigidbody</strong> instead of <code>CharacterController</code>,
            switch to PurrNet&apos;s <strong>NetworkRigidbody</strong> component and drive
            velocity via <code>Rigidbody.linearVelocity</code> on the server — the physics
            replication path is different.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Top Down Character Controller (ผู้เล่นหลายคน)"
          description="ตัวควบคุมตัวละครมุมมองบนลงล่างสำหรับเกม multiplayer พร้อม server-authoritative movement, jump, และ animator sync — สร้างจากสี่ script ที่แต่ละตัวมีหน้าที่ชัดเจน"
          badge="Example"
          href="/docs/top-down-controller"
        >
          {/* ── Overview TH ── */}
          <div className="prose">
            <h2>ภาพรวม — script เชื่อมกันอย่างไร</h2>
            <p>
              ตัวอย่างนี้แบ่ง controller เป็น 4 script เพื่อให้อ่าน ทดสอบ และสลับแต่ละส่วนได้ง่าย
              Server เป็นเจ้าของ physics ทั้งหมด; client ส่งแค่ input เท่านั้น
            </p>
            <ul>
              <li><strong>CharacterData</strong> — ScriptableObject เก็บค่า speed, rotation, jump force และ gravity</li>
              <li><strong>PlayerInputHandler</strong> — อ่าน Input ทุก frame และเรียก ServerRpc ที่ตรงกัน</li>
              <li><strong>TopDownMovement</strong> — NetworkBehaviour เดียวในระบบ เป็นเจ้าของ SyncVar และรัน physics บน server</li>
              <li><strong>TopDownAnimator</strong> — subscribe <code>onMovementChanged</code> และ drive Animator parameters</li>
            </ul>
          </div>

          {/* ── Mind Map TH ── */}
          <div className="not-prose">
            <TopDownMindMap />
          </div>

          {/* ── Scripts TH ── */}
          <div className="prose">
            <h2>Script 1 — CharacterData (ScriptableObject)</h2>
            <p>Data asset ธรรมดาไม่มี logic runtime สร้างได้จาก <em>Assets → Create → PurrNet → CharacterData</em></p>
          </div>
          <CodeBlock filename="CharacterData.cs" language="csharp" code={characterDataCode} />

          <div className="prose">
            <h2>Script 2 — PlayerInputHandler (MonoBehaviour)</h2>
            <p>รัน Update ทุก frame บน machine ของ owner guard <code>IsOwner</code> ป้องกันไม่ให้ client อื่นส่ง input แทน</p>
          </div>
          <CodeBlock filename="PlayerInputHandler.cs" language="csharp" code={playerInputHandlerCode} />

          <div className="prose">
            <h2>Script 3 — TopDownMovement (NetworkBehaviour)</h2>
            <p>Script networked เดียวในระบบ ถือ SyncVar สองตัวและรัน CharacterController บน server ส่งเหตุการณ์ <code>onMovementChanged</code> ไปยัง clients ทุกตัว</p>
          </div>
          <CodeBlock filename="TopDownMovement.cs" language="csharp" code={topDownMovementCode} />

          <Callout type="warning">
            เพิ่ม <strong>NetworkTransform</strong> บน prefab ด้วย มิฉะนั้น remote clients จะเห็นตัวละครอยู่นิ่งที่ตำแหน่ง spawn
          </Callout>

          <div className="prose">
            <h2>Script 4 — TopDownAnimator (MonoBehaviour)</h2>
            <p>MonoBehaviour ธรรมดาไม่มี networking subscribe <code>onMovementChanged</code> ใน Start และอัพเดท Animator parameters ทุกครั้งที่ state เปลี่ยน</p>
          </div>
          <CodeBlock filename="TopDownAnimator.cs" language="csharp" code={topDownAnimatorCode} />

          {/* ── API TH ── */}
          <div className="prose"><h2>API Reference — TopDownMovement</h2></div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>

          {/* ── Scene Setup TH ── */}
          <div className="prose">
            <h2>การตั้งค่า Scene</h2>
            <ol>
              <li>สร้าง CharacterData asset และตั้งค่า MoveSpeed, JumpForce, Gravity</li>
              <li>เพิ่ม CharacterController บน prefab ตั้ง radius และ height ให้ตรงกับ model</li>
              <li>เพิ่ม TopDownMovement, PlayerInputHandler, TopDownAnimator และ NetworkTransform บน prefab</li>
              <li>ผูก reference ระหว่าง script ใน Inspector</li>
              <li>สร้าง Animator Controller พร้อม parameter Speed, IsMoving, IsGrounded</li>
              <li>ลงทะเบียน prefab กับ NetworkManager และเรียก SpawnPlayer() เมื่อเชื่อมต่อ</li>
            </ol>
          </div>
        </DocPage>
      }
    />
  );
}
