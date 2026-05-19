import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "NetworkBehaviour" };

const propertyParamsEN = [
  { name: "isServer", type: "bool", description: "True when this code runs on the server instance. Use to guard server-only logic such as spawning, damage application, and physics authority." },
  { name: "isClient", type: "bool", description: "True when this code runs on a connected client. Also true on a host (listen server) because the host acts as both." },
  { name: "isOwner", type: "bool", description: "True only on the client that currently owns this object. Use to restrict local player input, camera attachment, and owner-auth SyncVar writes." },
  { name: "IsController", type: "bool", description: "True if this machine is the owner, or if the server is running and no owner is assigned. Useful for scripts that should be driven by the owner when present, or the server when absent." },
  { name: "owner", type: "PlayerID?", description: "Nullable ID of the current owner. Null when the object is server-controlled or unowned." },
  { name: "isSpawned", type: "bool", description: "True once the object is live on the network. False during Awake and before OnSpawned fires." },
  { name: "localPlayer", type: "PlayerID", description: "Shortcut to the local machine's PlayerID. Equivalent to networkManager.localPlayer." },
];

const propertyParamsTH = [
  { name: "isServer", type: "bool", description: "True เมื่อโค้ดนี้รันบน server instance ใช้ป้องกัน logic ที่เป็น server-only เช่น spawning, damage application และ physics authority" },
  { name: "isClient", type: "bool", description: "True เมื่อโค้ดนี้รันบน client ที่เชื่อมต่อ True บน host (listen server) ด้วยเพราะ host ทำหน้าที่ทั้งสองอย่าง" },
  { name: "isOwner", type: "bool", description: "True เฉพาะบน client ที่เป็นเจ้าของ object นี้อยู่ในปัจจุบัน ใช้จำกัด input ของ local player, การแนบกล้อง และการเขียน SyncVar แบบ owner-auth" },
  { name: "IsController", type: "bool", description: "True ถ้าเครื่องนี้เป็นเจ้าของ หรือถ้า server รันอยู่และไม่มีเจ้าของที่กำหนด มีประโยชน์สำหรับสคริปต์ที่ควรขับเคลื่อนโดยเจ้าของเมื่อมี หรือ server เมื่อไม่มี" },
  { name: "owner", type: "PlayerID?", description: "ID ที่ nullable ของเจ้าของปัจจุบัน Null เมื่อ object ถูกควบคุมโดย server หรือไม่มีเจ้าของ" },
  { name: "isSpawned", type: "bool", description: "True เมื่อ object live บนเครือข่ายแล้ว False ระหว่าง Awake และก่อน OnSpawned จะทำงาน" },
  { name: "localPlayer", type: "PlayerID", description: "ทางลัดสู่ PlayerID ของเครื่องท้องถิ่น เทียบเท่ากับ networkManager.localPlayer" },
];

const lifecycleCode = `using PurrNet;
using UnityEngine;

public class NetworkBehaviourLifecycle : NetworkBehaviour
{
    protected override void OnSpawned(bool asServer)
    {
        // Fired after the object is registered on the network.
        // asServer is true when this callback runs on the server.
        // Safe to access isOwner, owner, and SyncVar values here.
        base.OnSpawned(asServer); // always call base first

        if (asServer)
            InitServerState();

        if (isOwner)
            AttachCamera();
    }

    protected override void OnDespawned(bool asServer)
    {
        // Fired before the object is removed from the network.
        // Unsubscribe events and release resources here.
        base.OnDespawned(asServer);

        if (isOwner)
            DetachCamera();
    }

    protected override void OnOwnerChanged(PlayerID? previousOwner, PlayerID? newOwner)
    {
        // Fired on ALL clients when ownership transfers.
        bool iAmNewOwner = newOwner.HasValue && newOwner == localPlayer;
        GetComponent<PlayerInputHandler>().enabled = iAmNewOwner;

        nameplate.text = newOwner.HasValue
            ? $"Player {newOwner.Value}"
            : "Unowned";
    }
}`;

