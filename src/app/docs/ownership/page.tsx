import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { OwnershipVisualizer } from "@/components/visualizers/OwnershipVisualizer";

export const metadata = { title: "Ownership" };

const apiParamsEN = [
  { name: "networkIdentity.isOwner", type: "bool", description: "True on the client that currently owns this identity. False on all other clients and the server." },
  { name: "networkIdentity.isServer", type: "bool", description: "True only when this code runs on the server." },
  { name: "networkIdentity.IsController", type: "bool", description: "True if you are the owner, or if you are the server and no owner is assigned. Useful for authority checks." },
  { name: "networkIdentity.owner", type: "PlayerID?", description: "Nullable PlayerID of the current owner. Null if the object is unowned." },
  { name: "GiveOwnership(PlayerID)", type: "void", description: "Transfer ownership to another player. Callable from server-side or the current owner depending on Network Rules." },
];

const apiParamsTH = [
  { name: "networkIdentity.isOwner", type: "bool", description: "True บน client ที่เป็นเจ้าของ identity นี้อยู่ในปัจจุบัน False บน client อื่นทั้งหมดและ server" },
  { name: "networkIdentity.isServer", type: "bool", description: "True เฉพาะเมื่อโค้ดนี้รันบน server" },
  { name: "networkIdentity.IsController", type: "bool", description: "True ถ้าคุณเป็นเจ้าของ หรือถ้าคุณเป็น server และไม่มีเจ้าของ มีประโยชน์สำหรับการตรวจสอบ authority" },
  { name: "networkIdentity.owner", type: "PlayerID?", description: "PlayerID ที่ nullable ของเจ้าของปัจจุบัน Null ถ้า object ไม่มีเจ้าของ" },
  { name: "GiveOwnership(PlayerID)", type: "void", description: "โอนการเป็นเจ้าของไปยังผู้เล่นคนอื่น เรียกได้จาก server-side หรือเจ้าของปัจจุบันขึ้นอยู่กับ Network Rules" },
];

const playerControllerCode = `using PurrNet;

public class PlayerController : NetworkBehaviour
{
    protected override void OnSpawned(bool asServer)
    {
        // asServer=true when running on server, false on clients
        if (isOwner)
        {
            // Enable input, local camera, UI
            EnablePlayerInput();
            CameraRig.Follow(transform);
        }
    }

    protected override void OnOwnerChanged(PlayerID? oldOwner, PlayerID? newOwner)
    {
        // Fires on all clients when ownership transfers
        bool iAmNewOwner = newOwner.HasValue && newOwner.Value == localPlayer;
        EnablePlayerInput(iAmNewOwner);
    }

    protected override void OnOwnerDisconnected()
    {
        // Called when the owner disconnects
        // Server can re-assign or destroy the object
        if (isServer) Destroy(gameObject);
    }

    protected override void OnDespawned()
    {
        // Cleanup before destruction
        CameraRig.Unfollow(transform);
    }
}`;

const spawnManagerCode = `public class SpawnManager : NetworkBehaviour
{
    [SerializeField] private GameObject playerPrefab;

    // Server-side: spawn a player object and give it to the connecting client
    public void SpawnPlayer(PlayerID player)
    {
        if (!isServer) return;

        var go = Instantiate(playerPrefab, GetSpawnPoint(), Quaternion.identity);
        var identity = go.GetComponent<NetworkIdentity>();

        // Give ownership immediately after spawning
        identity.GiveOwnership(player);
    }

    // Transfer ownership (e.g., trading an item)
    [ServerRpc(requireOwnership: false)]
    public void CmdTransferVehicle(NetworkIdentity vehicle, PlayerID newDriver, RPCInfo info = default)
    {
        // Only current owner or server can transfer
        if (vehicle.owner != info.sender && !info.asServer) return;
        vehicle.GiveOwnership(newDriver);
    }
}`;

