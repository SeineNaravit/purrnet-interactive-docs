import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "SyncList" };

const changeParamsEN = [
  { name: ".operation", type: "SyncListOperation", description: "The type of change: Added, Removed, Insert, Set, or Cleared." },
  { name: ".value", type: "T", description: "The new value associated with the change." },
  { name: ".index", type: "int", description: "The affected list index position." },
];

const changeParamsTH = [
  { name: ".operation", type: "SyncListOperation", description: "ประเภทของการเปลี่ยนแปลง: Added, Removed, Insert, Set, Cleared" },
  { name: ".value", type: "T", description: "ค่าใหม่ที่เกี่ยวข้องกับการเปลี่ยนแปลง" },
  { name: ".index", type: "int", description: "ตำแหน่ง index ที่ได้รับผลกระทบ" },
];

const inventorySystemCode = `using PurrNet;
using System.Collections.Generic;

public class InventorySystem : NetworkBehaviour
{
    // ownerAuth: only the owner can modify their inventory
    private SyncList<int> _items = new SyncList<int>(ownerAuth: true);

    private void Awake()
    {
        _items.onChanged += OnInventoryChanged;
    }

    private void OnInventoryChanged(SyncListChange<int> change)
    {
        switch (change.operation)
        {
            case SyncListOperation.Added:
                UI.ShowPickupNotification(change.value);
                break;
            case SyncListOperation.Removed:
                UI.ShowDropNotification(change.value);
                break;
            case SyncListOperation.Cleared:
                UI.RefreshInventoryGrid(_items);
                break;
        }
    }

    // Owner can call this — ownerAuth:true means server allows it
    [ServerRpc(requireOwnership: true)]
    public void CmdPickupItem(int itemId)
    {
        if (_items.Count >= maxItems) return;
        _items.Add(itemId);
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdDropItem(int itemId)
    {
        _items.Remove(itemId);
    }
}`;

