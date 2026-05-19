import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { PredictionVisualizer } from "@/components/visualizers/PredictionVisualizer";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Client-Side Prediction" };

const keyClassParamsEN = [
  {
    name: "PredictedIdentity",
    type: "class",
    description:
      "Base class for any networked object that participates in prediction. Replaces NetworkBehaviour. Manages the rollback buffer and reconciliation loop.",
  },
  {
    name: "PredictedModule",
    type: "class",
    description:
      "Module equivalent of PredictedIdentity — attach to a PredictedIdentity field for modular prediction logic (movement, abilities, etc.).",
  },
  {
    name: "InputState",
    type: "abstract struct : IPackedAuto",
    description:
      "Your input snapshot for one tick. Implement this with your movement axes, jump flags, aim direction, etc.",
  },
  {
    name: "WorldState",
    type: "abstract struct : IPackedAuto",
    description:
      "Your character's authoritative state snapshot. Position, velocity, health — anything the server simulates. Must be byte-comparable for reconciliation.",
  },
  {
    name: "ReconcileThreshold",
    type: "float",
    description:
      "Maximum allowed difference (world units) between predicted and server state before a reconciliation snap is triggered.",
  },
];

const keyClassParamsTH = [
  {
    name: "PredictedIdentity",
    type: "class",
    description:
      "Base class สำหรับ networked object ใดก็ตามที่เข้าร่วมใน prediction แทน NetworkBehaviour จัดการ rollback buffer และ reconciliation loop",
  },
  {
    name: "PredictedModule",
    type: "class",
    description:
      "Module equivalent ของ PredictedIdentity — attach ไปยัง PredictedIdentity field สำหรับ modular prediction logic (movement, abilities เป็นต้น)",
  },
  {
    name: "InputState",
    type: "abstract struct : IPackedAuto",
    description:
      "Input snapshot ของคุณสำหรับหนึ่ง tick Implement ด้วย movement axes, jump flags, aim direction เป็นต้น",
  },
  {
    name: "WorldState",
    type: "abstract struct : IPackedAuto",
    description:
      "Authoritative state snapshot ของตัวละคร Position, velocity, health — ทุกอย่างที่ server simulate ต้องเป็น byte-comparable สำหรับ reconciliation",
  },
  {
    name: "ReconcileThreshold",
    type: "float",
    description:
      "ความแตกต่างสูงสุดที่อนุญาต (world units) ระหว่าง predicted และ server state ก่อนที่ reconciliation snap จะถูก trigger",
  },
];

