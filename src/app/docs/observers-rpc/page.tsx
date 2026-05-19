import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { RpcFlowVisualizer } from "@/components/visualizers/RpcFlowVisualizer";

export const metadata = { title: "ObserversRpc" };

const paramsEN = [
  { name: "channel", type: "Channel", default: "Channel.Reliable", description: "The transport channel used for the broadcast." },
  { name: "requireServer", type: "bool", default: "Network Rules", description: "When true, only the server can call this RPC. Overrides Network Rules for this method." },
  { name: "bufferLast", type: "bool", default: "false", description: "When true, replays the most recent call to newly connecting observers. Use for state that late joiners must receive, like the current round phase." },
  { name: "runLocally", type: "bool", default: "false", description: "When true, the server also executes the method locally when it sends the broadcast." },
];

const paramsTH = [
  { name: "channel", type: "Channel", default: "Channel.Reliable", description: "การรับประกันการส่งสำหรับการ broadcast" },
  { name: "requireServer", type: "bool", default: "Network Rules", description: "เมื่อ true เฉพาะ server เท่านั้นที่สามารถเรียก RPC นี้ Override rules สำหรับเมธอดนี้" },
  { name: "bufferLast", type: "bool", default: "false", description: "PurrNet จำการเรียกครั้งล่าสุดและ replay สำหรับ client ที่เข้าร่วมช้า สำคัญมากสำหรับการ initialize game-state" },
  { name: "runLocally", type: "bool", default: "false", description: "ผู้เรียก (server) ก็ดำเนินการเมธอดทันที" },
];

const basicUsageCode = `using PurrNet;
using UnityEngine;

public class GameManager : NetworkBehaviour
{
    // Server calls this to tell everyone the game started
    [ObserversRpc(bufferLast: true)]
    public void RpcGameStarted(int countdownSeconds)
    {
        // Runs on ALL connected clients (and server if runLocally)
        UI.ShowCountdown(countdownSeconds);
        AudioManager.PlayStartJingle();
    }

    // Server-side trigger — only callable from server code
    [ObserversRpc(requireServer: true)]
    public void RpcForceRestart()
    {
        SceneManager.LoadScene("MainGame");
    }
}`;

const bufferLastCode = `public class HealthSystem : NetworkBehaviour
{
    private int _currentHealth = 100;

    protected override void OnSpawned(bool asServer)
    {
        if (asServer) RpcInitHealth(_currentHealth);
    }

    // bufferLast: new clients joining mid-game immediately get current health
    [ObserversRpc(Channel.Reliable, bufferLast: true)]
    private void RpcInitHealth(int health)
    {
        _currentHealth = health;
        healthBar.SetValue(health);
    }

    public void TakeDamage(int amount)
    {
        if (!isServer) return;
        _currentHealth -= amount;
        RpcUpdateHealth(_currentHealth); // broadcast to all
    }

    [ObserversRpc]
    private void RpcUpdateHealth(int health)
    {
        _currentHealth = health;
        healthBar.SetValue(health);
        if (health <= 0) OnDeath();
    }
}`;

