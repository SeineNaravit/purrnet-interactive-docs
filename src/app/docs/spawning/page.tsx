import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Spawning & Despawning" };

const spawnManagerCode = `using PurrNet;
using UnityEngine;

public class SpawnManager : NetworkBehaviour
{
    [SerializeField] private GameObject bulletPrefab;
    [SerializeField] private GameObject playerPrefab;

    // SERVER only — spawn a bullet at a position
    public void SpawnBullet(Vector3 position, Vector3 direction)
    {
        if (!isServer) return;

        var bullet = Instantiate(bulletPrefab, position, Quaternion.LookRotation(direction));
        // PurrNet auto-registers and syncs to all clients
    }

    // SERVER: spawn player and give ownership to the connecting client
    public void SpawnPlayer(PlayerID player, Vector3 spawnPoint)
    {
        if (!isServer) return;

        var go = Instantiate(playerPrefab, spawnPoint, Quaternion.identity);
        go.GetComponent<NetworkIdentity>().GiveOwnership(player);
    }
}`;

const networkSetupCode = `public class NetworkSetup : NetworkBehaviour
{
    private void Awake()
    {
        networkManager.onClientSpawnValidate += ValidateClientSpawn;
    }

    private bool ValidateClientSpawn(PlayerID player, SpawnPacket packet)
    {
        if (packet.TryGetRawPrefab(networkManager, out var prefab))
        {
            // Only allow players to spawn their own character prefab
            return prefab.name == "PlayerCharacter";
        }
        return false;
    }
}`;

