import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Introduction" };

const packageManagerUrl = `https://github.com/PurrNet/PurrNet.git?path=/Assets/PurrNet#release`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Introduction to PurrNet"
          description="PurrNet is a free, MIT-licensed Unity networking library designed to feel natural — no baking, no special spawn APIs, no costs."
          href="/docs/introduction"
        >
          <div className="prose">
            <h2>What makes PurrNet different?</h2>
            <p>
              Most Unity networking libraries require special spawn calls, pre-baked network IDs,
              or lock key features behind a premium tier. PurrNet eliminates all of that. You call{" "}
              <code>Instantiate()</code> and <code>Destroy()</code> exactly as you always have —
              PurrNet intercepts and syncs them automatically.
            </p>

            <h2>Core philosophy</h2>
            <ul>
              <li><strong>Works like Unity.</strong> If you know Unity, you already know most of PurrNet.</li>
              <li><strong>Authority is configurable, not hardcoded.</strong> NetworkRules lets you switch between server-auth and client-auth without changing a single line of code.</li>
              <li><strong>Per-component ownership.</strong> A single GameObject can have multiple NetworkIdentities, each owned by a different player.</li>
              <li><strong>100% free, forever.</strong> MIT license, no Pro tier, commercial use allowed.</li>
            </ul>

            <h2>Installation (quick)</h2>
            <p>In Unity: <strong>Window → Package Manager → + → Add package from git URL</strong></p>
          </div>

          <CodeBlock
            language="text"
            filename="Package Manager URL"
            code={packageManagerUrl}
          />

          <Callout type="tip" title="Git required">
            Make sure Git is installed on your system before using the Package Manager URL method.
            After installing Git, restart Unity and Unity Hub.
          </Callout>

          <div className="prose">
            <h2>The network loop in 30 seconds</h2>
            <p>
              When a client calls a <strong>ServerRpc</strong>, the packet travels to the server,
              which executes the method. The server can then call an <strong>ObserversRpc</strong>{" "}
              to broadcast state changes back to all connected clients. <strong>SyncVars</strong>{" "}
              skip this step entirely — they broadcast automatically whenever <code>.value</code> is set.
            </p>

            <h2>What to learn next</h2>
            <ul>
              <li><a href="/docs/network-identity">NetworkIdentity</a> — the foundation of every networked object</li>
              <li><a href="/docs/server-rpc">ServerRpc</a> — send commands from a client to the server</li>
              <li><a href="/docs/syncvar">SyncVar</a> — automatically synchronize a variable across all clients</li>
              <li><a href="/docs/ownership">Ownership</a> — control who can drive a networked object</li>
            </ul>
          </div>
        </DocPage>
      }
      th={
        <DocPage
          title="บทนำสู่ PurrNet"
          description="PurrNet คือห้องสมุดการสื่อสารเครือข่าย Unity ที่ฟรีและมีใบอนุญาต MIT ออกแบบให้รู้สึกเป็นธรรมชาติ — ไม่มีการ baking ไม่มี spawn APIs พิเศษ ไม่มีค่าใช้จ่าย"
          href="/docs/introduction"
        >
          <div className="prose">
            <h2>อะไรที่ทำให้ PurrNet แตกต่าง?</h2>
            <p>
              ห้องสมุดการสื่อสารเครือข่าย Unity ส่วนใหญ่ต้องการการเรียก spawn พิเศษ network IDs ที่ bake ไว้ล่วงหน้า
              หรือจำกัดฟีเจอร์ไว้ในระดับพรีเมียม PurrNet กำจัดทั้งหมดนั้น คุณเรียก <code>Instantiate()</code> และ{" "}
              <code>Destroy()</code> ตามที่คุณทำเสมอมา — PurrNet จะสกัดกั้นและ sync ให้โดยอัตโนมัติ
            </p>

            <h2>ปรัชญาหลัก</h2>
            <ul>
              <li><strong>ทำงานเหมือน Unity.</strong> ถ้าคุณรู้จัก Unity คุณก็รู้จัก PurrNet ส่วนใหญ่แล้ว</li>
              <li><strong>Authority ตั้งค่าได้ ไม่ได้ฝังไว้ตายตัว.</strong> NetworkRules ให้คุณสลับระหว่าง server-auth และ client-auth โดยไม่ต้องเปลี่ยนโค้ดแม้แต่บรรทัดเดียว</li>
              <li><strong>การเป็นเจ้าของต่อคอมโพเนนต์.</strong> GameObject เดียวสามารถมี NetworkIdentity หลายตัว แต่ละตัวเป็นของผู้เล่นคนละคน</li>
              <li><strong>ฟรี 100% ตลอดไป.</strong> MIT license ไม่มีระดับ Pro ใช้ในเชิงพาณิชย์ได้</li>
            </ul>

            <h2>การติดตั้ง (ด่วน)</h2>
            <p>ใน Unity: <strong>Window → Package Manager → + → Add package from git URL</strong></p>
          </div>

          <CodeBlock
            language="text"
            filename="Package Manager URL"
            code={packageManagerUrl}
          />

          <Callout type="tip" title="จำเป็นต้องมี Git">
            ตรวจสอบให้แน่ใจว่า Git ถูกติดตั้งบนระบบของคุณก่อนใช้วิธี Package Manager URL
            หลังจากติดตั้ง Git ให้รีสตาร์ท Unity และ Unity Hub
          </Callout>

          <div className="prose">
            <h2>Network loop ใน 30 วินาที</h2>
            <p>
              เมื่อ client เรียก <strong>ServerRpc</strong> แพ็กเก็ตจะเดินทางไปยัง server ซึ่งจะดำเนินการเมธอด
              จากนั้น server สามารถเรียก <strong>ObserversRpc</strong> เพื่อ broadcast การเปลี่ยนแปลงสถานะ
              กลับไปยัง client ทั้งหมดที่เชื่อมต่ออยู่ <strong>SyncVars</strong> ข้ามขั้นตอนนี้โดยอัตโนมัติ
              broadcast ทุกครั้งที่ตั้งค่า <code>.value</code>
            </p>

            <h2>สิ่งที่ต้องเรียนรู้ต่อไป</h2>
            <ul>
              <li><a href="/docs/network-identity">NetworkIdentity</a> — รากฐานของทุก networked object</li>
              <li><a href="/docs/server-rpc">ServerRpc</a> — ส่งคำสั่งจาก client ไปยัง server</li>
              <li><a href="/docs/syncvar">SyncVar</a> — ซิงโครไนซ์ตัวแปรทั่ว client ทั้งหมดโดยอัตโนมัติ</li>
              <li><a href="/docs/ownership">Ownership</a> — ควบคุมว่าใครสามารถขับเคลื่อน networked object</li>
            </ul>
          </div>
        </DocPage>
      }
    />
  );
}
