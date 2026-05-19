import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SyncInputVisualizer } from "@/components/visualizers/SyncInputVisualizer";

export const metadata = { title: "SyncInput" };

const propertyParamsEN = [
  { name: "value", type: "T", description: "The current input value. Only the owning client should write to this. All other machines read it." },
  { name: "onChanged", type: "event Action<T>", description: "Fires on the server (and other clients if configured) whenever a new input value arrives from the owner." },
  { name: "ownerAuth", type: "bool", default: "true", description: "Always true for SyncInput — only the owner can write input. This is not configurable; it is the defining feature of SyncInput." },
];

const comparisonParamsEN = [
  { name: "SyncInput<T>", type: "unreliable channel", description: "Dedicated input sync path. Uses an unreliable channel for minimum latency. Newest value wins — old packets are discarded. Best for continuous analog input (movement, aim)." },
  { name: "ServerRpc (Reliable)", type: "reliable channel", description: "Every call is guaranteed to arrive in order. Adds round-trip latency plus retransmission overhead. Best for discrete commands (jump, fire, interact) where missing a packet matters." },
  { name: "ServerRpc (Unreliable)", type: "unreliable channel", description: "Low latency but may drop packets. No built-in \"latest wins\" semantics — dropped packets cause gaps. SyncInput handles sequencing automatically, making it the better choice for continuous input." },
];

const propertyParamsTH = [
  { name: "value", type: "T", description: "ค่า input ปัจจุบัน เฉพาะ client ที่เป็นเจ้าของเท่านั้นที่ควรเขียน เครื่องอื่นทั้งหมดอ่านเท่านั้น" },
  { name: "onChanged", type: "event Action<T>", description: "Fire บน server (และ clients อื่นถ้าตั้งค่า) เมื่อใดก็ตามที่ input value ใหม่มาจาก owner" },
  { name: "ownerAuth", type: "bool", default: "true", description: "เป็น true เสมอสำหรับ SyncInput — เฉพาะ owner เท่านั้นที่สามารถเขียน input ไม่สามารถตั้งค่าได้ นี่คือ defining feature ของ SyncInput" },
];

const comparisonParamsTH = [
  { name: "SyncInput<T>", type: "unreliable channel", description: "Dedicated input sync path ใช้ unreliable channel สำหรับ latency ต่ำสุด ค่าล่าสุดชนะ — packets เก่าถูกทิ้ง เหมาะสำหรับ continuous analog input (movement, aim)" },
  { name: "ServerRpc (Reliable)", type: "reliable channel", description: "ทุกการเรียกรับประกันว่าจะมาถึงตามลำดับ เพิ่ม round-trip latency และ overhead การส่งซ้ำ เหมาะสำหรับ discrete commands (jump, fire, interact) ที่การพลาด packet มีความสำคัญ" },
  { name: "ServerRpc (Unreliable)", type: "unreliable channel", description: "Latency ต่ำแต่อาจ drop packets ไม่มี semantics 'latest wins' ในตัว — packets ที่หายทำให้เกิดช่องว่าง SyncInput จัดการ sequencing โดยอัตโนมัติทำให้เป็นตัวเลือกที่ดีกว่าสำหรับ continuous input" },
];

const basicUsageCode = `using PurrNet;
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class TopDownMovement : NetworkBehaviour
{
    [SerializeField] private float moveSpeed = 6f;

    // Owner writes each frame; server reads and applies physics
    private SyncInput<Vector2> _moveInput = new();
    private SyncInput<bool>    _sprintInput = new();

    private Rigidbody2D _rb;

    private void Awake()
    {
        _rb = GetComponent<Rigidbody2D>();

        // Server subscribes to react to incoming input
        if (isServer)
            _moveInput.onChanged += OnMoveInputReceived;
    }

    private void Update()
    {
        // Only the owner reads local input and writes to SyncInput
        if (!isOwner) return;

        float h = Input.GetAxisRaw("Horizontal");
        float v = Input.GetAxisRaw("Vertical");

        _moveInput.value   = new Vector2(h, v).normalized;
        _sprintInput.value = Input.GetKey(KeyCode.LeftShift);
    }

    private void OnMoveInputReceived(Vector2 input)
    {
        // Server-side: apply physics from the received input
        float speed = _sprintInput.value ? moveSpeed * 1.8f : moveSpeed;
        _rb.linearVelocity = input * speed;
    }

    private void FixedUpdate()
    {
        // Alternative: poll each physics tick instead of using onChanged
        if (!isServer) return;
        float speed = _sprintInput.value ? moveSpeed * 1.8f : moveSpeed;
        _rb.linearVelocity = _moveInput.value * speed;
    }
}`;

