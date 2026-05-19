import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SyncVarVisualizer } from "@/components/visualizers/SyncVarVisualizer";

export const metadata = { title: "SyncVar" };

const paramsEN = [
  { name: "defaultValue", type: "T", description: "Initial value before any sync occurs. Applied on all clients before the first network update arrives." },
  { name: "ownerAuth", type: "bool", default: "false", description: "When true, the owner (not just the server) can write this SyncVar. Used for owner-driven state like local player settings." },
  { name: "sendIntervalInSeconds", type: "float", default: "0 (every tick)", description: "Minimum time between syncs. Setting > 0 batches changes and reduces bandwidth at the cost of update frequency." },
];

const paramsTH = [
  { name: "defaultValue", type: "T", description: "ค่าเริ่มต้นก่อนที่ sync จะเกิดขึ้น ใช้กับ clients ทั้งหมดก่อนที่ network update แรกจะมาถึง" },
  { name: "ownerAuth", type: "bool", default: "false", description: "เมื่อ true เฉพาะเจ้าของปัจจุบันเท่านั้นที่สามารถเขียนตัวแปรนี้ คนอื่นทั้งหมดเข้าถึงได้เฉพาะอ่าน server สามารถเขียนได้เสมอ" },
  { name: "sendIntervalInSeconds", type: "float", default: "0 (ทุก tick)", description: "เวลาขั้นต่ำระหว่าง syncs การตั้งค่า > 0 รวมการเปลี่ยนแปลงและลด bandwidth แลกกับความถี่ในการอัปเดต" },
];

const playerStatsCode = `using PurrNet;
using UnityEngine;

public class PlayerStats : NetworkBehaviour
{
    // Synced health — server writes, all clients read
    private SyncVar<int> _health = new(100);

    // Owner-auth name — only the owner can set their own name
    private SyncVar<string> _playerName = new("Player", ownerAuth: true);

    // Throttled score — sync at most every 0.5 seconds
    private SyncVar<int> _score = new(0, sendIntervalInSeconds: 0.5f);

    private void Awake()
    {
        _health.onChanged += OnHealthChanged;
        _playerName.onChanged += OnNameChanged;
    }

    private void OnHealthChanged(int newValue)
    {
        // Called on ALL clients when health changes
        healthBar.SetValue(newValue, _health.previousValue);
        if (newValue <= 0) Die();
    }

    private void OnNameChanged(string newName)
    {
        nameTag.text = newName;
    }

    // Only server should call this directly
    public void TakeDamage(int amount)
    {
        if (!isServer) return;
        _health.value = Mathf.Max(0, _health.value - amount);
    }
}`;

const weaponControllerCode = `public class WeaponController : NetworkBehaviour
{
    [SerializeField] private int maxAmmo = 30;
    private SyncVar<int> _ammo = new(30);
    private SyncVar<bool> _isReloading = new(false);

    private void Awake()
    {
        _ammo.onChanged += (newAmmo) =>
        {
            ammoDisplay.text = $"{newAmmo}/{maxAmmo}";
            if (newAmmo == 0 && !_isReloading.value)
                StartReload();
        };
        _isReloading.onChanged += (reloading) =>
            reloadIndicator.SetActive(reloading);
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdFire()
    {
        if (_ammo.value <= 0 || _isReloading.value) return;
        _ammo.value--;
        // Fire logic...
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdReload()
    {
        if (_isReloading.value || _ammo.value == maxAmmo) return;
        _isReloading.value = true;
        StartCoroutine(ReloadCoroutine());
    }

    private IEnumerator ReloadCoroutine()
    {
        yield return new WaitForSeconds(2f);
        _ammo.value = maxAmmo;
        _isReloading.value = false;
    }
}`;

