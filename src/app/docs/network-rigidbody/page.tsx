import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Network Rigidbody" };

const inspectorParamsEN = [
  {
    name: "Sync Velocity",
    type: "bool",
    default: "true",
    description: "Replicate the Rigidbody's linear velocity so remote bodies continue moving smoothly between snapshots.",
  },
  {
    name: "Sync Angular Velocity",
    type: "bool",
    default: "true",
    description: "Replicate rotational velocity. Disable for objects that should not spin (e.g. capsule characters).",
  },
  {
    name: "Interpolation Mode",
    type: "InterpolationMode",
    default: "Interpolate",
    description: "How remote bodies are smoothed: Interpolate (smooth), Extrapolate (low-latency but can overshoot), or None (snap).",
  },
  {
    name: "Owner Auth",
    type: "bool",
    default: "true",
    description: "Owner sends physics state updates. Set to false to make the server the sole physics authority.",
  },
  {
    name: "Send Interval (ticks)",
    type: "int",
    default: "1",
    description: "Ticks between physics state snapshots. Higher values reduce bandwidth but increase interpolation error.",
  },
  {
    name: "Position Tolerance",
    type: "float",
    default: "0.01",
    description: "Minimum position delta (metres) before a new snapshot is sent. Prevents spam when the object is at rest.",
  },
];

const inspectorParamsTH = [
  {
    name: "Sync Velocity",
    type: "bool",
    default: "true",
    description: "Replicate linear velocity ของ Rigidbody เพื่อให้ remote bodies เคลื่อนที่อย่างราบรื่นระหว่าง snapshots",
  },
  {
    name: "Sync Angular Velocity",
    type: "bool",
    default: "true",
    description: "Replicate rotational velocity ปิดสำหรับ objects ที่ไม่ควรหมุน (เช่น capsule characters)",
  },
  {
    name: "Interpolation Mode",
    type: "InterpolationMode",
    default: "Interpolate",
    description: "วิธีที่ remote bodies ถูก smooth: Interpolate (smooth), Extrapolate (low-latency แต่อาจ overshoot) หรือ None (snap)",
  },
  {
    name: "Owner Auth",
    type: "bool",
    default: "true",
    description: "Owner ส่ง physics state updates ตั้งค่าเป็น false เพื่อให้ server เป็น physics authority เดียว",
  },
  {
    name: "Send Interval (ticks)",
    type: "int",
    default: "1",
    description: "Ticks ระหว่าง physics state snapshots ค่าสูงลด bandwidth แต่เพิ่ม interpolation error",
  },
  {
    name: "Position Tolerance",
    type: "float",
    default: "0.01",
    description: "Position delta ขั้นต่ำ (เมตร) ก่อนที่จะส่ง snapshot ใหม่ ป้องกัน spam เมื่อ object อยู่นิ่ง",
  },
];

const throwableCode = `using PurrNet;
using UnityEngine;

[RequireComponent(typeof(NetworkRigidbody))]
public class ThrowableObject : NetworkBehaviour
{
    [SerializeField] private Rigidbody _rb;

    // Server spawns the object and grants ownership to the thrower
    [ServerRpc(requireOwnership: false)]
    public void CmdThrow(Vector3 force, Vector3 torque, RPCInfo info = default)
    {
        if (!info.asServer) return;

        // Give ownership to the client who threw it so they drive physics
        GiveOwnership(info.sender);
        ApplyForceOwner(force, torque);
    }

    // Runs on the new owner after CmdThrow transfers ownership
    [ObserversRpc(runLocally: true)]
    private void ApplyForceOwner(Vector3 force, Vector3 torque)
    {
        if (!isOwner) return;

        _rb.AddForce(force, ForceMode.Impulse);
        _rb.AddTorque(torque, ForceMode.Impulse);
    }

    // Only the authority should do physics work
    private void OnCollisionEnter(Collision col)
    {
        if (!isOwner && !isServer) return;
        // Handle bounce, damage, etc.
    }
}`;

