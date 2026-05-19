import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Network Animator" };

const inspectorParamsEN = [
  {
    name: "Sync Parameters",
    type: "bool",
    default: "true",
    description: "Automatically synchronise all Animator parameters (bool, int, float, trigger) to every observer.",
  },
  {
    name: "Sync Layers",
    type: "bool",
    default: "true",
    description: "Synchronise layer weights so blended layers (e.g. an upper-body overlay) match across clients.",
  },
  {
    name: "SendIntervalTicks",
    type: "int",
    default: "1",
    description: "How many network ticks to wait between Animator state broadcasts. Higher values reduce bandwidth at the cost of animation smoothness.",
  },
  {
    name: "Owner Auth",
    type: "bool",
    default: "true",
    description: "When enabled, the owning client drives the Animator and syncs to all others. Disable to make the server the sole animation authority.",
  },
];

const inspectorParamsTH = [
  {
    name: "Sync Parameters",
    type: "bool",
    default: "true",
    description: "ซิงโครไนซ์ Animator parameters ทั้งหมด (bool, int, float, trigger) ไปยัง observer ทุกคนโดยอัตโนมัติ",
  },
  {
    name: "Sync Layers",
    type: "bool",
    default: "true",
    description: "ซิงโครไนซ์ layer weights เพื่อให้ blended layers (เช่น upper-body overlay) ตรงกันทั่ว clients",
  },
  {
    name: "SendIntervalTicks",
    type: "int",
    default: "1",
    description: "จำนวน network ticks ที่รอระหว่าง Animator state broadcasts ค่าสูงขึ้นลด bandwidth แต่ทำให้ animation ไม่ราบรื่น",
  },
  {
    name: "Owner Auth",
    type: "bool",
    default: "true",
    description: "เมื่อเปิดใช้ owning client จะขับเคลื่อน Animator และ sync ไปยังคนอื่น ปิดเพื่อให้ server เป็น animation authority เดียว",
  },
];

const characterAnimatorCode = `using PurrNet;
using UnityEngine;

[RequireComponent(typeof(NetworkAnimator))]
public class CharacterAnimator : NetworkBehaviour
{
    [SerializeField] private Animator _animator;
    [SerializeField] private CharacterController _controller;

    // Animator parameter hashes — computed once for performance
    private static readonly int SpeedHash     = Animator.StringToHash("Speed");
    private static readonly int IsGroundedHash = Animator.StringToHash("IsGrounded");
    private static readonly int JumpHash      = Animator.StringToHash("Jump");

    private void Update()
    {
        // Only the owner drives the Animator.
        // NetworkAnimator replicates these values to everyone else.
        if (!isOwner) return;

        float speed = new Vector2(_controller.velocity.x, _controller.velocity.z).magnitude;
        _animator.SetFloat(SpeedHash, speed, 0.1f, Time.deltaTime);
        _animator.SetBool(IsGroundedHash, _controller.isGrounded);
    }

    // Called by input system on the owner
    public void TriggerJump()
    {
        if (!isOwner) return;
        _animator.SetTrigger(JumpHash);
    }
}`;

const enemyAICode = `using PurrNet;
using UnityEngine;
using UnityEngine.AI;

// Owner Auth = false on the NetworkAnimator inspector — server drives animation
public class EnemyAI : NetworkBehaviour
{
    [SerializeField] private Animator _animator;
    [SerializeField] private NavMeshAgent _agent;

    private static readonly int SpeedHash   = Animator.StringToHash("Speed");
    private static readonly int AttackHash  = Animator.StringToHash("Attack");

    private void Update()
    {
        // Only server updates the Animator — replicated to all clients
        if (!isServer) return;

        _animator.SetFloat(SpeedHash, _agent.velocity.magnitude, 0.15f, Time.deltaTime);
    }

    // Server-side only: trigger an attack animation on all clients
    public void PerformAttack()
    {
        if (!isServer) return;
        _animator.SetTrigger(AttackHash);
    }
}`;

