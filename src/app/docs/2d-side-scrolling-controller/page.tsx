import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SideScroll2DViz } from "@/components/visualizers/SideScroll2DViz";

export const metadata = { title: "2D Side Scrolling Controller" };

const apiParamsEN = [
  { name: "NetworkTransform", type: "component", description: "Attach to sync position and rotation. Set Authority Mode to Owner so the owning client drives movement; all peers interpolate." },
  { name: "_animState (SyncVar<int>)", type: "SyncVar", description: "Integer encoding the current animation state: 0=Idle, 1=Walk, 2=Jump, 3=Fall, 4=Attack. Replicated to all peers." },
  { name: "_facingRight (SyncVar<bool>)", type: "SyncVar", description: "Owner-authoritative bool. All peers flip the sprite renderer scale based on this value." },
  { name: "JumpServerRpc()", type: "ServerRpc", description: "Sent by owner to apply the jump Rigidbody2D impulse on the server. The server then replicates position via NetworkTransform." },
  { name: "RpcOnAttack()", type: "ObserversRpc", description: "Sent by server to trigger the attack animation and hitbox on all peers simultaneously." },
];

const apiParamsTH = [
  { name: "NetworkTransform", type: "component", description: "ติดไว้เพื่อ sync ตำแหน่งและการหมุน ตั้ง Authority Mode เป็น Owner เพื่อให้ client ที่เป็นเจ้าของขับเคลื่อนการเคลื่อนที่ peer ทุกคน interpolate" },
  { name: "_animState (SyncVar<int>)", type: "SyncVar", description: "Integer ที่ encode สถานะ animation ปัจจุบัน: 0=Idle, 1=Walk, 2=Jump, 3=Fall, 4=Attack replicate ไปยังทุก peer" },
  { name: "_facingRight (SyncVar<bool>)", type: "SyncVar", description: "Owner-authoritative bool ทุก peer พลิก sprite renderer scale ตามค่านี้" },
  { name: "JumpServerRpc()", type: "ServerRpc", description: "ส่งโดย owner เพื่อ apply jump Rigidbody2D impulse บน server server จะ replicate ตำแหน่งผ่าน NetworkTransform" },
  { name: "RpcOnAttack()", type: "ObserversRpc", description: "ส่งโดย server เพื่อ trigger animation การโจมตีและ hitbox บนทุก peer พร้อมกัน" },
];

const controllerCode = `using PurrNet;
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D), typeof(NetworkTransform))]
public class NetworkSideScroll2D : NetworkBehaviour
{
    [Header("Movement")]
    [SerializeField] private float _moveSpeed   = 6f;
    [SerializeField] private float _jumpForce   = 12f;
    [SerializeField] private LayerMask _ground;

    [Header("References")]
    [SerializeField] private Animator           _anim;
    [SerializeField] private SpriteRenderer     _sprite;
    [SerializeField] private Transform          _groundCheck;
    [SerializeField] private Collider2D         _hitbox;

    // ── Network state ─────────────────────────────────────────────────────────

    private SyncVar<int>  _animState   = new(0);
    private SyncVar<bool> _facingRight = new(true, ownerAuth: true);

    private Rigidbody2D _rb;
    private bool _isGrounded;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override void OnSpawned()
    {
        _rb = GetComponent<Rigidbody2D>();
        _facingRight.onChanged += (_, r) => _sprite.flipX = !r;
        _animState.onChanged   += (_, s) => _anim.SetInteger("State", s);
    }

    private void Update()
    {
        _isGrounded = Physics2D.OverlapCircle(_groundCheck.position, 0.1f, _ground);

        if (isOwner) OwnerUpdate();
        else          _anim.SetFloat("VelocityY", _rb.linearVelocity.y);
    }

    // ── Owner input ───────────────────────────────────────────────────────────

    private void OwnerUpdate()
    {
        float h = Input.GetAxisRaw("Horizontal");
        _rb.linearVelocity = new Vector2(h * _moveSpeed, _rb.linearVelocity.y);

        if (h != 0) _facingRight.value = h > 0;

        // Animation state machine
        int state = 0;
        if (!_isGrounded)  state = _rb.linearVelocity.y > 0 ? 2 : 3; // jump / fall
        else if (h != 0)   state = 1;                                  // walk
        _animState.value = state;

        // Jump
        if (Input.GetButtonDown("Jump") && _isGrounded)
            JumpServerRpc();

        // Attack
        if (Input.GetButtonDown("Fire1"))
            AttackServerRpc();
    }

    // ── ServerRpcs ────────────────────────────────────────────────────────────

    /// <summary>Server applies the jump impulse so physics is authoritative.</summary>
    [ServerRpc]
    private void JumpServerRpc()
    {
        _rb.AddForce(Vector2.up * _jumpForce, ForceMode2D.Impulse);
        _animState.value = 2;
    }

    /// <summary>Server validates and triggers the attack on all peers.</summary>
    [ServerRpc]
    private void AttackServerRpc()
    {
        _animState.value = 4;
        RpcOnAttack();
    }

    /// <summary>Enables the hitbox on every peer in sync with the animation.</summary>
    [ObserversRpc(runLocally: true)]
    private void RpcOnAttack()
    {
        _anim.SetTrigger("Attack");
        StartCoroutine(ActivateHitbox(0.1f, 0.3f));
    }

    private System.Collections.IEnumerator ActivateHitbox(float delay, float duration)
    {
        yield return new WaitForSeconds(delay);
        _hitbox.enabled = true;
        yield return new WaitForSeconds(duration);
        _hitbox.enabled = false;
    }
}`;

