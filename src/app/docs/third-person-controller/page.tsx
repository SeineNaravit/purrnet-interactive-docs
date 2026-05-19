import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { ThirdPersonMindMap } from "@/components/visualizers/ComponentMindMapVisualizer";

export const metadata = { title: "3rd Person Character Controller" };

// ── API tables ─────────────────────────────────────────────────────────────────

const apiParamsEN = [
  {
    name: "CmdMove(Vector2 direction, bool isRunning)",
    type: "[ServerRpc] void",
    description:
      "Sets the character's horizontal speed and facing angle on the server. Only the owner may call this.",
  },
  {
    name: "CmdJump()",
    type: "[ServerRpc] void",
    description:
      "Applies jump force if grounded. No-op while airborne.",
  },
  {
    name: "onStateChanged",
    type: "event Action<float, bool, bool>",
    description:
      "Fires on all clients when speed, isRunning, or isGrounded changes. Parameters: (speed, isRunning, isGrounded).",
  },
  {
    name: "Speed",
    type: "float",
    description: "Current movement speed in units/second. Backed by SyncVar<float>.",
  },
  {
    name: "IsGrounded",
    type: "bool",
    description: "True when CharacterController reports the character is on the ground. Backed by SyncVar<bool>.",
  },
];

const apiParamsTH = [
  {
    name: "CmdMove(Vector2 direction, bool isRunning)",
    type: "[ServerRpc] void",
    description:
      "ตั้งค่า horizontal speed และมุมหันของตัวละครบน server เรียกได้เฉพาะ owner",
  },
  {
    name: "CmdJump()",
    type: "[ServerRpc] void",
    description: "ใช้ jump force ถ้าอยู่บนพื้น ไม่มีผลขณะอยู่กลางอากาศ",
  },
  {
    name: "onStateChanged",
    type: "event Action<float, bool, bool>",
    description:
      "ทำงานบน clients ทั้งหมดเมื่อ speed, isRunning หรือ isGrounded เปลี่ยน พารามิเตอร์: (speed, isRunning, isGrounded)",
  },
  {
    name: "Speed",
    type: "float",
    description: "ความเร็วการเคลื่อนที่ปัจจุบัน รองรับโดย SyncVar<float>",
  },
  {
    name: "IsGrounded",
    type: "bool",
    description: "True เมื่อ CharacterController รายงานว่าอยู่บนพื้น รองรับโดย SyncVar<bool>",
  },
];

// ── C# code blocks ─────────────────────────────────────────────────────────────

const thirdPersonDataCode = `using UnityEngine;

/// <summary>
/// Immutable configuration for a third-person character type.
/// Create via Assets → Create → PurrNet → ThirdPersonData.
/// </summary>
[CreateAssetMenu(menuName = "PurrNet/ThirdPersonData", fileName = "NewThirdPersonData")]
public class ThirdPersonData : ScriptableObject
{
    /// <summary>Walk speed in units/second (no Shift held).</summary>
    [field: SerializeField] public float WalkSpeed      { get; private set; } = 3f;

    /// <summary>Run speed in units/second (Shift held).</summary>
    [field: SerializeField] public float RunSpeed       { get; private set; } = 6f;

    /// <summary>Initial vertical velocity applied on jump.</summary>
    [field: SerializeField] public float JumpForce      { get; private set; } = 8f;

    /// <summary>Downward acceleration while airborne (negative value).</summary>
    [field: SerializeField] public float Gravity        { get; private set; } = -20f;

    /// <summary>
    /// Seconds to smooth-damp rotation to the target facing angle.
    /// Lower = snappier turning.
    /// </summary>
    [field: SerializeField] public float TurnSmoothTime { get; private set; } = 0.12f;
}`;

const inputHandlerCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// Reads local player input and forwards it to the server via RPC.
/// Guards with IsOwner — non-owners skip Update entirely.
/// </summary>
public class PlayerInputHandler : MonoBehaviour
{
    [SerializeField] private ThirdPersonMovement _movement;

