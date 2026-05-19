import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { RpcFlowVisualizer } from "@/components/visualizers/RpcFlowVisualizer";

export const metadata = { title: "ServerRpc" };

const paramsEN = [
  { name: "requireOwnership", type: "bool", default: "Network Rules", description: "When true (default), only the object's current owner can call this RPC. Set to false to allow any client to call it — useful for global actions like voting or damage requests." },
  { name: "channel", type: "Channel", default: "Channel.Reliable", description: "The transport channel to use. Reliable = guaranteed delivery; Unreliable = faster but may drop." },
  { name: "runLocally", type: "bool", default: "false", description: "When true, the caller also executes the method locally before the packet reaches the server. Useful for immediate local feedback." },
];

const paramsTH = [
  { name: "requireOwnership", type: "bool", default: "Network Rules", description: "เมื่อ true เฉพาะเจ้าของ object เท่านั้นที่สามารถเรียก RPC นี้ Override Network Rules สำหรับเมธอดนี้โดยเฉพาะ" },
  { name: "channel", type: "Channel", default: "Channel.Reliable", description: "การรับประกันการส่ง Channel.Reliable รับประกันการมาถึงตามลำดับ Channel.Unreliable เร็วกว่าแต่อาจ drop packets ได้" },
  { name: "runLocally", type: "bool", default: "false", description: "เมื่อ true client ที่เรียกก็จะดำเนินการเมธอดทันทีโดยไม่รอ server round-trip" },
];

const rpcInfoParamsEN = [
  { name: "info.sender", type: "PlayerID", description: "The PlayerID of the client who made the call. Available when the method signature includes RPCInfo info = default." },
  { name: "info.asServer", type: "bool", description: "True when the method body is running on the server." },
];

const rpcInfoParamsTH = [
  { name: "info.sender", type: "PlayerID", description: "PlayerID ของ client ที่เรียก RPC นี้" },
  { name: "info.asServer", type: "bool", description: "True เมื่อดำเนินการฝั่ง server มีประโยชน์ใน RunLocally methods ที่โค้ดเดียวกันรันทั้ง client และ server" },
];

const basicUsageCode = `using PurrNet;
using UnityEngine;

public class PlayerController : NetworkBehaviour
{
    // Called from any client — executes on server
    [ServerRpc]
    private void CmdMove(Vector3 direction)
    {
        // Only runs on server
        transform.position += direction * speed;
    }

    // Only the owner can call this
    [ServerRpc(requireOwnership: true)]
    private void CmdJump()
    {
        // Server-authoritative jump logic
        rb.AddForce(Vector3.up * jumpForce, ForceMode.Impulse);
    }

    void Update()
    {
        if (!isOwner) return;
        var dir = new Vector3(Input.GetAxis("Horizontal"), 0, Input.GetAxis("Vertical"));
        if (dir != Vector3.zero) CmdMove(dir);
    }
}`;

const rpcInfoCode = `[ServerRpc(requireOwnership: false)]
private void CmdPickupItem(int itemId, RPCInfo info = default)
{
    // info.sender is the player who called this
    PlayerID caller = info.sender;

    if (!CanPlayerPickup(caller, itemId))
    {
        Debug.LogWarning($"{caller} tried to pick up item they don't own!");
        return;
    }

    GiveItemToPlayer(caller, itemId);
}`;

const runLocallyCode = `// Client fires immediately (muzzle flash, audio) then server validates
[ServerRpc(runLocally: true)]
private void CmdFire(Vector3 origin, Vector3 direction)
{
    if (info.asServer)
    {
        // Server: validate ammo, apply damage
        if (ammo <= 0) return;
        ammo--;
        Physics.Raycast(origin, direction, out var hit, 100f);
        if (hit.collider && hit.collider.TryGetComponent<Health>(out var h))
            h.TakeDamage(damage);
    }
    // Both server and client run this:
    SpawnMuzzleFlash();
    PlayFireSound();
}`;