const grenadeCode = `using PurrNet;
using UnityEngine;
using System.Collections;

[RequireComponent(typeof(NetworkRigidbody))]
public class Grenade : NetworkBehaviour
{
    [SerializeField] private Rigidbody _rb;
    [SerializeField] private float     _fuseTime    = 3f;
    [SerializeField] private float     _blastRadius = 8f;
    [SerializeField] private int       _damage      = 80;

    protected override void OnSpawned()
    {
        if (isServer) StartCoroutine(FuseCoroutine());
    }

    // Called by the server after granting ownership to the thrower
    public void Launch(Vector3 velocity)
    {
        if (!isOwner) return;
        _rb.linearVelocity = velocity;
        _rb.AddTorque(Random.insideUnitSphere * 5f, ForceMode.Impulse);
    }

    private IEnumerator FuseCoroutine()
    {
        yield return new WaitForSeconds(_fuseTime);
        Explode();
    }

    [Server]
    private void Explode()
    {
        Collider[] hits = Physics.OverlapSphere(transform.position, _blastRadius);
        foreach (var hit in hits)
        {
            if (hit.TryGetComponent<HealthModule>(out var health))
            {
                float dist    = Vector3.Distance(transform.position, hit.transform.position);
                float falloff = 1f - (dist / _blastRadius);
                health.TakeDamage(Mathf.RoundToInt(_damage * falloff));
            }
        }

        RpcExplodeEffect();
        networkManager.Despawn(gameObject);
    }

    [ObserversRpc]
    private void RpcExplodeEffect()
    {
        ExplosionPool.Spawn(transform.position);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Network Rigidbody"
          description="NetworkRigidbody synchronises physics state — position, rotation, velocity, and angular velocity — so remote Rigidbodies behave physically on every client, not just snap to transform positions."
          badge="Plug & Play"
          href="/docs/network-rigidbody"
        >
          <div className="prose">
            <h2>NetworkRigidbody vs NetworkTransform</h2>
            <p>
              <strong>NetworkTransform</strong> synchronises the raw transform values (position and rotation). This
              works well for kinematic or character-controller driven objects, but for physics-simulated objects it
              ignores velocity — meaning remote bodies stop dead between snapshots and miss bounces, tumbles, or
              collisions.
            </p>
            <p>
              <strong>NetworkRigidbody</strong> synchronises the full physics state. Remote clients apply the received
              velocity to their local Rigidbody, so Unity&apos;s physics engine continues the simulation between
              packets. The object bounces, rolls, and spins naturally even under high latency.
            </p>

            <h2>Inspector settings</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={inspectorParamsEN} />
          </div>

          <div className="prose">
            <h2>Owner-driven forces</h2>
            <p>
              The owner of an object applies forces or impulses to their local Rigidbody, and NetworkRigidbody
              broadcasts the resulting physics state to all clients. Never apply forces on non-authority clients —
              those bodies are being driven by received state.
            </p>
          </div>

          <CodeBlock filename="ThrowableObject.cs" language="csharp" code={throwableCode} />

          <div className="prose">
            <h2>Situational example — networked grenade</h2>
            <p>
              A grenade is spawned by the server, ownership transferred to the throwing client so they drive the
              physics. All clients see it tumble and bounce accurately. When it explodes (server-side), ownership
              returns to null.
            </p>
          </div>

          <CodeBlock filename="Grenade.cs" language="csharp" code={grenadeCode} />

          <Callout type="warning" title="Kinematic Rigidbodies">
            If the Rigidbody is set to <code>isKinematic = true</code>, Unity ignores velocity — use NetworkTransform
            instead. NetworkRigidbody only makes sense for non-kinematic bodies where you want the remote physics
            simulation to continue between snapshots.
          </Callout>

          <Callout type="tip" title="Apply forces on owner or server, never on remote clients">
            If you call <code>AddForce()</code> on a non-authority client, the next incoming snapshot will immediately
            override it, causing a visual jerk. Always guard physics mutations with <code>if (isOwner)</code> or{" "}
            <code>if (isServer)</code>.
          </Callout>

          <Callout type="info" title="Sleeping Rigidbodies">
            NetworkRigidbody automatically stops sending snapshots when the Rigidbody enters sleep mode (velocity below
            Unity&apos;s sleep threshold). This saves bandwidth for stacks of crates or scattered debris once they
            settle. Waking the body — via a collision or force — resumes syncing.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Network Rigidbody"
          description="NetworkRigidbody ซิงโครไนซ์ physics state — position, rotation, velocity และ angular velocity — เพื่อให้ remote Rigidbodies มีพฤติกรรมทางฟิสิกส์บนทุก client ไม่ใช่แค่ snap ไปยัง transform positions"
          badge="Plug & Play"
          href="/docs/network-rigidbody"
        >
          <div className="prose">
            <h2>NetworkRigidbody vs NetworkTransform</h2>
            <p>
              <strong>NetworkTransform</strong> ซิงโครไนซ์ raw transform values (position และ rotation)
              ซึ่งใช้งานได้ดีสำหรับ kinematic หรือ character-controller driven objects แต่สำหรับ
              physics-simulated objects จะไม่สนใจ velocity — หมายความว่า remote bodies หยุดนิ่งระหว่าง
              snapshots และพลาด bounces, tumbles หรือ collisions
            </p>
            <p>
              <strong>NetworkRigidbody</strong> ซิงโครไนซ์ physics state ทั้งหมด Remote clients apply
              velocity ที่ได้รับไปยัง local Rigidbody เพื่อให้ physics engine ของ Unity ดำเนินการ
              simulation ต่อระหว่าง packets Object จะ bounce, roll และ spin ตามธรรมชาติแม้ภายใต้
              latency สูง
            </p>

            <h2>การตั้งค่า Inspector</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={inspectorParamsTH} />
          </div>

          <div className="prose">
            <h2>Forces ที่ขับเคลื่อนโดย owner</h2>
            <p>
              Owner ของ object apply forces หรือ impulses ไปยัง local Rigidbody ของตัวเอง และ
              NetworkRigidbody จะ broadcast physics state ที่ได้ไปยัง clients ทั้งหมด อย่า apply forces
              บน non-authority clients — bodies เหล่านั้นกำลังถูกขับเคลื่อนด้วย state ที่ได้รับ
            </p>
          </div>

          <CodeBlock filename="ThrowableObject.cs" language="csharp" code={throwableCode} />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — ระเบิดบนเครือข่าย</h2>
            <p>
              ระเบิดถูก spawn โดย server โดย ownership ถ่ายโอนไปยัง client ที่ขว้างเพื่อให้ขับเคลื่อน
              physics ทุก clients เห็นมัน tumble และ bounce อย่างแม่นยำ เมื่อระเบิด (server-side)
              ownership จะกลับมาเป็น null
            </p>
          </div>

          <CodeBlock filename="Grenade.cs" language="csharp" code={grenadeCode} />

          <Callout type="warning" title="Kinematic Rigidbodies">
            ถ้า Rigidbody ตั้งค่าเป็น <code>isKinematic = true</code> Unity จะไม่สนใจ velocity — ใช้
            NetworkTransform แทน NetworkRigidbody สมเหตุสมผลสำหรับ non-kinematic bodies เท่านั้น
            ที่คุณต้องการให้ remote physics simulation ดำเนินต่อระหว่าง snapshots
          </Callout>

          <Callout type="tip" title="Apply forces บน owner หรือ server เท่านั้น ไม่ใช่ remote clients">
            ถ้าคุณเรียก <code>AddForce()</code> บน non-authority client snapshot ที่เข้ามาถัดไปจะ
            override ทันที ทำให้เกิด visual jerk ป้องกัน physics mutations ด้วย{" "}
            <code>if (isOwner)</code> หรือ <code>if (isServer)</code> เสมอ
          </Callout>

          <Callout type="info" title="Sleeping Rigidbodies">
            NetworkRigidbody หยุดส่ง snapshots โดยอัตโนมัติเมื่อ Rigidbody เข้าสู่ sleep mode
            (velocity ต่ำกว่า sleep threshold ของ Unity) ซึ่งประหยัด bandwidth สำหรับกองลัง
            หรือ debris ที่กระจัดกระจายเมื่อตกตะกอน การ wake body — ผ่าน collision หรือ force — จะ
            resume syncing
          </Callout>
        </DocPage>
      }
    />
  );
}