    private void Update()
    {
        if (!_movement.IsOwner) return;

        Vector2 moveInput = new Vector2(
            Input.GetAxisRaw("Horizontal"),
            Input.GetAxisRaw("Vertical")
        ).normalized;

        bool isRunning = Input.GetKey(KeyCode.LeftShift);

        // Always send, even when zero — lets the server know the player stopped.
        _movement.CmdMove(moveInput, isRunning);

        if (Input.GetButtonDown("Jump"))
            _movement.CmdJump();
    }
}`;

const thirdPersonMovementCode = `using PurrNet;
using System;
using UnityEngine;

/// <summary>
/// Server-authoritative third-person movement.
/// Owns three SyncVars (speed, isRunning, isGrounded) and drives
/// CharacterController physics exclusively on the server.
/// NetworkTransform handles position/rotation replication to all clients.
/// </summary>
public class ThirdPersonMovement : NetworkBehaviour
{
    [SerializeField] private ThirdPersonData _data;

    private SyncVar<float> _speed      = new(0f);
    private SyncVar<bool>  _isRunning  = new(false);
    private SyncVar<bool>  _isGrounded = new(true);

    private CharacterController _cc;
    private float               _verticalVelocity;
    private float               _turnVelocity;     // SmoothDampAngle reference

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    /// <summary>
    /// Fires on ALL clients when any of speed, isRunning, or isGrounded changes.
    /// Parameters: (speed, isRunning, isGrounded)
    /// </summary>
    public event Action<float, bool, bool> onStateChanged;

    /// <summary>Current horizontal speed. Backed by a replicated SyncVar.</summary>
    public float Speed      => _speed.value;

    /// <summary>True when the CharacterController is touching the ground.</summary>
    public bool  IsGrounded => _isGrounded.value;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        _cc = GetComponent<CharacterController>();

        _speed.onChanged      += (_, s) => onStateChanged?.Invoke(s, _isRunning.value, _isGrounded.value);
        _isRunning.onChanged  += (_, r) => onStateChanged?.Invoke(_speed.value, r, _isGrounded.value);
        _isGrounded.onChanged += (_, g) => onStateChanged?.Invoke(_speed.value, _isRunning.value, g);
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        _speed.onChanged      -= (_, s) => onStateChanged?.Invoke(s, _isRunning.value, _isGrounded.value);
        _isRunning.onChanged  -= (_, r) => onStateChanged?.Invoke(_speed.value, r, _isGrounded.value);
        _isGrounded.onChanged -= (_, g) => onStateChanged?.Invoke(_speed.value, _isRunning.value, g);
    }

    // -----------------------------------------------------------------------
    // ServerRpcs
    // -----------------------------------------------------------------------

    /// <summary>
    /// Sets speed and facing direction on the server.
    /// direction should be normalized; isRunning toggles walk vs run speed.
    /// </summary>
    [ServerRpc(requireOwnership: true)]
    public void CmdMove(Vector2 direction, bool isRunning)
    {
        bool moving     = direction.sqrMagnitude > 0.01f;
        float target    = isRunning ? _data.RunSpeed : _data.WalkSpeed;

        _speed.value     = moving ? target : 0f;
        _isRunning.value = moving && isRunning;

        if (moving)
        {
            // Smoothly rotate toward movement direction
            float targetAngle = Mathf.Atan2(direction.x, direction.y) * Mathf.Rad2Deg;
            float angle = Mathf.SmoothDampAngle(
                transform.eulerAngles.y, targetAngle,
                ref _turnVelocity, _data.TurnSmoothTime);

            transform.rotation = Quaternion.Euler(0f, angle, 0f);
        }
    }

    /// <summary>Applies jump force. No-op while airborne.</summary>
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
        if (!isServer || _cc == null) return;

        // Gravity
        if (_cc.isGrounded) _verticalVelocity = Mathf.Max(_verticalVelocity, -2f);
        else                _verticalVelocity += _data.Gravity * Time.deltaTime;

        _isGrounded.value = _cc.isGrounded;

        // Move forward and apply gravity
        Vector3 motion = transform.forward * _speed.value
                       + Vector3.up        * _verticalVelocity;

        _cc.Move(motion * Time.deltaTime);
        // NetworkTransform picks up the transform change and replicates it.
    }
}`;

const thirdPersonAnimatorCode = `using UnityEngine;