const playerHealthCode = `using PurrNet;
using UnityEngine;
using System.Collections;

public class PlayerHealth : NetworkBehaviour
{
    [SerializeField] private int maxHealth = 100;
    [SerializeField] private float respawnDelay = 3f;

    // Server writes, all clients read
    private SyncVar<int>  _health  = new(100);
    private SyncVar<bool> _isDead  = new(false);

    private HealthBar _healthBar;

    private void Awake()
    {
        _healthBar = GetComponentInChildren<HealthBar>();

        // Subscribe in Awake so we never miss the first sync
        _health.onChanged += OnHealthChanged;
        _isDead.onChanged += OnDeathStateChanged;
    }

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        // Reset health to max each time this object spawns
        if (asServer)
            _health.value = maxHealth;
    }

    // ------ Client → Server ------

    // requireOwnership: false so the server can also call this directly,
    // and so game-world damage triggers (traps, AOE) can hit any player.
    [ServerRpc(requireOwnership: false)]
    public void CmdTakeDamage(int amount, RPCInfo info = default)
    {
        // Server validates: is the caller allowed to deal damage?
        if (_isDead.value || amount <= 0) return;

        _health.value = Mathf.Max(0, _health.value - amount);

        if (_health.value == 0)
            StartCoroutine(HandleDeath());
    }

    [ServerRpc(requireOwnership: false)]
    public void CmdHeal(int amount, RPCInfo info = default)
    {
        if (_isDead.value) return;
        _health.value = Mathf.Min(maxHealth, _health.value + amount);
    }

    // ------ Server-side logic ------

    private IEnumerator HandleDeath()
    {
        // isServer guard — this coroutine only runs on the server
        if (!isServer) yield break;

        _isDead.value = true;
        yield return new WaitForSeconds(respawnDelay);

        _health.value = maxHealth;
        _isDead.value = false;

        // Teleport to a random spawn point
        var spawn = SpawnManager.GetRandomPoint();
        transform.position = spawn;
    }

    // ------ Client-side reactions ------

    private void OnHealthChanged(int newHealth)
    {
        _healthBar.SetFill((float)newHealth / maxHealth);

        if (isOwner)
            HUDManager.Instance.SetHealthText(newHealth, maxHealth);
    }

    private void OnDeathStateChanged(bool dead)
    {
        playerModel.SetActive(!dead);
        deathOverlay.SetActive(dead && isOwner);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="NetworkBehaviour"
          description="NetworkBehaviour extends NetworkIdentity with RPC dispatch, SyncVar support, and network lifecycle callbacks. It is the base class for almost every multiplayer script in PurrNet."
          badge="Core"
          href="/docs/network-behaviour"
        >
          <div className="prose">
            <h2>What NetworkBehaviour Adds</h2>
            <p>
              <code>NetworkIdentity</code> gives a GameObject a network ID and tracks its owner and
              observers. <code>NetworkBehaviour</code> builds on that foundation and adds:
            </p>
            <ul>
              <li><strong>RPC methods</strong> — <code>[ServerRpc]</code>, <code>[ObserversRpc]</code>, <code>[TargetRpc]</code></li>
              <li><strong>Sync types</strong> — <code>SyncVar&lt;T&gt;</code>, <code>SyncList&lt;T&gt;</code>, <code>SyncDictionary&lt;K,V&gt;</code> and more</li>
              <li><strong>Network lifecycle callbacks</strong> — <code>OnSpawned</code>, <code>OnDespawned</code>, <code>OnOwnerChanged</code></li>
              <li><strong>NetworkModules</strong> — attach reusable, non-MonoBehaviour network logic</li>
            </ul>
            <p>
              If you need any of the above in a script, inherit from <code>NetworkBehaviour</code>{" "}
              instead of <code>MonoBehaviour</code>. The component still behaves exactly like a
              MonoBehaviour — it has <code>Awake</code>, <code>Start</code>, <code>Update</code>, etc.
              — but PurrNet recognises it.
            </p>

            <h2>Properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={propertyParamsEN} />
          </div>

          <div className="prose">
            <h2>Lifecycle Callbacks</h2>
            <p>
              Override these <code>protected virtual</code> methods instead of Unity messages for
              anything that depends on network readiness.
            </p>
          </div>

          <CodeBlock
            filename="NetworkBehaviourLifecycle.cs"
            language="csharp"
            code={lifecycleCode}
          />

          <Callout type="tip" title="Always call base.OnSpawned()">
            PurrNet uses <code>OnSpawned</code> internally to initialise SyncVars and modules. If you
            override without calling <code>base.OnSpawned(asServer)</code>, sync types may not
            replicate correctly for late-joining clients.
          </Callout>

          <Callout type="warning" title="Awake vs OnSpawned for initialization">
            <code>Awake</code> runs before the object is registered with the network. Accessing{" "}
            <code>isOwner</code>, <code>isServer</code>, or a SyncVar <code>.value</code> in{" "}
            <code>Awake</code> returns incorrect defaults. Defer network-dependent initialisation to{" "}
            <code>OnSpawned</code>. Subscribing to SyncVar <code>onChanged</code> callbacks in{" "}
            <code>Awake</code> is safe — just do not read the value there.
          </Callout>

          <div className="prose">
            <h2>NetworkBehaviour vs NetworkModule</h2>
            <table>
              <thead>
                <tr><th>Use</th><th>When</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>NetworkBehaviour</code></td>
                  <td>The script must live on a specific GameObject (player, enemy, item), declares its own RPCs and SyncVars. Most networked scripts are NetworkBehaviours.</td>
                </tr>
                <tr>
                  <td><code>NetworkModule</code></td>
                  <td>You want reusable, shareable network logic across multiple NetworkBehaviours — e.g. a generic health module or stamina module — without tying it to a MonoBehaviour lifecycle.</td>
                </tr>
              </tbody>
            </table>

            <h2>Full Example — PlayerHealth</h2>
            <p>
              The following class demonstrates <code>isServer</code> guards,{" "}
              <code>[ServerRpc]</code> for client-initiated damage requests,{" "}
              <code>SyncVar</code> for health replication, and lifecycle callbacks working together.
            </p>
          </div>

          <CodeBlock
            filename="PlayerHealth.cs"
            language="csharp"
            code={playerHealthCode}
          />

          <Callout type="info" title="Guard SyncVar writes with isServer">
            SyncVars are replicated from the authoritative writer — by default always the server.
            Guard writes inside <code>if (isServer)</code> (or <code>ownerAuth: true</code> for
            owner-driven state) to avoid silent no-ops when a client attempts an unauthorised write.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="NetworkBehaviour"
          description="NetworkBehaviour ขยาย NetworkIdentity ด้วยการส่ง RPC, รองรับ SyncVar และ lifecycle callbacks ของเครือข่าย เป็น base class สำหรับสคริปต์ multiplayer เกือบทั้งหมดใน PurrNet"
          badge="Core"
          href="/docs/network-behaviour"
        >
          <div className="prose">
            <h2>สิ่งที่ NetworkBehaviour เพิ่มมา</h2>
            <p>
              <code>NetworkIdentity</code> ให้ network ID กับ GameObject และติดตามเจ้าของและผู้สังเกต
              <code>NetworkBehaviour</code> สร้างบนรากฐานนั้นและเพิ่ม:
            </p>
            <ul>
              <li><strong>RPC methods</strong> — <code>[ServerRpc]</code>, <code>[ObserversRpc]</code>, <code>[TargetRpc]</code></li>
              <li><strong>Sync types</strong> — <code>SyncVar&lt;T&gt;</code>, <code>SyncList&lt;T&gt;</code>, <code>SyncDictionary&lt;K,V&gt;</code> และอื่นๆ</li>
              <li><strong>Network lifecycle callbacks</strong> — <code>OnSpawned</code>, <code>OnDespawned</code>, <code>OnOwnerChanged</code></li>
              <li><strong>NetworkModules</strong> — แนบ network logic ที่ใช้ซ้ำได้และไม่ใช่ MonoBehaviour</li>
            </ul>
            <p>
              ถ้าคุณต้องการสิ่งข้างต้นในสคริปต์ ให้สืบทอดจาก <code>NetworkBehaviour</code> แทน
              <code>MonoBehaviour</code> คอมโพเนนต์ยังคงทำงานเหมือน MonoBehaviour ทุกประการ — มี{" "}
              <code>Awake</code>, <code>Start</code>, <code>Update</code> ฯลฯ — แต่ PurrNet รู้จักมัน
            </p>

            <h2>คุณสมบัติ</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={propertyParamsTH} />
          </div>

          <div className="prose">
            <h2>Lifecycle callbacks</h2>
            <p>
              Override เมธอด <code>protected virtual</code> เหล่านี้แทนการใช้ Unity messages สำหรับ
              สิ่งที่ขึ้นอยู่กับความพร้อมของเครือข่าย
            </p>
          </div>

          <CodeBlock
            filename="NetworkBehaviourLifecycle.cs"
            language="csharp"
            code={lifecycleCode}
          />

          <Callout type="tip" title="เรียก base.OnSpawned() เสมอ">
            PurrNet ใช้ <code>OnSpawned</code> ภายในเพื่อเริ่มต้น SyncVars และ modules ถ้าคุณ override
            โดยไม่เรียก <code>base.OnSpawned(asServer)</code> sync types อาจไม่ replicate อย่างถูกต้อง
            สำหรับ client ที่เข้าร่วมช้า
          </Callout>

          <Callout type="warning" title="Awake vs OnSpawned สำหรับการเริ่มต้น">
            <code>Awake</code> รันก่อนที่ object จะถูกลงทะเบียนกับเครือข่าย การเข้าถึง{" "}
            <code>isOwner</code>, <code>isServer</code> หรือ SyncVar <code>.value</code> ใน{" "}
            <code>Awake</code> จะคืนค่า default ที่ไม่ถูกต้อง เลื่อนการเริ่มต้นที่ขึ้นกับเครือข่ายไปที่{" "}
            <code>OnSpawned</code> การ subscribe SyncVar <code>onChanged</code> callbacks ใน{" "}
            <code>Awake</code> ทำได้อย่างปลอดภัย — แค่อย่าอ่านค่าที่นั่น
          </Callout>

          <div className="prose">
            <h2>NetworkBehaviour vs NetworkModule</h2>
            <table>
              <thead>
                <tr><th>ใช้</th><th>เมื่อ</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>NetworkBehaviour</code></td>
                  <td>สคริปต์ต้องอยู่บน GameObject เฉพาะ (player, enemy, item) มีการประกาศ RPC และ SyncVar ของตัวเอง สคริปต์ networked ส่วนใหญ่เป็น NetworkBehaviours</td>
                </tr>
                <tr>
                  <td><code>NetworkModule</code></td>
                  <td>คุณต้องการ network logic ที่ใช้ซ้ำได้และแชร์ได้ทั่วหลาย NetworkBehaviours — เช่น health module หรือ stamina module แบบ generic — โดยไม่ผูกกับ MonoBehaviour lifecycle</td>
                </tr>
              </tbody>
            </table>

            <h2>ตัวอย่างสมบูรณ์ — PlayerHealth</h2>
            <p>
              คลาสต่อไปนี้สาธิต <code>isServer</code> guards, {" "}
              <code>[ServerRpc]</code> สำหรับ damage requests ที่ client ริเริ่ม, {" "}
              <code>SyncVar</code> สำหรับ health replication และ lifecycle callbacks ที่ทำงานร่วมกัน
            </p>
          </div>

          <CodeBlock
            filename="PlayerHealth.cs"
            language="csharp"
            code={playerHealthCode}
          />

          <Callout type="info" title="ตรวจสอบ isServer ก่อนเขียน SyncVar">
            SyncVars ถูก replicate จากผู้ที่มีสิทธิ์เขียน — โดยค่าเริ่มต้นคือ server เสมอ guard
            การเขียนภายใน <code>if (isServer)</code> (หรือ <code>ownerAuth: true</code> สำหรับ
            owner-driven state) เพื่อหลีกเลี่ยง no-ops เงียบๆ เมื่อ client พยายามเขียนโดยไม่ได้รับอนุญาต
          </Callout>
        </DocPage>
      }
    />
  );
}