const playerDataCode = `[RegisterNetworkType(typeof(PlayerData))]
public struct PlayerData : IPackedAuto
{
    public int level;
    public int experience;
    public string displayName;
}

public class PlayerProfile : NetworkBehaviour
{
    private SyncVar<PlayerData> _data = new(new PlayerData { level = 1, displayName = "New Player" });

    private void Awake()
    {
        _data.onChanged += (data) => UpdateProfileUI(data);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="SyncVar"
          description="SyncVar<T> is a networked variable that automatically replicates its value from the server (or owner) to all clients whenever it changes."
          badge="Sync Type"
          href="/docs/syncvar"
        >
          <div className="not-prose mb-6">
            <SyncVarVisualizer variableName="health" showControls />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              Declare a <code>SyncVar&lt;T&gt;</code> as a field on your <code>NetworkBehaviour</code>.
              Whenever you assign to <code>.value</code>, PurrNet detects the change and queues a sync
              packet on the next tick (or after the send interval). All observers receive the update and
              their local <code>.value</code> is updated automatically. New clients joining mid-game
              receive the current value immediately.
            </p>
            <p>
              SyncVar works with any type PurrNet can serialize: primitives, structs with{" "}
              <code>IPackedAuto</code>, <code>Vector3</code>, <code>Quaternion</code>,{" "}
              <code>string</code>, enums, and more.
            </p>

            <h2>Constructor Parameters</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
          </div>

          <CodeBlock
            filename="PlayerStats.cs"
            language="csharp"
            code={playerStatsCode}
          />

          <Callout type="info" title="Declare in fields, not methods">
            SyncVar must be declared as a class field (or property) on a NetworkBehaviour. Creating
            one inside a method or adding it to a list will break synchronisation.
          </Callout>

          <div className="prose">
            <h2>Reading the previous value</h2>
            <p>
              The <code>onChanged</code> callback receives only the new value. To access the previous
              value, use <code>syncVar.previousValue</code> inside the callback.
            </p>

            <h2>Situational examples</h2>

            <h3>Sync ammo with UI feedback</h3>
          </div>

          <CodeBlock
            filename="WeaponController.cs"
            language="csharp"
            code={weaponControllerCode}
          />

          <div className="prose">
            <h3>Syncing a custom struct</h3>
            <p>
              Register a custom type with <code>[RegisterNetworkType]</code> and implement{" "}
              <code>IPackedAuto</code> for automatic field serialization.
            </p>
          </div>

          <CodeBlock
            filename="PlayerData.cs"
            language="csharp"
            code={playerDataCode}
          />

          <Callout type="warning" title="Avoid syncing every frame">
            Do not set <code>.value</code> in <code>Update()</code> without checking for an actual
            change. PurrNet batches changes per tick, but creating dirty flags every frame wastes CPU
            even when the value hasn&apos;t changed. Always guard:{" "}
            <code>if (_speed.value != newSpeed) _speed.value = newSpeed;</code>
          </Callout>

          <Callout type="danger" title="ownerAuth and server writes">
            When <code>ownerAuth: true</code>, only the owner can write from the client side. The
            server can always write regardless. If you need to override an owner-protected var from
            the server, call from server-side code (inside an <code>if (isServer)</code> guard).
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="SyncVar"
          description="SyncVar ซิงโครไนซ์ตัวแปรที่มีประเภทโดยอัตโนมัติทั่ว clients ทั้งหมดที่เชื่อมต่อทุกครั้งที่ค่าเปลี่ยนแปลง เป็นวิธีที่ง่ายที่สุดในการแชร์ state ใน PurrNet"
          badge="Sync Type"
          href="/docs/syncvar"
        >
          <div className="not-prose mb-6">
            <SyncVarVisualizer variableName="health" showControls />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              ประกาศ <code>SyncVar&lt;T&gt;</code> เป็น field บน <code>NetworkBehaviour</code> ของคุณ ทุกครั้งที่คุณตั้งค่า
              <code>.value</code> PurrNet จะตรวจจับการเปลี่ยนแปลงและ queue sync packet ใน tick ถัดไป
              (หรือหลัง send interval) observers ทั้งหมดจะได้รับการอัปเดตและ <code>.value</code> ท้องถิ่นของพวกเขา{" "}
              จะอัปเดตโดยอัตโนมัติ clients ใหม่ที่เข้าร่วมระหว่างเกมจะได้รับค่าปัจจุบันทันที
            </p>
            <p>
              SyncVar ทำงานกับ types ใดๆ ที่ PurrNet serialize ได้: primitives, structs ที่มี{" "}
              <code>IPackedAuto</code>, <code>Vector3</code>, <code>Quaternion</code>, <code>string</code>, enums ฯลฯ
            </p>

            <h2>พารามิเตอร์ Constructor</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsTH} />
          </div>

          <div className="prose">
            <h2>การใช้พื้นฐาน</h2>
          </div>

          <CodeBlock
            filename="PlayerStats.cs"
            language="csharp"
            code={playerStatsCode}
          />

          <Callout type="info" title="ประกาศในฟิลด์ ไม่ใช่ในเมธอด">
            SyncVar ต้องประกาศเป็น class field (หรือ property) บน NetworkBehaviour การสร้างภายในเมธอด
            หรือเพิ่มลงใน list จะทำให้ synchronisation เสีย
          </Callout>

          <div className="prose">
            <h2>การอ่านค่าก่อนหน้า</h2>
            <p>
              <code>onChanged</code> callback รับเฉพาะค่าใหม่ หากต้องการเข้าถึงค่าก่อนหน้า
              ใช้ <code>syncVar.previousValue</code> ภายใน callback
            </p>

            <h2>ตัวอย่างสถานการณ์</h2>

            <h3>Sync ammo พร้อม UI feedback</h3>
          </div>

          <CodeBlock
            filename="WeaponController.cs"
            language="csharp"
            code={weaponControllerCode}
          />

          <div className="prose">
            <h3>การ sync custom struct</h3>
            <p>
              ลงทะเบียน custom type ด้วย <code>[RegisterNetworkType]</code> และ implement{" "}
              <code>IPackedAuto</code> สำหรับ field serialization อัตโนมัติ
            </p>
          </div>

          <CodeBlock
            filename="PlayerData.cs"
            language="csharp"
            code={playerDataCode}
          />

          <Callout type="warning" title="หลีกเลี่ยงการ sync ทุก frame">
            อย่าตั้งค่า <code>.value</code> ใน <code>Update()</code> โดยไม่ตรวจสอบการเปลี่ยนแปลง
            PurrNet รวมการเปลี่ยนแปลงต่อ tick แต่การสร้าง dirty flags ทุก frame เปลือง CPU
            แม้ว่าค่าจะไม่เปลี่ยน ตรวจสอบเสมอ: <code>if (_speed.value != newSpeed) _speed.value = newSpeed;</code>
          </Callout>

          <Callout type="danger" title="ownerAuth และการเขียน server">
            เมื่อ <code>ownerAuth: true</code> เฉพาะเจ้าของเท่านั้นที่สามารถเขียนจาก client server สามารถ
            เขียนได้เสมอโดยไม่คำนึง ถ้าคุณต้องการ override owner-protected var จาก server เรียกจาก
            server-side code (ภายใน <code>if (isServer)</code> guard)
          </Callout>
        </DocPage>
      }
    />
  );
}