const playerCharacterCode = `// Animator state machine has:
//   Idle  → (Speed > 0.1)  → Run
//   Run   → (Speed < 0.1)  → Idle
//   Any   → [Jump trigger] → Jump → (exit time) → Idle/Run
//
// NetworkAnimator on the same GameObject with Owner Auth = true.

using PurrNet;
using UnityEngine;

public class PlayerCharacter : NetworkBehaviour
{
    [SerializeField] private Animator        _animator;
    [SerializeField] private CharacterController _cc;

    private static readonly int SpeedHash = Animator.StringToHash("Speed");
    private static readonly int JumpHash  = Animator.StringToHash("Jump");

    private Vector3 _velocity;
    private const float Gravity   = -9.81f;
    private const float JumpForce =  5.0f;
    private const float MoveSpeed =  4.0f;

    private void Update()
    {
        if (!isOwner) return;

        Vector2 input = new Vector2(Input.GetAxis("Horizontal"), Input.GetAxis("Vertical"));
        Vector3 move  = new Vector3(input.x, 0, input.y) * MoveSpeed;

        if (_cc.isGrounded)
        {
            _velocity.y = -0.5f;
            if (Input.GetButtonDown("Jump"))
            {
                _velocity.y = JumpForce;
                _animator.SetTrigger(JumpHash); // NetworkAnimator replicates this trigger
            }
        }
        else
        {
            _velocity.y += Gravity * Time.deltaTime;
        }

        _cc.Move((move + _velocity) * Time.deltaTime);
        _animator.SetFloat(SpeedHash, move.magnitude, 0.08f, Time.deltaTime);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Network Animator"
          description="NetworkAnimator is a plug-and-play component that automatically replicates Animator parameters, layer weights, and state transitions to every observer. Attach it alongside a NetworkIdentity — no code required for basic setups."
          badge="Plug & Play"
          href="/docs/network-animator"
        >
          <div className="prose">
            <h2>How it works</h2>
            <p>
              NetworkAnimator watches the local <code>Animator</code> component for parameter changes each tick. When a
              parameter value differs from its last-synced value by more than the configured tolerance, a compact
              parameter update is sent to all observers. On remote clients, the incoming values are written directly to
              their local <code>Animator</code>, which drives the state machine normally — no bespoke transition code
              required.
            </p>
            <p>
              State transitions fire naturally on every client because the state machine reacts to the replicated
              parameter values, just as it would to local input.
            </p>

            <h2>Inspector settings</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={inspectorParamsEN} />
          </div>

          <div className="prose">
            <h2>Owner-driven animation</h2>
            <p>
              The most common pattern is to let the owner set Animator parameters based on their local input, then have
              NetworkAnimator replicate those parameters to all other clients. Use the <code>isOwner</code> guard so
              non-authority clients never write to the Animator directly.
            </p>
          </div>

          <CodeBlock filename="CharacterAnimator.cs" language="csharp" code={characterAnimatorCode} />

          <Callout type="tip" title="Use triggers on reliable channels">
            Triggers are one-shot events — if the packet containing a trigger is dropped, the animation never fires on
            remote clients. Send trigger-bearing RPCs on a reliable channel, or use a counter-based{" "}
            <code>SyncVar&lt;int&gt;</code> as a poor-man&apos;s reliable trigger.
          </Callout>

          <div className="prose">
            <h2>Server-authoritative animation</h2>
            <p>
              For NPCs or physics-driven characters where the server controls movement, set <strong>Owner Auth</strong>{" "}
              to <code>false</code>. The server&apos;s Animator values are broadcast to all clients, and no client can
              override them.
            </p>
          </div>

          <CodeBlock filename="EnemyAI.cs" language="csharp" code={enemyAICode} />

          <div className="prose">
            <h2>Situational example — character with idle, run, and jump states</h2>
            <p>
              A typical third-person character uses three base states driven by two parameters: a float{" "}
              <code>Speed</code> and a trigger <code>Jump</code>. The owner sets these from the input system;
              NetworkAnimator handles the rest.
            </p>
          </div>

          <CodeBlock filename="PlayerCharacter.cs" language="csharp" code={playerCharacterCode} />

          <Callout type="warning" title="Never call Animator.Play() on non-authority clients">
            Calling <code>Animator.Play()</code> or <code>Animator.CrossFade()</code> on a remote client will fight
            with the incoming parameter syncs and cause visual glitching. Reserve direct state transitions to the
            authority side only, and let the state machine handle transitions from replicated parameter values
            everywhere else.
          </Callout>

          <Callout type="info" title="NetworkAnimator vs manual SyncVar animation">
            For simple two-state toggles (visible/hidden, open/closed door), a <code>SyncVar&lt;bool&gt;</code> with an{" "}
            <code>onChanged</code> callback that calls <code>Animator.SetBool()</code> is lighter than NetworkAnimator.
            Use NetworkAnimator when you have several parameters or complex blend trees.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Network Animator"
          description="NetworkAnimator คือ component แบบ plug-and-play ที่ replicate Animator parameters, layer weights และ state transitions ไปยัง observer ทุกคนโดยอัตโนมัติ ติดกับ NetworkIdentity — ไม่ต้องเขียนโค้ดสำหรับการตั้งค่าพื้นฐาน"
          badge="Plug & Play"
          href="/docs/network-animator"
        >
          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              NetworkAnimator ตรวจสอบ component <code>Animator</code> ในเครื่องเพื่อหาการเปลี่ยนแปลง
              parameter ทุก tick เมื่อค่า parameter แตกต่างจากค่าที่ sync ล่าสุดมากกว่า tolerance ที่ตั้งค่า
              จะส่ง compact parameter update ไปยัง observers ทั้งหมด บน remote clients ค่าที่เข้ามาจะถูก
              เขียนโดยตรงไปยัง <code>Animator</code> ในเครื่อง ซึ่งขับเคลื่อน state machine ตามปกติ —
              ไม่ต้องเขียนโค้ด transition เอง
            </p>
            <p>
              State transitions fire ตามปกติบนทุก client เพราะ state machine ตอบสนองต่อ parameter values
              ที่ replicated เหมือนกับที่ตอบสนองต่อ local input
            </p>

            <h2>การตั้งค่า Inspector</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={inspectorParamsTH} />
          </div>

          <div className="prose">
            <h2>Animation ที่ขับเคลื่อนโดย owner</h2>
            <p>
              รูปแบบที่พบบ่อยที่สุดคือให้ owner ตั้งค่า Animator parameters ตาม local input ของตัวเอง
              แล้วให้ NetworkAnimator replicate parameters เหล่านั้นไปยัง clients อื่นทั้งหมด ใช้ <code>isOwner</code>{" "}
              guard เพื่อให้ non-authority clients ไม่เขียนไปยัง Animator โดยตรง
            </p>
          </div>

          <CodeBlock filename="CharacterAnimator.cs" language="csharp" code={characterAnimatorCode} />

          <Callout type="tip" title="ใช้ triggers บน reliable channels">
            Triggers เป็น one-shot events — ถ้า packet ที่มี trigger หายไป animation จะไม่ fire
            บน remote clients ส่ง trigger-bearing RPCs บน reliable channel หรือใช้ counter-based
            <code>SyncVar&lt;int&gt;</code> เป็น reliable trigger แบบง่าย
          </Callout>

          <div className="prose">
            <h2>Animation ที่ server เป็น authority</h2>
            <p>
              สำหรับ NPCs หรือ characters ที่ขับเคลื่อนด้วย physics ที่ server ควบคุมการเคลื่อนที่
              ตั้งค่า <strong>Owner Auth</strong> เป็น <code>false</code> ค่า Animator ของ server จะ
              broadcast ไปยัง clients ทั้งหมดและไม่มี client ใดสามารถ override ได้
            </p>
          </div>

          <CodeBlock filename="EnemyAI.cs" language="csharp" code={enemyAICode} />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — ตัวละครที่มี idle, run และ jump states</h2>
            <p>
              ตัวละคร third-person ทั่วไปใช้สาม base states ที่ขับเคลื่อนด้วยสอง parameters:
              float <code>Speed</code> และ trigger <code>Jump</code> Owner ตั้งค่าเหล่านี้
              จาก input system; NetworkAnimator จัดการส่วนที่เหลือ
            </p>
          </div>

          <CodeBlock filename="PlayerCharacter.cs" language="csharp" code={playerCharacterCode} />

          <Callout type="warning" title="อย่าเรียก Animator.Play() บน non-authority clients">
            การเรียก <code>Animator.Play()</code> หรือ <code>Animator.CrossFade()</code> บน remote client
            จะขัดแย้งกับ parameter syncs ที่เข้ามาและทำให้เกิด visual glitching สงวน direct state
            transitions ไว้สำหรับ authority side เท่านั้น และปล่อยให้ state machine จัดการ transitions
            จาก replicated parameter values ในที่อื่นทั้งหมด
          </Callout>

          <Callout type="info" title="NetworkAnimator vs manual SyncVar animation">
            สำหรับ two-state toggles ง่ายๆ (visible/hidden, open/closed door) ใช้ <code>SyncVar&lt;bool&gt;</code>{" "}
            กับ <code>onChanged</code> callback ที่เรียก <code>Animator.SetBool()</code> จะเบากว่า
            NetworkAnimator ใช้ NetworkAnimator เมื่อมี parameters หลายตัวหรือ blend trees ที่ซับซ้อน
          </Callout>
        </DocPage>
      }
    />
  );
}