const aimingCode = `using PurrNet;
using UnityEngine;

public class PlayerAiming : NetworkBehaviour
{
    [SerializeField] private Transform turretPivot;

    // Continuous aim direction synced from owner → server
    private SyncInput<float> _aimAngle = new(); // angle in degrees

    private void Awake()
    {
        // Server reads aim angle to validate hit detection
        if (isServer)
            _aimAngle.onChanged += OnAimChanged;
    }

    private void Update()
    {
        if (isOwner)
        {
            // Mouse aim
            Vector3 mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
            Vector2 dir = (mouseWorld - transform.position).normalized;
            float angle = Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg;
            _aimAngle.value = angle;
        }

        // All clients can read the synced value to rotate the visual
        turretPivot.rotation = Quaternion.Euler(0, 0, _aimAngle.value);
    }

    private void OnAimChanged(float angle)
    {
        // Server updates its authoritative aim state for hit-scan validation
        ServerAimRegistry.UpdateAim(owner, angle);
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdFireWeapon()
    {
        // Server already has the latest aim angle from SyncInput
        float angle = _aimAngle.value;
        Vector2 dir = new Vector2(Mathf.Cos(angle * Mathf.Deg2Rad), Mathf.Sin(angle * Mathf.Deg2Rad));

        var hit = Physics2D.Raycast(transform.position, dir, 50f);
        if (hit.collider && hit.collider.TryGetComponent<PlayerHealth>(out var health))
            health.CmdTakeDamage(25);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="SyncInput"
          description="SyncInput&lt;T&gt; synchronises raw player input from the owning client to the server using an unreliable fast path, giving the server the freshest possible input with minimal bandwidth."
          badge="Sync Type"
          href="/docs/sync-input"
        >
          <div className="not-prose mb-6">
            <SyncInputVisualizer showControls />
          </div>

          <div className="prose">
            <h2>Why SyncInput exists</h2>
            <p>
              The conventional approach for server-authoritative movement is to send a <code>[ServerRpc]</code> every frame. This works, but reliable RPCs add round-trip latency and the ordered delivery guarantee wastes bandwidth for data where only the latest value matters. <code>SyncInput&lt;T&gt;</code> is purpose-built for this case: it uses an unreliable channel, discards out-of-order packets automatically, and sends the freshest input each tick — giving the server the lowest-latency view of what the player is doing without the overhead of a full RPC.
            </p>

            <h2>Properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={propertyParamsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
            <p>
              Declare a <code>SyncInput&lt;T&gt;</code> field on your <code>NetworkBehaviour</code>. The owner writes <code>.value</code> every frame; the server reads the latest value via <code>onChanged</code> or by polling <code>.value</code> directly.
            </p>
          </div>

          <CodeBlock
            filename="TopDownMovement.cs"
            language="csharp"
            code={basicUsageCode}
          />

          <div className="prose">
            <h2>Situational example — aim direction for a twin-stick shooter</h2>
            <p>
              In a top-down twin-stick shooter, the aim direction changes every frame based on the right thumbstick or mouse position. Sending this as a reliable RPC would be wasteful — if a packet drops the next one makes it irrelevant anyway.
            </p>
          </div>

          <CodeBlock
            filename="PlayerAiming.cs"
            language="csharp"
            code={aimingCode}
          />

          <div className="prose">
            <h2>SyncInput vs ServerRpc for input</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={comparisonParamsEN} />
          </div>

          <Callout type="info" title="SyncInput uses an unreliable channel by default">
            Packets sent via SyncInput may arrive out of order or not at all. PurrNet automatically discards any packet whose sequence number is older than the last-received value, so <code>.value</code> always reflects the most recent input the server has seen. This is ideal for analog axes but unsuitable for discrete commands like jumping or firing — use a reliable <code>[ServerRpc]</code> for those.
          </Callout>

          <Callout type="tip" title="Combine SyncInput with ServerRpc for mixed schemes">
            A common pattern is to use <code>SyncInput&lt;Vector2&gt;</code> for continuous movement and aim, and separate <code>[ServerRpc]</code> calls for discrete actions like jumping, dashing, or using an ability. This gives you low-latency input for analogue axes while guaranteeing delivery for one-shot commands.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="SyncInput"
          description="SyncInput&lt;T&gt; ซิงโครไนซ์ raw player input จาก owning client ไปยัง server โดยใช้ unreliable fast path ให้ server ได้รับ input ที่ fresh ที่สุดด้วย bandwidth ต่ำสุด"
          badge="Sync Type"
          href="/docs/sync-input"
        >
          <div className="not-prose mb-6">
            <SyncInputVisualizer showControls />
          </div>

          <div className="prose">
            <h2>เหตุใด SyncInput จึงมีอยู่</h2>
            <p>
              วิธีทั่วไปสำหรับการเคลื่อนที่แบบ server-authoritative คือส่ง{" "}
              <code>[ServerRpc]</code> ทุก frame ซึ่งใช้งานได้ แต่ reliable RPCs เพิ่ม round-trip latency
              และการรับประกันการส่งตามลำดับทำให้สิ้นเปลือง bandwidth สำหรับข้อมูลที่ต้องการเฉพาะค่าล่าสุด
              <code>SyncInput&lt;T&gt;</code> ถูกสร้างมาเพื่อกรณีนี้โดยเฉพาะ: ใช้ unreliable channel,
              ทิ้ง out-of-order packets โดยอัตโนมัติ และส่ง input ล่าสุดทุก tick — ให้ server มอง
              สิ่งที่ผู้เล่นทำด้วย latency ต่ำสุดโดยไม่มี overhead ของ RPC เต็มรูปแบบ
            </p>

            <h2>Properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={propertyParamsTH} />
          </div>

          <div className="prose">
            <h2>การใช้พื้นฐาน</h2>
            <p>
              ประกาศ <code>SyncInput&lt;T&gt;</code> field บน <code>NetworkBehaviour</code> ของคุณ
              Owner เขียน <code>.value</code> ทุก frame; server อ่านค่าล่าสุดผ่าน
              <code>onChanged</code> หรือโดยการ poll <code>.value</code> โดยตรง
            </p>
          </div>

          <CodeBlock
            filename="TopDownMovement.cs"
            language="csharp"
            code={basicUsageCode}
          />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — aim direction สำหรับ twin-stick shooter</h2>
            <p>
              ใน top-down twin-stick shooter ทิศทาง aim เปลี่ยนทุก frame ตาม right thumbstick หรือตำแหน่ง
              mouse การส่งเป็น reliable RPC จะสิ้นเปลือง — ถ้า packet หายตัวถัดไปก็ทำให้ไม่จำเป็นอยู่ดี
            </p>
          </div>

          <CodeBlock
            filename="PlayerAiming.cs"
            language="csharp"
            code={aimingCode}
          />

          <div className="prose">
            <h2>SyncInput vs ServerRpc สำหรับ input</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={comparisonParamsTH} />
          </div>

          <Callout type="info" title="SyncInput ใช้ unreliable channel โดยค่าเริ่มต้น">
            Packets ที่ส่งผ่าน SyncInput อาจมาถึงไม่เป็นลำดับหรือไม่มาเลย PurrNet ทิ้ง packet ใดก็ตาม
            ที่มี sequence number เก่ากว่าค่าที่รับล่าสุดโดยอัตโนมัติ ดังนั้น <code>.value</code> จะ
            สะท้อน input ล่าสุดที่ server เห็นเสมอ เหมาะสำหรับ analog axes แต่ไม่เหมาะสำหรับ discrete
            commands เช่น jumping หรือ firing — ใช้ reliable <code>[ServerRpc]</code> สำหรับสิ่งเหล่านั้น
          </Callout>

          <Callout type="tip" title="รวม SyncInput กับ ServerRpc สำหรับ mixed schemes">
            รูปแบบที่พบบ่อยคือใช้ <code>SyncInput&lt;Vector2&gt;</code> สำหรับ movement และ aim แบบ
            continuous และ <code>[ServerRpc]</code> แยกต่างหากสำหรับ discrete actions เช่น jumping,
            dashing หรือใช้ ability วิธีนี้ให้ input latency ต่ำสำหรับ analog axes ในขณะที่รับประกัน
            การส่งสำหรับ one-shot commands
          </Callout>
        </DocPage>
      }
    />
  );
}