/// <summary>
/// Drives the character Animator from replicated movement state.
/// Pure MonoBehaviour — no network traffic. Reacts to onStateChanged
/// which is backed by SyncVar callbacks and already runs on every client.
/// </summary>
public class ThirdPersonAnimator : MonoBehaviour
{
    [SerializeField] private ThirdPersonMovement _movement;

    private Animator _animator;

    private static readonly int SpeedHash      = Animator.StringToHash("Speed");
    private static readonly int IsRunningHash  = Animator.StringToHash("IsRunning");
    private static readonly int IsGroundedHash = Animator.StringToHash("IsGrounded");

    private void Awake()     => _animator = GetComponent<Animator>();
    private void Start()     => _movement.onStateChanged += HandleStateChanged;
    private void OnDestroy() => _movement.onStateChanged -= HandleStateChanged;

    private void HandleStateChanged(float speed, bool isRunning, bool isGrounded)
    {
        _animator.SetFloat(SpeedHash,      speed);
        _animator.SetBool(IsRunningHash,   isRunning);
        _animator.SetBool(IsGroundedHash,  isGrounded);
    }
}`;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="3rd Person Character Controller"
          description="A multiplayer third-person controller with walk/run, jump, and smooth rotation — server-authoritative movement via CharacterController, position sync via NetworkTransform, and Animator driven by SyncVar events."
          badge="Example"
          href="/docs/third-person-controller"
        >
          {/* ── Overview ── */}
          <div className="prose">
            <h2>Overview — how the scripts connect</h2>
            <p>
              This example uses five components on the player prefab. The key design decision is
              that <strong>ThirdPersonMovement owns all state</strong> and the other scripts react
              to it — reducing coupling and keeping each file small.
            </p>
            <ul>
              <li>
                <strong>ThirdPersonData</strong> — ScriptableObject with walk speed, run speed,
                jump force, gravity, and turn-smooth time. One asset per character type.
              </li>
              <li>
                <strong>PlayerInputHandler</strong> — MonoBehaviour that reads Unity input
                and calls <code>CmdMove</code> / <code>CmdJump</code>. The <code>IsOwner</code>{" "}
                guard at the top of <code>Update</code> ensures only the local player&apos;s
                client sends input.
              </li>
              <li>
                <strong>ThirdPersonMovement</strong> — the only custom <code>NetworkBehaviour</code>.
                Owns <code>SyncVar&lt;float&gt; _speed</code>,{" "}
                <code>SyncVar&lt;bool&gt; _isRunning</code>, and{" "}
                <code>SyncVar&lt;bool&gt; _isGrounded</code>. Runs{" "}
                <code>CharacterController.Move()</code> on the server, raises{" "}
                <code>onStateChanged</code> everywhere.
              </li>
              <li>
                <strong>NetworkTransform</strong> — a built-in PurrNet component. Automatically
                replicates the transform position and rotation that{" "}
                <code>ThirdPersonMovement</code> writes each server frame. No code needed.
              </li>
              <li>
                <strong>ThirdPersonAnimator</strong> — MonoBehaviour that subscribes to{" "}
                <code>onStateChanged</code> and pushes three parameters to the{" "}
                <code>Animator</code>. Zero network traffic.
              </li>
            </ul>
            <p>Data flow for one input frame:</p>
            <ol>
              <li>Owner client reads WASD + Shift → calls <code>CmdMove(dir, isRunning)</code>.</li>
              <li>Server calculates target speed, smooth-damps rotation, writes SyncVars.</li>
              <li>PurrNet replicates SyncVars and NetworkTransform position to all observers.</li>
              <li>
                <code>onStateChanged</code> fires on all clients →{" "}
                <code>ThirdPersonAnimator</code> updates the blend tree in one call.
              </li>
            </ol>
          </div>

          {/* ── Mind Map ── */}
          <div className="not-prose">
            <ThirdPersonMindMap />
          </div>

          {/* ── Script 1 ── */}
          <div className="prose">
            <h2>Script 1 — ThirdPersonData (ScriptableObject)</h2>
            <p>
              A pure data asset. Having separate walk and run speeds here means designers can tune
              them per character type without modifying any C# logic.{" "}
              <code>TurnSmoothTime</code> controls how snappily the character rotates to face the
              movement direction — lower values feel snappier, higher values feel more weighty.
            </p>
          </div>

          <CodeBlock filename="ThirdPersonData.cs" language="csharp" code={thirdPersonDataCode} />

          {/* ── Script 2 ── */}
          <div className="prose">
            <h2>Script 2 — PlayerInputHandler (MonoBehaviour)</h2>
            <p>
              Sends input every frame, including a zero vector when the player is idle — this is
              intentional. It lets the server know the player has stopped and zeroes the speed
              SyncVar cleanly, which in turn triggers the animator transition back to idle.
            </p>
          </div>

          <CodeBlock filename="PlayerInputHandler.cs" language="csharp" code={inputHandlerCode} />

          <Callout type="tip">
            Sending every frame even when idle costs a few extra RPCs. If bandwidth is critical,
            send only on change: cache the previous direction and only call <code>CmdMove</code>{" "}
            when it differs.
          </Callout>

          {/* ── Script 3 ── */}
          <div className="prose">
            <h2>Script 3 — ThirdPersonMovement (NetworkBehaviour)</h2>
            <p>
              The <code>Update</code> inside <code>ThirdPersonMovement</code> runs{" "}
              <strong>only on the server</strong> (guarded by <code>if (!isServer) return</code>).
              This means the physics simulation is single-source-of-truth. After{" "}
              <code>CharacterController.Move()</code> updates <code>transform.position</code> and{" "}
              <code>transform.rotation</code>, the attached <strong>NetworkTransform</strong>{" "}
              component detects the change and automatically sends a position snapshot to all
              connected clients.
            </p>
            <p>
              The three SyncVars fire their <code>onChanged</code> lambdas on every client after
              replication, which raises the unified <code>onStateChanged</code> event. This means{" "}
              <code>ThirdPersonAnimator</code> always sees the same state as the server — no lag
              from manual polling.
            </p>
          </div>

          <CodeBlock filename="ThirdPersonMovement.cs" language="csharp" code={thirdPersonMovementCode} />

          <Callout type="warning">
            The <strong>NetworkTransform</strong> component must be on the same GameObject as{" "}
            <code>ThirdPersonMovement</code>. If your character has a separate model child object
            with its own transform, add <code>NetworkTransform</code> to the root, not the model.
          </Callout>

          {/* ── Script 4 ── */}
          <div className="prose">
            <h2>Script 4 — ThirdPersonAnimator (MonoBehaviour)</h2>
            <p>
              Subscribes in <code>Start</code> and unsubscribes in <code>OnDestroy</code> — always
              pair these to avoid dangling delegate references on pooled objects.
              <code>Animator.StringToHash</code> in static fields avoids the per-frame overhead of
              string hashing for parameter lookups.
            </p>
          </div>

          <CodeBlock filename="ThirdPersonAnimator.cs" language="csharp" code={thirdPersonAnimatorCode} />

          <Callout type="info">
            Animator parameters required: <code>Speed</code> (Float), <code>IsRunning</code> (Bool),{" "}
            <code>IsGrounded</code> (Bool). A typical 3rd-person blend tree uses{" "}
            <code>Speed</code> on the X-axis (0 = idle, 3 = walk, 6 = run) and transitions
            to/from a Jump state on <code>IsGrounded</code>.
          </Callout>

          {/* ── Built-in: NetworkTransform ── */}
          <div className="prose">
            <h2>Script 5 — NetworkTransform (Built-in PurrNet)</h2>
            <p>
              You do not write any code for this component — just add it to the prefab in the
              Inspector. PurrNet&apos;s <code>NetworkTransform</code> watches the GameObject&apos;s
              transform each server frame. When position or rotation changes by more than its
              configured threshold it sends a snapshot to all observers.
            </p>
            <p>Configure it in the Inspector:</p>
            <ul>
              <li>
                <strong>Sync Position / Sync Rotation</strong> — enable both for a character
                controller; disable rotation if you handle facing server-side only.
              </li>
              <li>
                <strong>Interpolation</strong> — enable to smooth out remote clients&apos;
                movement between snapshots. Set interpolation time slightly above your server
                tick interval.
              </li>
              <li>
                <strong>Authority</strong> — leave on Server. The server writes the transform;
                NetworkTransform replicates it.
              </li>
            </ul>
          </div>

          <Callout type="danger">
            Do <strong>not</strong> set NetworkTransform to Owner authority when using
            server-authoritative movement. Doing so would let clients write their own position
            directly — bypassing all server validation and enabling position cheats.
          </Callout>

          {/* ── API Reference ── */}
          <div className="prose">
            <h2>API Reference — ThirdPersonMovement</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          {/* ── Scene Setup ── */}
          <div className="prose">
            <h2>Scene Setup</h2>
            <ol>
              <li>
                Create a <strong>ThirdPersonData</strong> asset and configure walk/run speeds,
                jump force, gravity, and turn smooth time.
              </li>
              <li>
                On the player prefab root, add a <code>CharacterController</code>. Set its center,
                radius, and height to match the character capsule.
              </li>
              <li>
                Add <strong>ThirdPersonMovement</strong>, <strong>PlayerInputHandler</strong>,{" "}
                <strong>ThirdPersonAnimator</strong>, and PurrNet&apos;s{" "}
                <strong>NetworkTransform</strong> to the prefab root.
              </li>
              <li>
                Assign <code>ThirdPersonData</code> to <code>ThirdPersonMovement._data</code>.
                Wire <code>PlayerInputHandler._movement</code> and{" "}
                <code>ThirdPersonAnimator._movement</code> to the same{" "}
                <code>ThirdPersonMovement</code> instance.
              </li>
              <li>
                Place the model as a child object with its own <code>Animator</code> component.
                Create an Animator Controller with <code>Speed</code>, <code>IsRunning</code>,
                and <code>IsGrounded</code> parameters and a locomotion blend tree.
              </li>
              <li>
                Configure <strong>NetworkTransform</strong>: enable Sync Position and Sync
                Rotation, enable Interpolation, leave Authority on Server.
              </li>
              <li>
                Register the prefab with <strong>NetworkManager</strong> and spawn it on player
                connection.
              </li>
            </ol>
          </div>

          {/* ── Best Practices ── */}
          <Callout type="tip">
            For camera, add a <strong>Cinemachine Virtual Camera</strong> that follows{" "}
            <code>transform.position</code> of the local player only. Check{" "}
            <code>IsOwner</code> in a camera controller script and activate the camera only for
            the local player so other clients don&apos;t see through the wrong camera.
          </Callout>

          <Callout type="warning">
            <code>SmoothDampAngle</code> relies on a <code>ref float _turnVelocity</code> field
            that persists between frames. If you pool and re-use player prefabs, reset{" "}
            <code>_turnVelocity = 0</code> in <code>OnSpawned</code> to avoid the character
            snapping to a stale velocity on re-spawn.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="3rd Person Character Controller (ผู้เล่นหลายคน)"
          description="ตัวควบคุมมุมมองที่สามสำหรับ multiplayer พร้อม walk/run, jump, และ smooth rotation — movement ผ่าน server, sync position ผ่าน NetworkTransform, animator ขับด้วย SyncVar events"
          badge="Example"
          href="/docs/third-person-controller"
        >
          {/* ── Overview TH ── */}
          <div className="prose">
            <h2>ภาพรวม — script เชื่อมกันอย่างไร</h2>
            <p>
              ตัวอย่างนี้ใช้ 5 component บน prefab ของผู้เล่น การออกแบบหลักคือ{" "}
              <strong>ThirdPersonMovement เป็นเจ้าของ state ทั้งหมด</strong>{" "}
              และ script อื่นๆ ตอบสนองต่อมัน ลดการ coupling และทำให้แต่ละไฟล์เล็กลง
            </p>
            <ul>
              <li><strong>ThirdPersonData</strong> — ScriptableObject เก็บ walk/run speed, jump force, gravity, turn smooth time</li>
              <li><strong>PlayerInputHandler</strong> — อ่าน input และเรียก CmdMove / CmdJump guard ด้วย IsOwner</li>
              <li><strong>ThirdPersonMovement</strong> — NetworkBehaviour เดียว ถือ SyncVar 3 ตัว รัน physics บน server</li>
              <li><strong>NetworkTransform</strong> — component built-in ของ PurrNet replicate position/rotation อัตโนมัติ</li>
              <li><strong>ThirdPersonAnimator</strong> — subscribe onStateChanged และ push parameters ไปยัง Animator</li>
            </ul>
          </div>

          {/* ── Mind Map TH ── */}
          <div className="not-prose">
            <ThirdPersonMindMap />
          </div>

          {/* ── Scripts TH ── */}
          <div className="prose">
            <h2>Script 1 — ThirdPersonData (ScriptableObject)</h2>
            <p>Data asset ล้วนๆ สร้างจาก Assets → Create → PurrNet → ThirdPersonData กำหนดค่าได้ใน Inspector โดยไม่ต้องแก้ C#</p>
          </div>
          <CodeBlock filename="ThirdPersonData.cs" language="csharp" code={thirdPersonDataCode} />

          <div className="prose">
            <h2>Script 2 — PlayerInputHandler (MonoBehaviour)</h2>
            <p>ส่ง input ทุก frame รวมถึงเวลา idle เพื่อให้ server รู้ว่าผู้เล่นหยุดแล้ว</p>
          </div>
          <CodeBlock filename="PlayerInputHandler.cs" language="csharp" code={inputHandlerCode} />

          <div className="prose">
            <h2>Script 3 — ThirdPersonMovement (NetworkBehaviour)</h2>
            <p>Update ทำงานเฉพาะบน server CharacterController.Move() อัพเดท transform แล้ว NetworkTransform ตรวจพบการเปลี่ยนแปลงและส่ง snapshot ไปยัง clients ทั้งหมด</p>
          </div>
          <CodeBlock filename="ThirdPersonMovement.cs" language="csharp" code={thirdPersonMovementCode} />

          <Callout type="warning">
            NetworkTransform ต้องอยู่บน GameObject เดียวกับ ThirdPersonMovement ไม่ใช่บน child model object
          </Callout>

          <div className="prose">
            <h2>Script 4 — ThirdPersonAnimator (MonoBehaviour)</h2>
            <p>Subscribe ใน Start และ unsubscribe ใน OnDestroy เสมอ ใช้ Animator.StringToHash เพื่อหลีกเลี่ยง overhead การ hash string ทุก frame</p>
          </div>
          <CodeBlock filename="ThirdPersonAnimator.cs" language="csharp" code={thirdPersonAnimatorCode} />

          <div className="prose">
            <h2>Script 5 — NetworkTransform (Built-in PurrNet)</h2>
            <p>ไม่ต้องเขียน code เพียงเพิ่ม component บน prefab ใน Inspector เปิด Sync Position, Sync Rotation, Interpolation และตั้ง Authority เป็น Server</p>
          </div>

          <Callout type="danger">
            อย่าตั้ง NetworkTransform เป็น Owner authority เมื่อใช้ server-authoritative movement จะเปิดช่องให้ cheater ย้ายตำแหน่งตัวเองได้โดยตรง
          </Callout>

          {/* ── API TH ── */}
          <div className="prose"><h2>API Reference — ThirdPersonMovement</h2></div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>

          {/* ── Scene Setup TH ── */}
          <div className="prose">
            <h2>การตั้งค่า Scene</h2>
            <ol>
              <li>สร้าง ThirdPersonData asset และกำหนด walk/run speed, jump force, gravity, turn smooth time</li>
              <li>เพิ่ม CharacterController บน prefab root ตั้ง center, radius, height ให้ตรงกับ capsule</li>
              <li>เพิ่ม ThirdPersonMovement, PlayerInputHandler, ThirdPersonAnimator และ NetworkTransform บน prefab root</li>
              <li>ผูก reference ระหว่าง script ใน Inspector</li>
              <li>สร้าง Animator Controller พร้อม parameter Speed, IsRunning, IsGrounded และ locomotion blend tree</li>
              <li>ตั้งค่า NetworkTransform: เปิด Sync Position/Rotation, Interpolation, Authority = Server</li>
              <li>ลงทะเบียน prefab กับ NetworkManager และ spawn เมื่อผู้เล่นเชื่อมต่อ</li>
            </ol>
          </div>
        </DocPage>
      }
    />
  );
}