const respawnCode = `public class RespawnSystem : NetworkBehaviour
{
    [SerializeField] private Transform[] spawnPoints;

    // Dead player requests respawn after timer expires
    [ServerRpc(requireOwnership: true)]
    public void CmdRequestRespawn(RPCInfo info = default)
    {
        // Server picks a spawn point and sets position
        var point = spawnPoints[Random.Range(0, spawnPoints.Length)];
        transform.position = point.position;

        // Broadcast the new position to all clients
        RpcSetPosition(point.position);
    }

    [ObserversRpc]
    private void RpcSetPosition(Vector3 pos)
    {
        transform.position = pos;
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="ServerRpc"
          description="ServerRpc lets a client call a method that executes on the server. The client sends a packet; the server receives and runs the method. The client never runs the method body."
          badge="RPC"
          href="/docs/server-rpc"
        >
          {/* Interactive visualizer */}
          <div className="not-prose mb-6">
            <RpcFlowVisualizer defaultType="ServerRpc" showControls />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              When a client calls a method marked with <code>[ServerRpc]</code>, PurrNet serializes
              the arguments and transmits them over the network. The server deserializes and runs the
              method. The calling client <em>never</em> executes the method body — unless{" "}
              <code>runLocally: true</code> is set.
            </p>
            <p>
              Use ServerRpc for any action that requires server-side validation before it affects
              game state: character movement, damage application, spawning objects, or changing
              ownership.
            </p>

            <h2>Attribute parameters</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
          </div>

          <CodeBlock filename="PlayerController.cs" language="csharp" code={basicUsageCode} />

          <div className="prose">
            <h2>Reading sender info with RPCInfo</h2>
            <p>
              Add the optional <code>RPCInfo info = default</code> parameter to any RPC method to
              inspect who sent it and whether you are on the server side.
            </p>
          </div>

          <CodeBlock filename="InventorySystem.cs" language="csharp" code={rpcInfoCode} />

          <div className="not-prose my-4">
            <ParamTable params={rpcInfoParamsEN} />
          </div>

          <div className="prose">
            <h2>RunLocally — immediate client feedback</h2>
            <p>
              By default, a ServerRpc only runs on the server. With <code>runLocally: true</code>,
              the caller also runs the method immediately before the packet reaches the server. This
              gives zero-latency visual feedback at the cost of potentially diverging from server
              state if validation fails.
            </p>
          </div>

          <CodeBlock filename="WeaponFire.cs" language="csharp" code={runLocallyCode} />

          <Callout type="warning" title="RunLocally divergence">
            When using <code>runLocally: true</code>, the client may display a temporary state that
            the server will later correct. Always reconcile server-authoritative state on the client
            to prevent visual glitches.
          </Callout>

          <div className="prose">
            <h2>Situational example</h2>
            <h3>Player respawn</h3>
          </div>

          <CodeBlock filename="RespawnSystem.cs" language="csharp" code={respawnCode} />

          <Callout type="tip" title="Server-only execution">
            Only the server runs the ServerRpc body code — use <code>if (isServer)</code> guards
            for any logic branching.
          </Callout>

          <Callout type="warning" title="Never trust client inputs">
            Never trust client inputs — validate everything the client sends on the server side.
          </Callout>

          <div className="prose">
            <h2>Anti-patterns</h2>
            <ul>
              <li>
                <strong>Calling ServerRpc every frame:</strong> Use <code>Channel.Unreliable</code>{" "}
                for continuous input and throttle with a send interval. Never send reliable RPCs at
                60 Hz.
              </li>
              <li>
                <strong>Trusting the caller:</strong> Never use <code>info.sender</code> to grant
                resources to a player without validation — always cross-check against
                server-owned state.
              </li>
              <li>
                <strong>Heavy computation in ServerRpc:</strong> Move expensive work to a coroutine
                or job to avoid blocking the server tick.
              </li>
            </ul>
          </div>
        </DocPage>
      }
      th={
        <DocPage
          title="ServerRpc"
          description="ServerRpc ดำเนินการเมธอดบน server เมื่อเรียกจาก client เป็นวิธีหลักที่ client ใช้ส่งคำสั่งที่มี authority"
          badge="RPC"
          href="/docs/server-rpc"
        >
          {/* Interactive visualizer */}
          <div className="not-prose mb-6">
            <RpcFlowVisualizer defaultType="ServerRpc" showControls />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              เมื่อ client เรียกเมธอดที่มี <code>[ServerRpc]</code> PurrNet จะ serialize
              arguments และส่งผ่านเครือข่าย server จะ deserialize และดำเนินการเมธอด
              client ที่เรียกมัน <em>ไม่</em> ดำเนินการ method body — เว้นแต่ตั้งค่า <code>runLocally: true</code>
            </p>
            <p>
              ใช้ ServerRpc สำหรับการกระทำใดๆ ที่ต้องตรวจสอบฝั่ง server ก่อนที่จะส่งผลต่อ game state:
              การเคลื่อนที่ตัวละคร, การสร้างความเสียหาย, การ spawn objects หรือการเปลี่ยนการเป็นเจ้าของ
            </p>

            <h2>พารามิเตอร์ attribute</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsTH} />
          </div>

          <div className="prose">
            <h2>การใช้พื้นฐาน</h2>
          </div>

          <CodeBlock filename="PlayerController.cs" language="csharp" code={basicUsageCode} />

          <div className="prose">
            <h2>การอ่านข้อมูลผู้ส่งด้วย RPCInfo</h2>
            <p>
              เพิ่มพารามิเตอร์ <code>RPCInfo info = default</code> ที่ optional เข้าไปในเมธอด RPC ใดก็ได้เพื่อ
              ตรวจสอบว่าใครส่งมาและคุณอยู่ฝั่ง server หรือเปล่า
            </p>
          </div>

          <CodeBlock filename="InventorySystem.cs" language="csharp" code={rpcInfoCode} />

          <div className="not-prose my-4">
            <ParamTable params={rpcInfoParamsTH} />
          </div>

          <div className="prose">
            <h2>RunLocally — feedback ทันทีฝั่ง client</h2>
            <p>
              โดยค่าเริ่มต้น ServerRpc รันเฉพาะบน server ด้วย <code>runLocally: true</code> ผู้เรียก
              ก็รันเมธอดทันทีก่อนที่ packet จะถึง server วิธีนี้ให้ visual feedback แบบ zero-latency
              แต่แลกกับความเสี่ยงที่จะ diverge จาก server state ถ้า validation ล้มเหลว
            </p>
          </div>

          <CodeBlock filename="WeaponFire.cs" language="csharp" code={runLocallyCode} />

          <Callout type="warning" title="RunLocally divergence">
            เมื่อใช้ <code>runLocally: true</code> client อาจแสดงสถานะชั่วคราวที่ server จะแก้ไขภายหลัง
            ควร reconcile สถานะที่ server authoritative บน client เพื่อป้องกัน visual glitches เสมอ
          </Callout>

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์</h2>
            <h3>การ respawn ผู้เล่น</h3>
          </div>

          <CodeBlock filename="RespawnSystem.cs" language="csharp" code={respawnCode} />

          <Callout type="danger" title="ไม่ควรไว้วางใจ input ของ client">
            ตรวจสอบบน server เสมอ client สามารถส่งค่าใดก็ได้ — ตรวจสอบขอบเขต cooldowns
            และ game state เสมอก่อนนำผลไปใช้
          </Callout>

          <div className="prose">
            <h2>Anti-patterns</h2>
            <ul>
              <li>
                <strong>การเรียก ServerRpc ทุก frame:</strong> ใช้ <code>Channel.Unreliable</code> สำหรับ
                input ต่อเนื่องและ throttle ด้วย send interval อย่าส่ง reliable RPCs ที่ 60Hz
              </li>
              <li>
                <strong>การไว้วางใจผู้เรียก:</strong> ห้ามใช้ <code>info.sender</code> เพื่อให้ทรัพยากรแก่ผู้เล่น
                โดยไม่ตรวจสอบ — ตรวจสอบกับ server-owned state เสมอ
              </li>
              <li>
                <strong>การคำนวณหนักใน ServerRpc:</strong> ย้ายงานที่มีค่าใช้จ่ายสูงไปยัง coroutine หรือ job
                เพื่อหลีกเลี่ยงการบล็อก server tick
              </li>
            </ul>
          </div>
        </DocPage>
      }
    />
  );
}