const killFeedCode = `public class KillFeedManager : NetworkBehaviour
{
    // Server calls this after confirming a kill
    [ServerRpc(requireOwnership: false)]
    public void CmdReportKill(string killerName, string victimName, string weapon, RPCInfo info = default)
    {
        if (!info.asServer) return; // runLocally guard
        // Validate: did info.sender actually make this kill?
        BroadcastKill(killerName, victimName, weapon);
    }

    [ObserversRpc(runLocally: true)]
    private void BroadcastKill(string killer, string victim, string weapon)
    {
        KillFeed.AddEntry(killer, victim, weapon);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="ObserversRpc"
          description="ObserversRpc broadcasts a method call from the server to all clients observing the object. Every connected client that can see the object receives the call simultaneously."
          badge="RPC"
          href="/docs/observers-rpc"
        >
          <div className="not-prose mb-6">
            <RpcFlowVisualizer defaultType="ObserversRpc" showControls />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              The server calls a method marked with <code>[ObserversRpc]</code> and PurrNet
              distributes the packet to every client currently observing that NetworkIdentity.
              Observers are determined by the Network Visibility system — by default, all connected
              clients observe all objects.
            </p>
            <p>
              Common uses: broadcasting game events (player death, game start), pushing authoritative
              state after server-side validation, and notifying all clients about world changes.
            </p>

            <h2>Attribute parameters</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
          </div>

          <CodeBlock filename="GameManager.cs" language="csharp" code={basicUsageCode} />

          <div className="prose">
            <h2>bufferLast for late joiners</h2>
            <p>
              Without <code>bufferLast</code>, a client connecting after an ObserversRpc fires will
              miss it entirely. With <code>bufferLast: true</code>, PurrNet stores the most recent
              call and replays it when a new observer joins. This is essential for broadcasting
              initial game state.
            </p>
          </div>

          <CodeBlock filename="HealthSystem.cs" language="csharp" code={bufferLastCode} />

          <Callout type="tip" title="bufferLast vs SyncVar">
            For values that change continuously (health, score, position), use{" "}
            <a href="/docs/syncvar">SyncVar</a> — it handles buffering automatically.
            Use <code>bufferLast</code> on ObserversRpc for one-time events that must be replayed
            (game start, round end).
          </Callout>

          <div className="prose">
            <h2>Situational example — kill feed</h2>
          </div>

          <CodeBlock filename="KillFeedManager.cs" language="csharp" code={killFeedCode} />

          <Callout type="warning" title="requireServer">
            If <code>requireServer</code> is false (default), a client can call ObserversRpc
            directly if Network Rules allow it. In server-authoritative games, always set{" "}
            <code>requireServer: true</code> or rely on Network Rules to block this.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="ObserversRpc"
          description="ObserversRpc broadcast การเรียกเมธอดจาก server ไปยัง client ทั้งหมดที่กำลังสังเกต object อยู่ เทียบเท่ากับ ServerRpc แต่เป็น server-to-all-clients"
          badge="RPC"
          href="/docs/observers-rpc"
        >
          <div className="not-prose mb-6">
            <RpcFlowVisualizer defaultType="ObserversRpc" showControls />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              server เรียกเมธอดที่มี <code>[ObserversRpc]</code> และ PurrNet กระจาย packet ไปยัง
              client ทุกตัวที่กำลังสังเกต NetworkIdentity นั้นอยู่ Observers ถูกกำหนดโดยระบบ
              Network Visibility — โดยค่าเริ่มต้น client ทั้งหมดที่เชื่อมต่อจะสังเกต objects ทั้งหมด
            </p>
            <p>
              การใช้งานทั่วไป: การ broadcast game events (ผู้เล่นตาย, เกมเริ่ม), การ push authoritative state
              หลัง server-side validation และการแจ้ง client ทั้งหมดเกี่ยวกับการเปลี่ยนแปลงของโลก
            </p>

            <h2>พารามิเตอร์ attribute</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsTH} />
          </div>

          <div className="prose">
            <h2>การใช้พื้นฐาน</h2>
          </div>

          <CodeBlock filename="GameManager.cs" language="csharp" code={basicUsageCode} />

          <div className="prose">
            <h2>bufferLast — ผู้เข้าร่วมช่วงท้าย</h2>
            <p>
              โดยไม่มี <code>bufferLast</code> client ที่เชื่อมต่อหลังจาก ObserversRpc ทำงานจะพลาดมัน
              ด้วย <code>bufferLast: true</code> PurrNet จัดเก็บการเรียกล่าสุดและ replay เมื่อ
              observer ใหม่เข้าร่วม สำคัญมากสำหรับการ broadcast initial game state
            </p>
          </div>

          <CodeBlock filename="HealthSystem.cs" language="csharp" code={bufferLastCode} />

          <Callout type="tip" title="bufferLast vs SyncVar">
            สำหรับค่าที่เปลี่ยนแปลงต่อเนื่อง (สุขภาพ, คะแนน, ตำแหน่ง) ให้ใช้{" "}
            <a href="/docs/syncvar">SyncVar</a> — มันจัดการ buffering โดยอัตโนมัติ
            ใช้ <code>bufferLast</code> บน ObserversRpc สำหรับ events ครั้งเดียวที่ต้อง replay (เริ่มเกม, จบรอบ)
          </Callout>

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — kill feed</h2>
          </div>

          <CodeBlock filename="KillFeedManager.cs" language="csharp" code={killFeedCode} />

          <Callout type="warning" title="requireServer">
            ถ้า <code>requireServer</code> เป็น false (ค่าเริ่มต้น) client สามารถเรียก ObserversRpc ด้วยตัวเองได้
            ถ้า Network Rules อนุญาต ในเกมที่ server-authoritative ตั้งค่า <code>requireServer: true</code> เสมอ
            หรือพึ่ง Network Rules เพื่อบล็อกสิ่งนี้
          </Callout>
        </DocPage>
      }
    />
  );
}