const predictedCharacterCode = `using PurrNet;
using PurrDiction;
using UnityEngine;

// InputState: sampled once per tick on the owner
[RegisterNetworkType(typeof(CharacterInput))]
public struct CharacterInput : IPackedAuto
{
    public Vector2 moveAxis;  // WASD / left stick
    public bool    jump;
    public float   aimYaw;    // horizontal look angle
}

// WorldState: authoritative snapshot — must be byte-comparable
[RegisterNetworkType(typeof(CharacterState))]
public struct CharacterState : IPackedAuto
{
    public Vector3 position;
    public Vector3 velocity;
    public bool    isGrounded;
}

public class PredictedCharacter : PredictedIdentity<CharacterInput, CharacterState>
{
    [SerializeField] private CharacterController _cc;
    [SerializeField] private float               _moveSpeed = 5f;
    [SerializeField] private float               _jumpForce = 6f;

    private Vector3 _velocity;

    // --- Override: gather input from the local player ---
    protected override CharacterInput GatherInput()
    {
        return new CharacterInput
        {
            moveAxis = new Vector2(Input.GetAxis("Horizontal"), Input.GetAxis("Vertical")),
            jump     = Input.GetButtonDown("Jump"),
            aimYaw   = Camera.main.transform.eulerAngles.y,
        };
    }

    // --- Override: simulate one tick given an input (runs on client AND server) ---
    protected override void SimulateTick(CharacterInput input, float dt)
    {
        Vector3 move = new Vector3(input.moveAxis.x, 0, input.moveAxis.y);
        move = Quaternion.Euler(0, input.aimYaw, 0) * move * _moveSpeed;

        if (_cc.isGrounded)
        {
            _velocity.y = input.jump ? _jumpForce : -0.5f;
        }
        else
        {
            _velocity.y += Physics.gravity.y * dt;
        }

        _cc.Move((move + new Vector3(0, _velocity.y, 0)) * dt);
    }

    // --- Override: capture current state snapshot ---
    protected override CharacterState CaptureState()
    {
        return new CharacterState
        {
            position   = transform.position,
            velocity   = _velocity,
            isGrounded = _cc.isGrounded,
        };
    }

    // --- Override: apply a state snapshot (used during reconciliation) ---
    protected override void ApplyState(CharacterState state)
    {
        // Teleport to the authoritative position without interpolation
        Physics.SyncTransforms();
        transform.position = state.position;
        _velocity          = state.velocity;
        Physics.SyncTransforms();
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Client-Side Prediction"
          description="PurrDiction is a separate PurrNet module that adds client-side prediction and server reconciliation. The client acts immediately on input while the server remains authoritative — divergences are corrected with a seamless snap."
          badge="PurrDiction"
          href="/docs/client-side-prediction"
        >
          <div className="not-prose mb-6">
            <PredictionVisualizer />
          </div>

          <div className="prose">
            <h2>What is PurrDiction?</h2>
            <p>
              Standard <code>NetworkTransform</code> introduces a delay equal to your round-trip
              time before the player sees the result of their own input. At 100 ms ping this is
              noticeable; at 200 ms it feels broken. PurrDiction eliminates this by running the game
              simulation locally on the client <em>before</em> the server confirms it, then
              correcting any errors when the authoritative result arrives.
            </p>
            <p>
              PurrDiction is a separate Unity package built on top of PurrNet. Install it alongside
              PurrNet; it does not replace any existing functionality.
            </p>

            <h2>Core concepts</h2>
            <ul>
              <li>
                <strong>Input prediction:</strong> The client applies input immediately to a local
                simulation. The player sees responsive movement with zero perceived latency.
              </li>
              <li>
                <strong>Server simulation:</strong> The server receives the same input stream (with
                a tick timestamp) and simulates the same logic. The server&apos;s result is
                authoritative.
              </li>
              <li>
                <strong>Reconciliation:</strong> When the server&apos;s acknowledged state arrives,
                the client compares it to its own history. If the difference exceeds{" "}
                <code>ReconcileThreshold</code>, the client rewinds to the server state and replays
                all unacknowledged inputs forward — producing a seamless correction.
              </li>
            </ul>

            <h2>Key classes</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={keyClassParamsEN} />
          </div>

          <div className="prose">
            <h2>The prediction loop</h2>
            <ol>
              <li>Each tick the owner samples input and stores it in a ring buffer.</li>
              <li>Input is applied locally to advance the character state (client-side).</li>
              <li>Input is sent to the server along with the current tick number.</li>
              <li>The server simulates the same input and broadcasts the resulting state.</li>
              <li>
                The client receives the server state and compares it to the buffer entry for that
                tick.
              </li>
              <li>
                If the difference exceeds the threshold, the client rewinds to the server state and
                re-simulates all ticks from that point forward using the buffered inputs.
              </li>
            </ol>

            <h2>Minimal predicted character controller</h2>
          </div>

          <CodeBlock
            filename="PredictedCharacter.cs"
            language="csharp"
            code={predictedCharacterCode}
          />

          <div className="prose">
            <h2>When to use PurrDiction</h2>
            <h3>Good candidates</h3>
            <ul>
              <li>First-person and third-person shooters — responsive movement is critical</li>
              <li>Platformers — jump timing must feel instant</li>
              <li>Racing games — steering and acceleration must not feel delayed</li>
              <li>
                Battle royale / competitive games with low tolerance for latency feel
              </li>
            </ul>
            <h3>Poor candidates</h3>
            <ul>
              <li>
                Turn-based strategy — no continuous input; prediction adds complexity for no benefit
              </li>
              <li>
                RPGs with complex server-side state (stats, quests, economy) — reconciliation is
                expensive
              </li>
              <li>Puzzle games or card games — latency is irrelevant; use standard RPCs</li>
              <li>
                Simple mobile games — NetworkTransform with interpolation is usually good enough
              </li>
            </ul>
          </div>

          <Callout type="warning" title="Prediction adds significant complexity">
            PurrDiction requires every game system that affects the predicted character — movement,
            physics, abilities, collision — to be written as a deterministic, tick-based simulation
            that runs identically on client and server. Retrofitting an existing codebase can be a
            large effort. Start with standard <code>NetworkTransform</code> and add prediction only
            when you have measured that latency is a real problem for your players.
          </Callout>

          <Callout type="tip" title="Start with NetworkTransform first">
            For most indie games, <code>NetworkTransform</code> with interpolation is perfectly
            acceptable. Players tolerate ~100 ms of movement lag in cooperative games. Only reach
            for PurrDiction when building a competitive game where prediction error means losing a
            fight.
          </Callout>

          <Callout type="info" title="PurrDiction is a separate package">
            Install PurrDiction from the Package Manager using its separate Git URL or UPM package
            ID. It depends on PurrNet but does not ship with it. Check the PurrNet Discord or
            GitHub for the latest release tag.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Client-Side Prediction"
          description="PurrDiction คือ PurrNet module แยกต่างหากที่เพิ่ม client-side prediction และ server reconciliation Client ทำงานทันทีบน input ในขณะที่ server ยังคงเป็น authoritative — ความไม่สอดคล้องถูกแก้ไขด้วย snap ที่ราบรื่น"
          badge="PurrDiction"
          href="/docs/client-side-prediction"
        >
          <div className="not-prose mb-6">
            <PredictionVisualizer />
          </div>

          <div className="prose">
            <h2>PurrDiction คืออะไร?</h2>
            <p>
              <code>NetworkTransform</code> มาตรฐาน introduces delay เท่ากับ round-trip time
              ก่อนที่ผู้เล่นจะเห็นผลลัพธ์ของ input ของตัวเอง ที่ ping 100 ms สิ่งนี้สังเกตเห็นได้
              ที่ 200 ms รู้สึกพังทลาย PurrDiction ขจัดสิ่งนี้โดยการเรียกใช้ game simulation
              ในเครื่องบน client <em>ก่อน</em>ที่ server จะยืนยัน แล้วแก้ไขข้อผิดพลาดเมื่อ
              authoritative result มาถึง
            </p>
            <p>
              PurrDiction คือ Unity package แยกต่างหากที่สร้างบน PurrNet ติดตั้งควบคู่กับ PurrNet
              ไม่แทนที่ functionality ที่มีอยู่
            </p>

            <h2>แนวคิดหลัก</h2>
            <ul>
              <li>
                <strong>Input prediction:</strong> Client apply input ทันทีกับ local simulation
                ผู้เล่นเห็นการเคลื่อนที่ที่ตอบสนองด้วย zero perceived latency
              </li>
              <li>
                <strong>Server simulation:</strong> Server รับ input stream เดียวกัน (พร้อม tick
                timestamp) และ simulate logic เดียวกัน ผลลัพธ์ของ server เป็น authoritative
              </li>
              <li>
                <strong>Reconciliation:</strong> เมื่อ acknowledged state ของ server มาถึง client
                เปรียบเทียบกับ history ของตัวเอง ถ้าความแตกต่างเกิน{" "}
                <code>ReconcileThreshold</code> client จะ rewind ไปยัง server state และ replay
                unacknowledged inputs ทั้งหมดไปข้างหน้า — ให้การแก้ไขที่ราบรื่น
              </li>
            </ul>

            <h2>คลาสหลัก</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={keyClassParamsTH} />
          </div>

          <div className="prose">
            <h2>Prediction loop</h2>
            <ol>
              <li>แต่ละ tick owner จะ sample input และเก็บใน ring buffer</li>
              <li>Input ถูก apply ในเครื่องเพื่อ advance character state (client-side)</li>
              <li>Input ถูกส่งไปยัง server พร้อม tick number ปัจจุบัน</li>
              <li>Server simulate input เดียวกันและ broadcast resulting state</li>
              <li>Client รับ server state และเปรียบเทียบกับ buffer entry สำหรับ tick นั้น</li>
              <li>
                ถ้าความแตกต่างเกิน threshold client จะ rewind ไปยัง server state และ re-simulate
                ticks ทั้งหมดจากจุดนั้นไปข้างหน้าโดยใช้ buffered inputs
              </li>
            </ol>

            <h2>Character controller ที่ predict แบบ minimal</h2>
          </div>

          <CodeBlock
            filename="PredictedCharacter.cs"
            language="csharp"
            code={predictedCharacterCode}
          />

          <div className="prose">
            <h2>เมื่อไหรควรใช้ PurrDiction</h2>
            <h3>ผู้สมัครที่ดี</h3>
            <ul>
              <li>First-person และ third-person shooters — การเคลื่อนที่ที่ตอบสนองมีความสำคัญ</li>
              <li>Platformers — timing การกระโดดต้องรู้สึกทันที</li>
              <li>Racing games — steering และ acceleration ต้องไม่รู้สึกล่าช้า</li>
              <li>Battle royale / เกม competitive ที่มีความอดทนต่ำต่อ latency feel</li>
            </ul>
            <h3>ผู้สมัครที่ไม่ดี</h3>
            <ul>
              <li>
                Turn-based strategy — ไม่มี continuous input; prediction เพิ่มความซับซ้อนโดยไม่มี
                ประโยชน์
              </li>
              <li>
                RPG ที่มี server-side state ซับซ้อน (stats, quests, economy) — reconciliation
                มีค่าใช้จ่ายสูง
              </li>
              <li>Puzzle games หรือ card games — latency ไม่เกี่ยวข้อง; ใช้ standard RPCs</li>
              <li>Mobile games ง่ายๆ — NetworkTransform พร้อม interpolation มักเพียงพอ</li>
            </ul>
          </div>

          <Callout type="warning" title="Prediction เพิ่มความซับซ้อนอย่างมาก">
            PurrDiction ต้องการให้ทุก game system ที่ส่งผลต่อ predicted character — movement,
            physics, abilities, collision — เขียนเป็น deterministic, tick-based simulation ที่ทำงาน
            เหมือนกันบน client และ server การ retrofit codebase ที่มีอยู่อาจต้องใช้ความพยายามมาก
            เริ่มต้นด้วย standard <code>NetworkTransform</code> และเพิ่ม prediction เฉพาะเมื่อคุณ
            วัดแล้วว่า latency เป็นปัญหาจริงสำหรับผู้เล่นของคุณ
          </Callout>

          <Callout type="tip" title="เริ่มต้นด้วย NetworkTransform ก่อน">
            สำหรับเกม indie ส่วนใหญ่ <code>NetworkTransform</code> พร้อม interpolation
            เป็นที่ยอมรับได้อย่างสมบูรณ์ ผู้เล่นอดทนกับ movement lag ~100 ms ในเกม cooperative
            เข้าถึง PurrDiction เฉพาะเมื่อสร้าง เกม competitive ที่ prediction error หมายถึงการแพ้
            การต่อสู้
          </Callout>

          <Callout type="info" title="PurrDiction คือ package แยกต่างหาก">
            ติดตั้ง PurrDiction จาก Package Manager โดยใช้ Git URL แยกต่างหากหรือ UPM package ID
            มันขึ้นอยู่กับ PurrNet แต่ไม่ได้มาพร้อมกัน ตรวจสอบ PurrNet Discord หรือ GitHub
            สำหรับ release tag ล่าสุด
          </Callout>
        </DocPage>
      }
    />
  );
}