const healthCode = `using PurrNet;
using UnityEngine;

/// <summary>Server-authoritative health for 2D platformer characters.</summary>
public class NetworkHealth2D : NetworkBehaviour
{
    [SerializeField] private int _maxHealth = 100;

    private SyncVar<int>  _health    = new(100);
    private SyncVar<bool> _isAlive   = new(true);

    public int  health  => _health.value;
    public bool isAlive => _isAlive.value;

    protected override void OnSpawned()
    {
        _health.value  = _maxHealth;
        _health.onChanged += (_, hp) => UIManager.UpdateHealthBar(hp, _maxHealth);
        _isAlive.onChanged += (_, alive) => { if (!alive) RpcOnDeath(); };
    }

    // Called by server-side hitbox collisions
    [Server]
    public void TakeDamage(int amount)
    {
        if (!_isAlive.value) return;

        _health.value = Mathf.Max(0, _health.value - amount);
        if (_health.value == 0) _isAlive.value = false;

        RpcOnHit();
    }

    [ObserversRpc(runLocally: true)]
    private void RpcOnHit()   => VFXManager.PlayHitEffect(transform.position);

    [ObserversRpc(runLocally: true)]
    private void RpcOnDeath() => VFXManager.PlayDeathEffect(transform.position);
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="2D Side Scrolling Controller"
          description="A PurrNet-ready 2D platformer controller. The owner reads input and drives movement locally; NetworkTransform replicates position to all peers. Jump and attack are validated server-side via ServerRpc, then broadcast with ObserversRpc so animations stay in sync on every client."
          badge="Example"
          href="/docs/2d-side-scrolling-controller"
        >
          <SideScroll2DViz />

          <div className="prose">
            <h2>Network architecture</h2>
            <p>
              The key rule for a 2D platformer: the <strong>owner drives movement</strong> locally
              with no round-trip delay, and <code>NetworkTransform</code> replicates the result to
              observers. Gameplay events that have server-side consequences (jump physics, attack
              hitboxes) go through a <code>ServerRpc</code> first, then fan out via{" "}
              <code>ObserversRpc</code>.
            </p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsEN} /></div>

          <div className="prose"><h2>Full controller</h2></div>
          <CodeBlock filename="NetworkSideScroll2D.cs" language="csharp" code={controllerCode} />

          <div className="prose"><h2>Server-authoritative health</h2></div>
          <CodeBlock filename="NetworkHealth2D.cs" language="csharp" code={healthCode} />

          <Callout type="tip" title="NetworkTransform authority mode">
            Set <strong>Authority Mode → Owner</strong> on NetworkTransform. The owner updates
            position every frame; non-owners interpolate. This eliminates the input latency that
            server-authority would introduce for the controlling player.
          </Callout>
          <Callout type="warning" title="Jump must go through ServerRpc">
            Never apply Rigidbody2D forces directly on the owner without a ServerRpc. Physics is
            simulated independently on each peer — if only the owner applies the force, observers
            see the character teleport upward when NetworkTransform syncs the post-jump position.
            Let the server apply the force; NetworkTransform does the rest.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="2D Side Scrolling Controller"
          description="Controller 2D platformer ที่พร้อมใช้กับ PurrNet owner อ่าน input และขับเคลื่อนการเคลื่อนที่ใน local; NetworkTransform replicate ตำแหน่งไปยังทุก peer Jump และ attack ถูก validate ฝั่ง server ผ่าน ServerRpc จากนั้น broadcast ด้วย ObserversRpc เพื่อให้ animations ซิงค์กันบนทุก client"
          badge="Example"
          href="/docs/2d-side-scrolling-controller"
        >
          <SideScroll2DViz />
          <div className="prose">
            <h2>สถาปัตยกรรมเครือข่าย</h2>
            <p>กฎสำคัญสำหรับ 2D platformer: <strong>owner ขับเคลื่อนการเคลื่อนที่</strong> ใน local โดยไม่มีความหน่วงของ round-trip และ <code>NetworkTransform</code> replicate ผลลัพธ์ไปยัง observers เหตุการณ์ gameplay ที่มีผลฝั่ง server (jump physics, attack hitboxes) ผ่าน <code>ServerRpc</code> ก่อน จากนั้น fan out ผ่าน <code>ObserversRpc</code></p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>
          <div className="prose"><h2>Controller เต็มรูปแบบ</h2></div>
          <CodeBlock filename="NetworkSideScroll2D.cs" language="csharp" code={controllerCode} />
          <div className="prose"><h2>Health แบบ server-authoritative</h2></div>
          <CodeBlock filename="NetworkHealth2D.cs" language="csharp" code={healthCode} />
          <Callout type="tip" title="Authority mode ของ NetworkTransform">ตั้ง <strong>Authority Mode → Owner</strong> บน NetworkTransform owner อัปเดตตำแหน่งทุก frame; non-owners interpolate วิธีนี้ขจัด input latency ที่ server-authority จะสร้างให้กับ player ที่ควบคุม</Callout>
          <Callout type="warning" title="Jump ต้องผ่าน ServerRpc">ห้าม apply Rigidbody2D forces โดยตรงบน owner โดยไม่มี ServerRpc Physics จำลองอิสระบนแต่ละ peer — ถ้าเฉพาะ owner apply force observers จะเห็น character teleport ขึ้นเมื่อ NetworkTransform sync ตำแหน่งหลัง jump ให้ server apply force; NetworkTransform จัดการส่วนที่เหลือ</Callout>
        </DocPage>
      }
    />
  );
}