const tankCode = `// Tank GameObject has two NetworkIdentity components:
// [0] TankHull — owned by driver
// [1] TankTurret — owned by gunner

public class TankHull : NetworkBehaviour
{
    // Only the driver (owner) drives
    void Update()
    {
        if (!isOwner) return;
        CmdDrive(Input.GetAxis("Vertical"), Input.GetAxis("Horizontal"));
    }
}

public class TankTurret : NetworkBehaviour
{
    // Only the gunner (owner) aims and fires
    void Update()
    {
        if (!isOwner) return;
        CmdAim(GetMouseAimDirection());
        if (Input.GetButtonDown("Fire1")) CmdFire();
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Ownership"
          description="Ownership determines which client has authority to drive a networked object. PurrNet supports per-component ownership — different components on the same GameObject can have different owners."
          badge="Core"
          href="/docs/ownership"
        >
          <div className="not-prose mb-6">
            <OwnershipVisualizer />
          </div>

          <div className="prose">
            <h2>Ownership vs Authority</h2>
            <p>
              <strong>Ownership</strong> is about identity — which player &quot;owns&quot; the object.{" "}
              <strong>Authority</strong> is about who can act — who can write SyncVars, call RPCs, etc.
              The server always has authority. An owner has authority over objects they own (depending
              on Network Rules).
            </p>
            <p>
              A common setup: the server spawns a player prefab and immediately gives ownership to the
              connecting client. That client can then move the character (owner authority) while the
              server validates all combat (server authority).
            </p>

            <h2>API Reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          <div className="prose">
            <h2>Lifecycle Callbacks</h2>
          </div>

          <CodeBlock
            filename="PlayerController.cs"
            language="csharp"
            code={playerControllerCode}
          />

          <div className="prose">
            <h2>Giving and Transferring Ownership</h2>
          </div>

          <CodeBlock
            filename="SpawnManager.cs"
            language="csharp"
            code={spawnManagerCode}
          />

          <div className="prose">
            <h2>Per-Component Ownership</h2>
            <p>
              A single GameObject can carry multiple <code>NetworkIdentity</code> components, each with
              a different owner. This is useful for shared vehicles where the driver owns the steering
              component and the gunner owns the turret.
            </p>
          </div>

          <CodeBlock
            filename="Tank.cs"
            language="csharp"
            code={tankCode}
          />

          <Callout type="tip" title="IsController shortcut">
            Use <code>IsController</code> instead of <code>isOwner || isServer</code> — it returns
            true if you are the owner, or if you are the server and the object has no owner. Covers
            both server-controlled NPCs and client-controlled players with a single check.
          </Callout>

          <Callout type="warning" title="GiveOwnership works server-side">
            Call <code>GiveOwnership</code> from server code only (inside <code>if (isServer)</code>)
            unless your Network Rules explicitly permit client-initiated ownership transfers.
            Unrestricted ownership transfer is a common cheat vector.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="การเป็นเจ้าของ"
          description="การเป็นเจ้าของกำหนดว่า client ใดมีสิทธิ์ขับเคลื่อน networked object PurrNet รองรับการเป็นเจ้าของต่อคอมโพเนนต์ — คอมโพเนนต์ต่างๆ บน GameObject เดียวกันสามารถมีเจ้าของต่างกันได้"
          badge="Core"
          href="/docs/ownership"
        >
          <div className="not-prose mb-6">
            <OwnershipVisualizer />
          </div>

          <div className="prose">
            <h2>การเป็นเจ้าของ vs Authority</h2>
            <p>
              <strong>การเป็นเจ้าของ</strong> เกี่ยวกับ identity — ผู้เล่นคนไหน &quot;เป็นเจ้าของ&quot; object
              <strong>Authority</strong> เกี่ยวกับใครสามารถกระทำได้ — ใครสามารถเขียน SyncVars, เรียก RPCs ฯลฯ
              server มี authority เสมอ เจ้าของมี authority เหนือ object ที่ตัวเองเป็นเจ้าของ (ขึ้นอยู่กับ Network Rules)
            </p>
            <p>
              การตั้งค่าทั่วไป: server spawn player prefab และให้การเป็นเจ้าของแก่ client ที่เข้าร่วมทันที
              client นั้นจึงสามารถเคลื่อน character ได้ (owner authority) ในขณะที่ server ตรวจสอบ combat ทั้งหมด (server authority)
            </p>

            <h2>อ้างอิง API</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsTH} />
          </div>

          <div className="prose">
            <h2>Lifecycle callbacks</h2>
          </div>

          <CodeBlock
            filename="PlayerController.cs"
            language="csharp"
            code={playerControllerCode}
          />

          <div className="prose">
            <h2>การให้และโอนการเป็นเจ้าของ</h2>
          </div>

          <CodeBlock
            filename="SpawnManager.cs"
            language="csharp"
            code={spawnManagerCode}
          />

          <div className="prose">
            <h2>การเป็นเจ้าของต่อคอมโพเนนต์</h2>
            <p>
              GameObject เดียวสามารถมีคอมโพเนนต์ <code>NetworkIdentity</code> หลายตัว แต่ละตัวมีเจ้าของต่างกัน
              มีประโยชน์สำหรับยานพาหนะร่วมที่คนขับเป็นเจ้าของคอมโพเนนต์พวงมาลัย
              และพลปืนเป็นเจ้าของป้อมปืน
            </p>
          </div>

          <CodeBlock
            filename="Tank.cs"
            language="csharp"
            code={tankCode}
          />

          <Callout type="tip" title="ทางลัด IsController">
            ใช้ <code>IsController</code> แทน <code>isOwner || isServer</code> — คืนค่า true
            ถ้าคุณเป็นเจ้าของ หรือถ้าคุณเป็น server และ object ไม่มีเจ้าของ ครอบคลุม
            NPC ที่ server ควบคุมและ player ที่ client ควบคุมด้วยการตรวจสอบเดียว
          </Callout>

          <Callout type="warning" title="GiveOwnership ทำงานฝั่ง server">
            เรียก <code>GiveOwnership</code> จากโค้ด server เท่านั้น (ภายใน <code>if (isServer)</code>) เว้นแต่
            Network Rules ของคุณจะอนุญาตการโอนการเป็นเจ้าของที่ client ริเริ่ม การโอนการเป็นเจ้าของ
            ที่ไม่จำกัดเป็นช่องทางการโกงทั่วไป
          </Callout>
        </DocPage>
      }
    />
  );
}