const pooledBulletCode = `public class PooledBullet : NetworkBehaviour
{
    protected override void OnPoolReset()
    {
        // Reset before the next use
        velocity = Vector3.zero;
        damage = baseDamage;
        trailRenderer.Clear();
    }

    protected override void OnSpawned(bool asServer)
    {
        // Called every time — even when recycled from pool
        StartCoroutine(AutoDestroyAfterLifetime());
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Spawning & Despawning"
          description="PurrNet intercepts Unity's own Instantiate() and Destroy() calls — no special network spawn methods to learn."
          badge="Core"
          href="/docs/spawning"
        >
          <div className="prose">
            <h2>How It Works</h2>
            <p>
              When you call <code>Instantiate(prefab)</code> on a networked prefab, PurrNet
              automatically registers it on the network and replicates the spawn to all connected
              clients. When you call <code>Destroy(gameObject)</code>, PurrNet syncs the despawn.
            </p>
            <p>
              Prefabs must be registered in <strong>Network Manager → Network Prefabs</strong> or
              added dynamically via the prefab registry API.
            </p>

            <h2>Basic Spawning</h2>
          </div>

          <CodeBlock
            filename="SpawnManager.cs"
            language="csharp"
            code={spawnManagerCode}
          />

          <Callout type="info" title="Who can spawn?">
            By default (Server Auth rules) only the server can spawn networked objects. With Client
            Auth rules, clients can also call <code>Instantiate()</code> for networked prefabs.
            Controlled via <a href="/docs/network-rules"> Network Rules</a>.
          </Callout>

          <div className="prose">
            <h2>Validating Client Spawns</h2>
            <p>
              If you allow clients to spawn, hook into the validation callback to verify spawn
              requests server-side before accepting them.
            </p>
          </div>

          <CodeBlock
            filename="NetworkSetup.cs"
            language="csharp"
            code={networkSetupCode}
          />

          <div className="prose">
            <h2>Despawning</h2>
            <p>
              Call <code>Destroy(gameObject)</code> on the server. PurrNet automatically syncs the
              destruction to all clients. The <code>OnDespawned()</code> callback fires on all clients
              before the object is actually destroyed — use it for death animations, cleanup, etc.
            </p>

            <h2>Object Pooling</h2>
            <p>
              Enable pooling in <strong>Network Manager → Network Prefabs → Pool</strong>. Instead of
              being destroyed, pooled objects are deactivated and reused. Override{" "}
              <code>OnPoolReset()</code> to reset state before reuse.
            </p>
          </div>

          <CodeBlock
            filename="PooledBullet.cs"
            language="csharp"
            code={pooledBulletCode}
          />

          <Callout type="warning" title="Reference&lt;T&gt; for pooled objects">
            Serialized references (<code>[SerializeField]</code>) to components on pooled objects can
            become stale after pool recycling. Use PurrNet&apos;s <code>Reference&lt;T&gt;</code>{" "}
            wrapper instead of direct references to components on pooled NetworkIdentity objects.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="การสร้าง & การลบ"
          description="PurrNet สกัดกั้นการเรียก Instantiate() และ Destroy() ของ Unity เอง — ไม่มี network spawn methods พิเศษให้เรียนรู้"
          badge="Core"
          href="/docs/spawning"
        >
          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              เมื่อคุณเรียก <code>Instantiate(prefab)</code> บน networked prefab PurrNet จะลงทะเบียนมันบนเครือข่าย
              โดยอัตโนมัติและ replicate การ spawn ไปยัง client ทั้งหมดที่เชื่อมต่อ เมื่อคุณเรียก{" "}
              <code>Destroy(gameObject)</code> PurrNet จะ sync การ despawn
            </p>
            <p>
              prefab ต้องถูกลงทะเบียนใน <strong>Network Manager → Network Prefabs</strong> หรือ
              เพิ่มแบบ dynamic ผ่าน prefab registry API
            </p>

            <h2>การสร้างพื้นฐาน</h2>
          </div>

          <CodeBlock
            filename="SpawnManager.cs"
            language="csharp"
            code={spawnManagerCode}
          />

          <Callout type="info" title="ใครสามารถสร้างได้?">
            โดยค่าเริ่มต้น (Server Auth rules) เฉพาะ server เท่านั้นที่สามารถ spawn networked objects ด้วย Client Auth
            rules client ยังสามารถเรียก <code>Instantiate()</code> สำหรับ networked prefabs ได้ ควบคุมผ่าน
            <a href="/docs/network-rules"> Network Rules</a>
          </Callout>

          <div className="prose">
            <h2>การตรวจสอบ client spawn</h2>
            <p>
              ถ้าคุณอนุญาตให้ client spawn ให้ hook เข้า validation callback เพื่อตรวจสอบ spawn request
              ฝั่ง server ก่อนที่จะยอมรับ
            </p>
          </div>

          <CodeBlock
            filename="NetworkSetup.cs"
            language="csharp"
            code={networkSetupCode}
          />

          <div className="prose">
            <h2>การลบ</h2>
            <p>
              เรียก <code>Destroy(gameObject)</code> บน server PurrNet sync การทำลายไปยัง client ทั้งหมดโดยอัตโนมัติ
              <code>OnDespawned()</code> callback จะทำงานบน client ทั้งหมดก่อนที่ object จะถูกทำลายจริง —
              ใช้สำหรับ death animations, cleanup ฯลฯ
            </p>

            <h2>Object Pooling</h2>
            <p>
              เปิดใช้งาน pooling ใน <strong>Network Manager → Network Prefabs → Pool</strong> แทนที่จะทำลาย
              pooled objects จะถูก deactivate และนำมาใช้ซ้ำ Override <code>OnPoolReset()</code>
              เพื่อ reset state ก่อนการใช้ซ้ำ
            </p>
          </div>

          <CodeBlock
            filename="PooledBullet.cs"
            language="csharp"
            code={pooledBulletCode}
          />

          <Callout type="warning" title="Reference&lt;T&gt; สำหรับ pooled objects">
            การอ้างอิง serialized (<code>[SerializeField]</code>) ไปยังคอมโพเนนต์บน pooled objects อาจเสีย
            หลังจาก pool recycling ใช้ wrapper <code>Reference&lt;T&gt;</code> ของ PurrNet แทนการอ้างอิงโดยตรง
            ไปยังคอมโพเนนต์บน pooled NetworkIdentity objects
          </Callout>
        </DocPage>
      }
    />
  );
}
