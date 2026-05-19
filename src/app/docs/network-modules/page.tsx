import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { NetworkModulesVisualizer } from "@/components/visualizers/NetworkModulesVisualizer";

export const metadata = { title: "Network Modules" };

const lifecycleParamsEN = [
  { name: "OnSpawn()", type: "virtual void", description: "Called when the parent NetworkIdentity spawns on the network. Override for network initialisation." },
  { name: "OnDespawn()", type: "virtual void", description: "Called before the parent object is removed from the network. Clean up subscriptions here." },
  { name: "isServer", type: "bool", description: "True when running on the server. Mirrors the parent identity's isServer property." },
  { name: "isOwner", type: "bool", description: "True on the client that owns the parent NetworkIdentity. Mirrors parent's isOwner." },
  { name: "IsController", type: "bool", description: "True if owner OR (server with no owner). Mirrors parent's IsController." },
  { name: "identity", type: "NetworkIdentity", description: "Reference back to the parent NetworkIdentity this module is attached to." },
];

const lifecycleParamsTH = [
  { name: "OnSpawn()", type: "virtual void", description: "เรียกเมื่อ parent NetworkIdentity spawn บนเครือข่าย Override สำหรับ network initialisation" },
  { name: "OnDespawn()", type: "virtual void", description: "เรียกก่อนที่ parent object จะถูกลบออกจากเครือข่าย ล้าง subscriptions ที่นี่" },
  { name: "isServer", type: "bool", description: "True เมื่อทำงานบน server สะท้อน isServer property ของ parent identity" },
  { name: "isOwner", type: "bool", description: "True บน client ที่เป็นเจ้าของ parent NetworkIdentity สะท้อน isOwner ของ parent" },
  { name: "IsController", type: "bool", description: "True ถ้า owner หรือ (server ที่ไม่มี owner) สะท้อน IsController ของ parent" },
  { name: "identity", type: "NetworkIdentity", description: "Reference กลับไปยัง parent NetworkIdentity ที่ module นี้ attach อยู่" },
];

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Network Modules"
          description="NetworkModule lets you create reusable, network-aware components that are not MonoBehaviours. Attach multiple modules to a single NetworkIdentity to compose complex networked behaviours."
          badge="Advanced"
          href="/docs/network-modules"
        >
          <div className="not-prose mb-6">
            <NetworkModulesVisualizer showControls />
          </div>

          <div className="prose">
            <h2>What is a NetworkModule?</h2>
            <p>
              A <code>NetworkModule</code> is a base class (not a MonoBehaviour) that gives you
              access to the same RPC attributes, SyncVars, and lifecycle hooks available in{" "}
              <code>NetworkBehaviour</code>. The key difference: modules are pure C# classes that
              you declare as fields on a <code>NetworkIdentity</code>, making them fully composable
              and reusable across any prefab.
            </p>
            <p>
              Instead of building a monolithic NetworkBehaviour with health, inventory, and abilities
              all in one class, you write a <code>HealthModule</code>, an <code>InventoryModule</code>,
              and an <code>AbilityModule</code> — then attach whichever combination each prefab needs.
            </p>

            <h2>Module lifecycle</h2>
          </div>

          <div className="not-prose"><ParamTable params={lifecycleParamsEN} /></div>

          <div className="prose">
            <h2>Complete HealthModule example</h2>
          </div>

          <CodeBlock filename="HealthModule.cs" language="csharp" code={`using PurrNet;
using UnityEngine;
using System;

[Serializable]
public class HealthModule : NetworkModule
{
    [SerializeField] private int maxHealth = 100;

    private SyncVar<int>  _health    = new();
    private SyncVar<bool> _isDead    = new();

    // Public events — other scripts subscribe locally
    public event Action<int, int> OnHealthChanged;  // (newHealth, maxHealth)
    public event Action           OnDeath;

    public int  CurrentHealth => _health.value;
    public bool IsDead        => _isDead.value;

    public override void OnSpawn()
    {
        base.OnSpawn();
        _health.onChanged += (hp) => OnHealthChanged?.Invoke(hp, maxHealth);
        _isDead.onChanged += (dead) => { if (dead) OnDeath?.Invoke(); };

        if (isServer)
            _health.value = maxHealth;
    }

    public void TakeDamage(int amount)
    {
        if (!isServer || _isDead.value) return;
        _health.value = Mathf.Max(0, _health.value - amount);
        if (_health.value == 0) _isDead.value = true;
    }

    public void Heal(int amount)
    {
        if (!isServer || _isDead.value) return;
        _health.value = Mathf.Min(maxHealth, _health.value + amount);
    }

    [ObserversRpc(runLocally: true)]
    public void RpcPlayHitEffect(Vector3 hitPoint)
    {
        VFXManager.SpawnBlood(hitPoint);
    }
}`} />

          <div className="prose">
            <h2>Attaching a module to a NetworkBehaviour</h2>
            <p>Declare the module as a field — that&apos;s all. PurrNet detects and registers it automatically.</p>
          </div>

          <CodeBlock filename="PlayerCharacter.cs" language="csharp" code={`using PurrNet;
using UnityEngine;

public class PlayerCharacter : NetworkBehaviour
{
    // Modules declared as fields — PurrNet auto-registers them
    private HealthModule    _health    = new();
    private InventoryModule _inventory = new();
    private AbilityModule   _abilities = new();

    protected override void OnSpawned(bool asServer)
    {
        // Modules have already been initialised by this point
        _health.OnDeath += HandleDeath;
        _health.OnHealthChanged += (hp, max) => healthBar.SetValue(hp, max);

        if (isOwner)
            _abilities.OnAbilityReady += ShowAbilityGlow;
    }

    private void HandleDeath()
    {
        if (isServer)
            StartCoroutine(RespawnAfterDelay(5f));
    }

    // External code (e.g., a bullet) calls the module directly
    public void ReceiveDamage(int damage, Vector3 hitPoint)
    {
        _health.TakeDamage(damage);
        _health.RpcPlayHitEffect(hitPoint);
    }
}`} />

          <div className="prose">
            <h2>Reuse across prefabs</h2>
            <p>
              The same <code>HealthModule</code> works on a <code>PlayerCharacter</code>, an{" "}
              <code>NPC</code>, a <code>Destructible</code>, or a <code>Vehicle</code>. No
              copy-paste, no inheritance chains.
            </p>

            <h2>NetworkModule vs NetworkBehaviour</h2>
            <ul>
              <li>Use <strong>NetworkBehaviour</strong> when your script needs to be a component in the Unity Inspector (serialized fields, MonoBehaviour events like <code>Update()</code>).</li>
              <li>Use <strong>NetworkModule</strong> for pure-logic, reusable network components that do not need their own GameObject slot — health, inventory, abilities, cooldowns, status effects.</li>
            </ul>
          </div>

          <Callout type="warning" title="Do not store modules in collections">
            Network modules must be declared as fields or properties directly on a{" "}
            <code>NetworkIdentity</code>. Storing them inside a <code>List&lt;NetworkModule&gt;</code>,
            array, or dictionary will break automatic network registration. Declare each module as
            its own named field.
          </Callout>

          <Callout type="tip" title="Modules can reference each other">
            Modules can hold references to sibling modules through the constructor or via{" "}
            <code>identity.GetModule&lt;T&gt;()</code> inside <code>OnSpawn()</code>. This lets an{" "}
            <code>AbilityModule</code> check <code>_health.IsDead</code> before allowing the ability
            to fire.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Network Modules"
          description="NetworkModule ให้คุณสร้าง reusable, network-aware components ที่ไม่ใช่ MonoBehaviours Attach modules หลายตัวกับ NetworkIdentity เดียวเพื่อ compose networked behaviours ที่ซับซ้อน"
          badge="Advanced"
          href="/docs/network-modules"
        >
          <div className="not-prose mb-6">
            <NetworkModulesVisualizer showControls />
          </div>

          <div className="prose">
            <h2>NetworkModule คืออะไร?</h2>
            <p>
              <code>NetworkModule</code> คือ base class (ไม่ใช่ MonoBehaviour) ที่ให้คุณเข้าถึง
              RPC attributes, SyncVars และ lifecycle hooks เดียวกับที่มีอยู่ใน <code>NetworkBehaviour</code>
              ความแตกต่างหลัก: modules คือ pure C# classes ที่คุณประกาศเป็น fields บน
              <code>NetworkIdentity</code> ทำให้ composable และ reusable ได้อย่างเต็มที่ทั่ว prefabs ใดก็ตาม
            </p>
            <p>
              แทนที่จะสร้าง monolithic NetworkBehaviour ที่มี health, inventory และ abilities ทั้งหมด
              ในคลาสเดียว คุณเขียน <code>HealthModule</code>, <code>InventoryModule</code> และ
              <code>AbilityModule</code> — แล้ว attach combination ที่แต่ละ prefab ต้องการ
            </p>

            <h2>Lifecycle ของ Module</h2>
          </div>

          <div className="not-prose"><ParamTable params={lifecycleParamsTH} /></div>

          <div className="prose">
            <h2>ตัวอย่าง HealthModule แบบสมบูรณ์</h2>
          </div>

          <CodeBlock filename="HealthModule.cs" language="csharp" code={`using PurrNet;
using UnityEngine;
using System;

[Serializable]
public class HealthModule : NetworkModule
{
    [SerializeField] private int maxHealth = 100;

    private SyncVar<int>  _health    = new();
    private SyncVar<bool> _isDead    = new();

    // Public events — other scripts subscribe locally
    public event Action<int, int> OnHealthChanged;  // (newHealth, maxHealth)
    public event Action           OnDeath;

    public int  CurrentHealth => _health.value;
    public bool IsDead        => _isDead.value;

    public override void OnSpawn()
    {
        base.OnSpawn();
        _health.onChanged += (hp) => OnHealthChanged?.Invoke(hp, maxHealth);
        _isDead.onChanged += (dead) => { if (dead) OnDeath?.Invoke(); };

        if (isServer)
            _health.value = maxHealth;
    }

    public void TakeDamage(int amount)
    {
        if (!isServer || _isDead.value) return;
        _health.value = Mathf.Max(0, _health.value - amount);
        if (_health.value == 0) _isDead.value = true;
    }

    public void Heal(int amount)
    {
        if (!isServer || _isDead.value) return;
        _health.value = Mathf.Min(maxHealth, _health.value + amount);
    }

    [ObserversRpc(runLocally: true)]
    public void RpcPlayHitEffect(Vector3 hitPoint)
    {
        VFXManager.SpawnBlood(hitPoint);
    }
}`} />

          <div className="prose">
            <h2>การ attach module กับ NetworkBehaviour</h2>
            <p>ประกาศ module เป็น field — เท่านั้น PurrNet ตรวจจับและลงทะเบียนโดยอัตโนมัติ</p>
          </div>

          <CodeBlock filename="PlayerCharacter.cs" language="csharp" code={`using PurrNet;
using UnityEngine;

public class PlayerCharacter : NetworkBehaviour
{
    // Modules declared as fields — PurrNet auto-registers them
    private HealthModule    _health    = new();
    private InventoryModule _inventory = new();
    private AbilityModule   _abilities = new();

    protected override void OnSpawned(bool asServer)
    {
        // Modules have already been initialised by this point
        _health.OnDeath += HandleDeath;
        _health.OnHealthChanged += (hp, max) => healthBar.SetValue(hp, max);

        if (isOwner)
            _abilities.OnAbilityReady += ShowAbilityGlow;
    }

    private void HandleDeath()
    {
        if (isServer)
            StartCoroutine(RespawnAfterDelay(5f));
    }

    // External code (e.g., a bullet) calls the module directly
    public void ReceiveDamage(int damage, Vector3 hitPoint)
    {
        _health.TakeDamage(damage);
        _health.RpcPlayHitEffect(hitPoint);
    }
}`} />

          <div className="prose">
            <h2>การใช้ซ้ำทั่ว prefabs</h2>
            <p>
              <code>HealthModule</code> เดียวกันทำงานบน <code>PlayerCharacter</code>, <code>NPC</code>,
              <code>Destructible</code> หรือ <code>Vehicle</code> ไม่ต้อง copy-paste ไม่มี inheritance chains
            </p>

            <h2>NetworkModule vs NetworkBehaviour</h2>
            <ul>
              <li>ใช้ <strong>NetworkBehaviour</strong> เมื่อ script ของคุณต้องเป็น component ใน Unity Inspector (serialized fields, MonoBehaviour events เช่น <code>Update()</code>)</li>
              <li>ใช้ <strong>NetworkModule</strong> สำหรับ pure-logic, reusable network components ที่ไม่ต้องการ GameObject slot ของตัวเอง — health, inventory, abilities, cooldowns, status effects</li>
            </ul>
          </div>

          <Callout type="warning" title="อย่าเก็บ modules ใน collections">
            Network modules ต้องประกาศเป็น fields หรือ properties โดยตรงบน <code>NetworkIdentity</code>
            การเก็บไว้ใน <code>List&lt;NetworkModule&gt;</code>, array หรือ dictionary จะทำให้
            automatic network registration เสีย ประกาศแต่ละ module เป็น named field ของตัวเอง
          </Callout>

          <Callout type="tip" title="Modules สามารถ reference กันเองได้">
            Modules สามารถเก็บ references ไปยัง sibling modules ผ่าน constructor หรือผ่าน <code>identity.GetModule&lt;T&gt;()</code>
            ภายใน <code>OnSpawn()</code> ทำให้ <code>AbilityModule</code> สามารถตรวจสอบ
            <code>_health.IsDead</code> ก่อนที่จะอนุญาตให้ ability fire ได้
          </Callout>
        </DocPage>
      }
    />
  );
}