const teamManagerCode = `public class TeamManager : NetworkBehaviour
{
    private SyncList<PlayerID> _redTeam  = new();
    private SyncList<PlayerID> _blueTeam = new();

    private void Awake()
    {
        _redTeam.onChanged  += _ => UpdateTeamUI("Red",  _redTeam);
        _blueTeam.onChanged += _ => UpdateTeamUI("Blue", _blueTeam);
    }

    protected override void OnSpawned(bool asServer)
    {
        if (!asServer) return;

        // Subscribe to player join/leave events
        networkManager.onPlayerConnected    += OnPlayerJoined;
        networkManager.onPlayerDisconnected += OnPlayerLeft;
    }

    private void OnPlayerJoined(PlayerID player)
    {
        // Assign to smaller team
        if (_redTeam.Count <= _blueTeam.Count)
            _redTeam.Add(player);
        else
            _blueTeam.Add(player);
    }

    private void OnPlayerLeft(PlayerID player)
    {
        _redTeam.Remove(player);
        _blueTeam.Remove(player);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="SyncList"
          description="SyncList<T> is a networked list that automatically propagates add, remove, insert, and clear operations to all clients. Changes are delta-synced — only the operation is sent, not the full list."
          badge="Sync Type"
          href="/docs/synclist"
        >
          <div className="prose">
            <h2>How it works</h2>
            <p>
              <code>SyncList&lt;T&gt;</code> behaves like a regular <code>List&lt;T&gt;</code>, but
              every mutation (<code>Add</code>, <code>Remove</code>, <code>Insert</code>,{" "}
              <code>Clear</code>, index assignment) is replicated to all observers. Each operation
              fires the <code>onChanged</code> callback with a <code>SyncListChange&lt;T&gt;</code>{" "}
              struct describing what changed.
            </p>
            <p>Late-joining clients receive the full current list state on connect.</p>
          </div>

          <CodeBlock
            filename="InventorySystem.cs"
            language="csharp"
            code={inventorySystemCode}
          />

          <div className="prose">
            <h2>SyncListChange properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={changeParamsEN} />
          </div>

          <div className="prose">
            <h2>Available methods</h2>
            <ul>
              <li><code>Add(T item)</code> — appends to the end</li>
              <li><code>Remove(T item)</code> — removes the first occurrence by value</li>
              <li><code>RemoveAt(int index)</code> — removes by index</li>
              <li><code>Insert(int index, T item)</code> — inserts at position</li>
              <li><code>Clear()</code> — removes all elements</li>
              <li><code>list[index] = value</code> — updates value at index (fires <code>Set</code> operation)</li>
              <li><code>SetDirty(int index)</code> — forces re-sync of an element (useful for mutable structs)</li>
              <li><code>Count</code>, <code>Contains()</code>, <code>IndexOf()</code> — standard read operations</li>
            </ul>

            <h2>Situational example — team roster</h2>
          </div>

          <CodeBlock
            filename="TeamManager.cs"
            language="csharp"
            code={teamManagerCode}
          />

          <Callout type="warning" title="SetDirty for mutable structs">
            If <code>T</code> is a struct and you mutate a field of an element in place (e.g.{" "}
            <code>_list[0].health--</code>), SyncList cannot detect the change automatically.
            Call <code>_list.SetDirty(0)</code> after the mutation to force a sync.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="SyncList"
          description="SyncList คือ list ที่ network-aware ซึ่งซิงโครไนซ์เนื้อหาโดยอัตโนมัติ — การเพิ่ม, การลบ, การแทรก และการล้าง — ทั่ว clients ทั้งหมด"
          badge="Sync Type"
          href="/docs/synclist"
        >
          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              <code>SyncList&lt;T&gt;</code> ทำงานเหมือน <code>List&lt;T&gt;</code> ปกติ แต่ทุก
              mutation (<code>Add</code>, <code>Remove</code>, <code>Insert</code>, <code>Clear</code>,
              การกำหนดค่า index) จะถูก replicate ไปยัง observers ทั้งหมด แต่ละ operation จะ fire
              <code>onChanged</code> callback พร้อม struct <code>SyncListChange&lt;T&gt;</code> ที่อธิบาย
              ว่าอะไรเปลี่ยนแปลง
            </p>
            <p>Clients ที่เข้าร่วมช้าจะได้รับสถานะ list ปัจจุบันทั้งหมดเมื่อเชื่อมต่อ</p>
          </div>

          <CodeBlock
            filename="InventorySystem.cs"
            language="csharp"
            code={inventorySystemCode}
          />

          <div className="prose">
            <h2>คุณสมบัติ SyncListChange</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={changeParamsTH} />
          </div>

          <div className="prose">
            <h2>เมธอดที่มีให้ใช้</h2>
            <ul>
              <li><code>Add(T item)</code> — เพิ่มไปที่ท้าย</li>
              <li><code>Remove(T item)</code> — ลบการเกิดขึ้นแรกตามค่า</li>
              <li><code>RemoveAt(int index)</code> — ลบตาม index</li>
              <li><code>Insert(int index, T item)</code> — แทรกที่ตำแหน่ง</li>
              <li><code>Clear()</code> — ลบ elements ทั้งหมด</li>
              <li><code>list[index] = value</code> — อัปเดตค่าที่ index (fire operation <code>Set</code>)</li>
              <li><code>SetDirty(int index)</code> — บังคับ re-sync ของ element (มีประโยชน์สำหรับ mutable structs)</li>
              <li><code>Count</code>, <code>Contains()</code>, <code>IndexOf()</code> — read operations มาตรฐาน</li>
            </ul>

            <h2>ตัวอย่างสถานการณ์ — team roster</h2>
          </div>

          <CodeBlock
            filename="TeamManager.cs"
            language="csharp"
            code={teamManagerCode}
          />

          <Callout type="warning" title="SetDirty สำหรับ mutable structs">
            ถ้า <code>T</code> เป็น struct และคุณ mutate field ของ element ในตำแหน่ง (เช่น{" "}
            <code>_list[0].health--</code>) SyncList ไม่สามารถตรวจจับการเปลี่ยนแปลงโดยอัตโนมัติ
            เรียก <code>_list.SetDirty(0)</code> หลังจาก mutation เพื่อบังคับ sync
          </Callout>
        </DocPage>
      }
    />
  );
}
