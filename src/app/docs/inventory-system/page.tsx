import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { InventoryMindMap } from "@/components/visualizers/ComponentMindMapVisualizer";

export const metadata = { title: "Inventory System" };

// ── API Parameter tables ──────────────────────────────────────────────────────

const apiParamsEN = [
  {
    name: "GetInventory()",
    type: "IReadOnlyList<InventoryItem>",
    description:
      "Returns the current list of all slots. Read-only; clients use this for display.",
  },
  {
    name: "AddItem(string itemId, int quantity)",
    type: "[ServerRpc] void",
    description:
      "Stacks into existing slots first, then fills empty slots. Respects maxStackSize from ItemData.",
  },
  {
    name: "RemoveItem(string itemId, int quantity)",
    type: "[ServerRpc] void",
    description:
      "Removes quantity from back to front. Partial stacks are consumed first.",
  },
  {
    name: "MoveItem(int from, int to)",
    type: "[ServerRpc] void",
    description:
      "Swaps two slots. If same item, attempts to stack up to maxStackSize.",
  },
  {
    name: "EquipItem(int slotIndex)",
    type: "[ServerRpc] void",
    description:
      "Equips the item at slotIndex. Swaps with currently equipped item in that equipment slot.",
  },
  {
    name: "SortInventory()",
    type: "[ServerRpc] void",
    description:
      "Sorts all slots alphabetically by itemId then by quantity descending. Empty slots sink to the bottom.",
  },
  {
    name: "onInventoryChanged",
    type: "event Action",
    description:
      "Fires on all clients whenever any slot changes.",
  },
  {
    name: "onEquipmentChanged",
    type: "event Action<EquipmentSlotType, InventoryItem>",
    description:
      "Fires when equipment changes in any slot.",
  },
];

const apiParamsTH = [
  {
    name: "GetInventory()",
    type: "IReadOnlyList<InventoryItem>",
    description:
      "คืนค่า list ปัจจุบันของ slots ทั้งหมด Read-only; clients ใช้เพื่อแสดงผล",
  },
  {
    name: "AddItem(string itemId, int quantity)",
    type: "[ServerRpc] void",
    description:
      "Stack ใน slots ที่มีอยู่ก่อน แล้วเติม empty slots ใช้ maxStackSize จาก ItemData",
  },
  {
    name: "RemoveItem(string itemId, int quantity)",
    type: "[ServerRpc] void",
    description:
      "ลบ quantity จากหลังไปหน้า Partial stacks ถูกใช้ก่อน",
  },
  {
    name: "MoveItem(int from, int to)",
    type: "[ServerRpc] void",
    description:
      "สลับ slots สอง slots ถ้า item เดียวกัน พยายาม stack สูงสุดถึง maxStackSize",
  },
  {
    name: "EquipItem(int slotIndex)",
    type: "[ServerRpc] void",
    description:
      "สวมใส่ item ที่ slotIndex สลับกับ item ที่ติดตั้งอยู่ใน equipment slot นั้น",
  },
  {
    name: "SortInventory()",
    type: "[ServerRpc] void",
    description:
      "เรียงลำดับ slots ตามตัวอักษรของ itemId แล้วตาม quantity จากมากไปน้อย Slots ว่างจมลงไปที่ด้านล่าง",
  },
  {
    name: "onInventoryChanged",
    type: "event Action",
    description:
      "ทำงานบน clients ทั้งหมดเมื่อ slot ใดเปลี่ยนแปลง",
  },
  {
    name: "onEquipmentChanged",
    type: "event Action<EquipmentSlotType, InventoryItem>",
    description:
      "ทำงานเมื่อ equipment เปลี่ยนใน slot ใดก็ตาม",
  },
];

// ── Shared C# code blocks (identical for EN and TH) ──────────────────────────

const itemDataCode = `using UnityEngine;

[CreateAssetMenu(fileName = "Item", menuName = "PurrNet/Item Data")]
public class ItemData : ScriptableObject
{
    public string itemId;          // unique key used in InventoryItem
    public string displayName;
    [TextArea] public string description;
    public Sprite icon;
    [Min(1)] public int maxStackSize = 1;
    public bool isEquippable;
    public EquipmentSlotType equipmentSlot;
    public ItemRarity rarity;
}

public enum ItemRarity { Common, Uncommon, Rare, Epic, Legendary }
public enum EquipmentSlotType { None, Weapon, Helmet, Chest, Legs, Boots }`;

const itemDatabaseCode = `using UnityEngine;
using System.Collections.Generic;

[CreateAssetMenu(fileName = "ItemDatabase", menuName = "PurrNet/Item Database")]
public class ItemDatabase : ScriptableObject
{
    [SerializeField] private ItemData[] _items;
    private Dictionary<string, ItemData> _lookup;

    private void OnEnable()
    {
        _lookup = new Dictionary<string, ItemData>();
        foreach (var item in _items)
            if (item != null && !string.IsNullOrEmpty(item.itemId))
                _lookup[item.itemId] = item;
    }

    public ItemData Get(string itemId) =>
        !string.IsNullOrEmpty(itemId) && _lookup.TryGetValue(itemId, out var d) ? d : null;

    public IEnumerable<ItemData> All => _items;
}`;

const inventoryItemCode = `using System;

[Serializable]
public struct InventoryItem : IPackedAuto
{
    public string itemId;
    public int    quantity;
    public bool   IsEmpty => string.IsNullOrEmpty(itemId) || quantity <= 0;
    public static readonly InventoryItem Empty = default;
}`;

const playerInventoryCode = `using PurrNet;
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class PlayerInventory : NetworkBehaviour
{
    [SerializeField] private ItemDatabase _database;
    [SerializeField] private int          _slotCount = 24;

    private SyncList<InventoryItem>                          _slots    = new();
    private SyncDictionary<EquipmentSlotType, InventoryItem> _equipped = new();

    // Events — fire on ALL clients
    public event Action                                    onInventoryChanged;
    public event Action<EquipmentSlotType, InventoryItem>  onEquipmentChanged;

    // ── Lifecycle ──────────────────────────────────────────────────────────

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        if (asServer)
        {
            for (int i = 0; i < _slotCount; i++)
                _slots.Add(InventoryItem.Empty);
        }

        _slots.onChanged    += _ => onInventoryChanged?.Invoke();
        _equipped.onChanged += (k, v, _) => onEquipmentChanged?.Invoke(k, v);
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        _slots.onChanged    -= _ => onInventoryChanged?.Invoke();
        _equipped.onChanged -= (k, v, _) => onEquipmentChanged?.Invoke(k, v);
    }

    // ── Read API (safe to call from any client) ────────────────────────────

    public IReadOnlyList<InventoryItem> GetInventory() => _slots;

    public InventoryItem GetEquipped(EquipmentSlotType slot) =>
        _equipped.TryGetValue(slot, out var item) ? item : InventoryItem.Empty;

    public bool HasItem(string itemId, int qty = 1)
    {
        int total = _slots.Where(s => s.itemId == itemId).Sum(s => s.quantity);
        return total >= qty;
    }

    // ── Write API (ServerRpc — only owner can request) ────────────────────

    [ServerRpc(requireOwnership: true)]
    public void CmdAddItem(string itemId, int quantity = 1)
    {
        var data = _database.Get(itemId);
        if (data == null || quantity <= 0) return;

        int remaining = quantity;

        // Pass 1: fill existing stacks
        for (int i = 0; i < _slots.Count && remaining > 0; i++)
        {
            if (_slots[i].itemId != itemId) continue;
            int space = data.maxStackSize - _slots[i].quantity;
            if (space <= 0) continue;
            int add = Mathf.Min(space, remaining);
            _slots[i] = new InventoryItem { itemId = itemId, quantity = _slots[i].quantity + add };
            remaining -= add;
        }

        // Pass 2: fill empty slots
        for (int i = 0; i < _slots.Count && remaining > 0; i++)
        {
            if (!_slots[i].IsEmpty) continue;
            int add = Mathf.Min(data.maxStackSize, remaining);
            _slots[i] = new InventoryItem { itemId = itemId, quantity = add };
            remaining -= add;
        }

        // remaining > 0 means inventory is full — optionally notify caller
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdRemoveItem(string itemId, int quantity = 1)
    {
        if (quantity <= 0) return;
        int remaining = quantity;

        for (int i = _slots.Count - 1; i >= 0 && remaining > 0; i--)
        {
            if (_slots[i].itemId != itemId) continue;
            if (_slots[i].quantity <= remaining)
            {
                remaining -= _slots[i].quantity;
                _slots[i] = InventoryItem.Empty;
            }
            else
            {
                _slots[i] = new InventoryItem { itemId = itemId, quantity = _slots[i].quantity - remaining };
                remaining = 0;
            }
        }
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdMoveItem(int fromIndex, int toIndex)
    {
        if ((uint)fromIndex >= (uint)_slots.Count) return;
        if ((uint)toIndex   >= (uint)_slots.Count) return;

        var from = _slots[fromIndex];
        var to   = _slots[toIndex];

        // Try stack if same item
        if (!from.IsEmpty && from.itemId == to.itemId)
        {
            var data = _database.Get(from.itemId);
            if (data != null)
            {
                int total = from.quantity + to.quantity;
                _slots[toIndex]   = new InventoryItem { itemId = to.itemId,   quantity = Mathf.Min(total, data.maxStackSize) };
                _slots[fromIndex] = total > data.maxStackSize
                    ? new InventoryItem { itemId = from.itemId, quantity = total - data.maxStackSize }
                    : InventoryItem.Empty;
                return;
            }
        }

        // Otherwise swap
        _slots[fromIndex] = to;
        _slots[toIndex]   = from;
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdEquipItem(int slotIndex)
    {
        if ((uint)slotIndex >= (uint)_slots.Count) return;
        var item = _slots[slotIndex];
        if (item.IsEmpty) return;

        var data = _database.Get(item.itemId);
        if (data == null || !data.isEquippable || data.equipmentSlot == EquipmentSlotType.None) return;

        // Swap equipped <-> slot
        var currentEquipped = GetEquipped(data.equipmentSlot);
        _slots[slotIndex]             = currentEquipped;
        _equipped[data.equipmentSlot] = item;
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdSortInventory()
    {
        var sorted = _slots
            .Where(s => !s.IsEmpty)
            .OrderBy(s => s.itemId)
            .ThenByDescending(s => s.quantity)
            .ToList();

        for (int i = 0; i < _slots.Count; i++)
            _slots[i] = i < sorted.Count ? sorted[i] : InventoryItem.Empty;
    }
}`;

const inventorySlotUICode = `using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using TMPro;

public class InventorySlotUI : MonoBehaviour,
    IBeginDragHandler, IDragHandler, IEndDragHandler, IDropHandler, IPointerClickHandler
{
    [SerializeField] private Image           _iconImage;
    [SerializeField] private TextMeshProUGUI _quantityText;
    [SerializeField] private Image           _highlight;

    private PlayerInventory _inventory;
    private ItemDatabase    _database;
    private int             _slotIndex;

    private static InventorySlotUI _dragging;
    private static GameObject      _dragGhost; // spawned at cursor while dragging

    public void Setup(PlayerInventory inventory, ItemDatabase database, int index)
    {
        _inventory = inventory;
        _database  = database;
        _slotIndex = index;
    }

    public void Refresh(InventoryItem item)
    {
        bool empty = item.IsEmpty;
        _iconImage.enabled = !empty;
        if (!empty)
        {
            var data = _database.Get(item.itemId);
            _iconImage.sprite = data?.icon;
        }
        _quantityText.text = (!empty && item.quantity > 1) ? item.quantity.ToString() : "";
    }

    // ── Drag & Drop ───────────────────────────────────────────────────────

    public void OnBeginDrag(PointerEventData e)
    {
        _dragging = this;
        _iconImage.color = new Color(1, 1, 1, 0.4f); // dim slot
        // Optionally spawn a drag ghost here
    }

    public void OnDrag(PointerEventData e)
    {
        // Move ghost with cursor if you spawned one
    }

    public void OnEndDrag(PointerEventData e)
    {
        _iconImage.color = Color.white;
        _dragging = null;
    }

    public void OnDrop(PointerEventData e)
    {
        if (_dragging == null || _dragging == this) return;
        // Send move request to server
        _inventory.CmdMoveItem(_dragging._slotIndex, _slotIndex);
    }

    public void OnPointerClick(PointerEventData e)
    {
        if (e.button == PointerEventData.InputButton.Right)
            _inventory.CmdEquipItem(_slotIndex); // right-click to equip
    }
}`;

const inventoryUICode = `using UnityEngine;
using System.Collections.Generic;

public class InventoryUI : MonoBehaviour
{
    [SerializeField] private PlayerInventory              _inventory;
    [SerializeField] private ItemDatabase                 _database;
    [SerializeField] private InventorySlotUI              _slotPrefab;
    [SerializeField] private Transform                    _slotContainer;
    [SerializeField] private UnityEngine.UI.Button        _sortButton;

    private readonly List<InventorySlotUI> _slots = new();

    private void Start()
    {
        // Build slots
        var items = _inventory.GetInventory();
        for (int i = 0; i < items.Count; i++)
        {
            var slot = Instantiate(_slotPrefab, _slotContainer);
            slot.Setup(_inventory, _database, i);
            slot.Refresh(items[i]);
            _slots.Add(slot);
        }

        _inventory.onInventoryChanged += RefreshAll;
        _sortButton.onClick.AddListener(() => _inventory.CmdSortInventory());
    }

    private void OnDestroy()
    {
        if (_inventory != null)
            _inventory.onInventoryChanged -= RefreshAll;
    }

    private void RefreshAll()
    {
        var items = _inventory.GetInventory();
        for (int i = 0; i < _slots.Count; i++)
            _slots[i].Refresh(i < items.Count ? items[i] : InventoryItem.Empty);
    }
}`;

// ── Page component ────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Inventory System"
          description="A fully networked inventory system with item stacking, drag-and-drop slots, equipment, sorting, and a ScriptableObject item database. Uses SyncList and SyncDictionary for real-time sync across all clients."
          badge="Example"
          href="/docs/inventory-system"
        >
          {/* ── Overview ── */}
          <div className="prose">
            <h2>Overview — script responsibilities</h2>
            <p>
              This example is split into six focused scripts. Each script has exactly one job, which
              makes it easy to swap out or extend individual pieces without touching the rest of the
              system.
            </p>
            <ul>
              <li>
                <strong>ItemData</strong> — a ScriptableObject that holds all the static data for
                one item type: its ID, display name, icon, max stack size, and equipment slot.
              </li>
              <li>
                <strong>ItemDatabase</strong> — a ScriptableObject that owns every <code>ItemData</code>{" "}
                asset and provides fast string-key lookups at runtime.
              </li>
              <li>
                <strong>InventoryItem</strong> — a tiny network-serializable struct that represents
                one occupied slot: just an <code>itemId</code> string and a <code>quantity</code>.
              </li>
              <li>
                <strong>PlayerInventory</strong> — the <code>NetworkBehaviour</code> that owns the
                authoritative slot list. All mutations go through <code>[ServerRpc]</code> so the
                server is always in control.
              </li>
              <li>
                <strong>InventorySlotUI</strong> — one grid cell in the UI. Handles drag-and-drop
                events and fires RPC requests to <code>PlayerInventory</code>.
              </li>
              <li>
                <strong>InventoryUI</strong> — the panel controller. Instantiates all slot widgets
                on <code>Start</code> and re-renders them whenever <code>onInventoryChanged</code>{" "}
                fires.
              </li>
            </ul>
          </div>

          {/* ── Component Mind Map ── */}
          <div className="not-prose">
            <InventoryMindMap />
          </div>

          {/* ── Script 1: ItemData ── */}
          <div className="prose">
            <h2>Script 1 — ItemData (ScriptableObject)</h2>
            <p>
              <code>ItemData</code> is a pure data container. You create one asset per item type in
              the Unity Editor (right-click → PurrNet → Item Data) and fill in its fields. Because
              it is a <code>ScriptableObject</code> it lives in your project as an asset file, never
              travels over the network, and can be referenced by the database without duplicating
              data.
            </p>
            <p>
              The <code>itemId</code> field is the system&apos;s primary key. Every other script
              uses this string to look up item properties at runtime. Keep it short, lowercase, and
              unique — e.g. <code>&quot;sword_iron&quot;</code>, <code>&quot;potion_health&quot;</code>.
            </p>
          </div>

          <CodeBlock filename="ItemData.cs" language="csharp" code={itemDataCode} />

          {/* ── Script 2: ItemDatabase ── */}
          <div className="prose">
            <h2>Script 2 — ItemDatabase (ScriptableObject)</h2>
            <p>
              <code>ItemDatabase</code> is your item catalogue. Drag all <code>ItemData</code>{" "}
              assets into its <code>_items</code> array in the Inspector. On <code>OnEnable</code>{" "}
              it builds a fast <code>Dictionary&lt;string, ItemData&gt;</code> lookup so that{" "}
              <code>Get(itemId)</code> is O(1) — important when the server processes many add/remove
              operations per frame.
            </p>
            <p>
              Both <code>PlayerInventory</code> and the UI scripts hold a serialized reference to
              the same <code>ItemDatabase</code> asset. There is only ever one instance, so data
              is never out of sync between server and client (they both read from identical assets
              that ship with the game build).
            </p>
          </div>

          <CodeBlock filename="ItemDatabase.cs" language="csharp" code={itemDatabaseCode} />

          {/* ── Script 3: InventoryItem ── */}
          <div className="prose">
            <h2>Script 3 — InventoryItem (Network Struct)</h2>
            <p>
              <code>InventoryItem</code> is deliberately tiny. It stores only the string ID and the
              quantity — nothing else. This keeps the per-slot payload as small as possible when
              PurrNet serializes the <code>SyncList</code> delta. All display data (icon, name,
              description) is resolved locally by calling <code>ItemDatabase.Get(itemId)</code>.
            </p>
            <p>
              The <code>IPackedAuto</code> interface tells PurrNet&apos;s BitPacker to automatically
              generate an efficient serializer for this struct. The <code>IsEmpty</code> computed
              property is a convenience helper used throughout the other scripts to avoid null checks.
            </p>
          </div>

          <CodeBlock filename="InventoryItem.cs" language="csharp" code={inventoryItemCode} />

          {/* ── Script 4: PlayerInventory ── */}
          <div className="prose">
            <h2>Script 4 — PlayerInventory (Networked)</h2>
            <p>
              This is the heart of the system. It extends <code>NetworkBehaviour</code> and owns two
              networked collections: <code>SyncList&lt;InventoryItem&gt;</code> for the bag slots and{" "}
              <code>SyncDictionary&lt;EquipmentSlotType, InventoryItem&gt;</code> for the equipped
              items. PurrNet automatically replicates every change to all connected observers —
              you never write send/receive code manually.
            </p>
            <p>
              Every write method (<code>CmdAddItem</code>, <code>CmdRemoveItem</code>, etc.) is
              decorated with <code>[ServerRpc(requireOwnership: true)]</code>. This means the
              message is sent to the server, the server validates and applies the change, and the
              updated <code>SyncList</code> data flows back out to all observers. Clients can read
              the inventory freely but can never write to someone else&apos;s slots.
            </p>
          </div>

          <CodeBlock filename="PlayerInventory.cs" language="csharp" code={playerInventoryCode} />

          <Callout type="tip" title="Only the owner can modify their inventory">
            All write methods use <code>[ServerRpc(requireOwnership: true)]</code>. This means only
            the player who owns the inventory object can call AddItem, RemoveItem, etc. The server
            validates and applies every change.
          </Callout>

          <Callout type="tip" title="maxStackSize is enforced server-side">
            Clients cannot bypass the stack limit because all writes go through{" "}
            <code>[ServerRpc]</code>. The server reads <code>maxStackSize</code> from{" "}
            <code>ItemDatabase</code> and enforces it before any write completes.
          </Callout>

          <Callout type="warning" title="SyncDictionary callbacks have a third parameter">
            The <code>onChanged</code> callback on <code>SyncDictionary</code> includes a{" "}
            <code>SyncDictionaryChange</code> reason parameter. Ignore it with <code>_</code> if you
            just need to react to any change.
          </Callout>

          {/* ── Script 5: InventorySlotUI ── */}
          <div className="prose">
            <h2>Script 5 — InventorySlotUI (Drag &amp; Drop)</h2>
            <p>
              <code>InventorySlotUI</code> is a plain <code>MonoBehaviour</code> — it does not
              extend <code>NetworkBehaviour</code>. Its job is purely presentational: display the
              correct icon and quantity text, and translate UI drag-and-drop events into RPC calls on
              the local player&apos;s <code>PlayerInventory</code>.
            </p>
            <p>
              When the player drags one slot onto another, <code>OnDrop</code> fires and immediately
              calls <code>CmdMoveItem</code>. The server processes the swap and the{" "}
              <code>SyncList</code> update propagates back to all clients — including the dragging
              player — so the UI always reflects authoritative state rather than a client-side
              prediction.
            </p>
          </div>

          <CodeBlock
            filename="InventorySlotUI.cs"
            language="csharp"
            code={inventorySlotUICode}
          />

          <Callout type="warning" title="Always use itemId strings, never asset references">
            <code>InventoryItem</code> stores a string ID, not a reference to <code>ItemData</code>.
            This keeps the struct small and network-serializable. Always look up{" "}
            <code>ItemData</code> via <code>ItemDatabase.Get(itemId)</code> when you need the
            display data.
          </Callout>

          {/* ── Script 6: InventoryUI ── */}
          <div className="prose">
            <h2>Script 6 — InventoryUI (Panel Controller)</h2>
            <p>
              <code>InventoryUI</code> is the top-level panel manager. On <code>Start</code> it
              reads the slot count from <code>PlayerInventory.GetInventory()</code>, instantiates
              exactly that many <code>InventorySlotUI</code> prefabs, and positions them in the grid
              container.
            </p>
            <p>
              After setup it simply listens to <code>onInventoryChanged</code> and calls{" "}
              <code>RefreshAll()</code> whenever the list changes. Because PurrNet fires this event
              on every client automatically, the UI stays live across all machines with a single
              subscription.
            </p>
          </div>

          <CodeBlock filename="InventoryUI.cs" language="csharp" code={inventoryUICode} />

          {/* ── API Reference ── */}
          <div className="prose">
            <h2>API Reference</h2>
            <p>
              All public surface of <code>PlayerInventory</code> that you will call from UI scripts
              or game logic:
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          {/* ── Scene Setup ── */}
          <div className="prose">
            <h2>Scene Setup</h2>
          </div>

          <Callout type="info" title="Scene Setup">
            <ol className="list-decimal pl-4 space-y-1">
              <li>Create <code>ItemData</code> assets for each item (right-click → PurrNet → Item Data).</li>
              <li>Create an <code>ItemDatabase</code> asset and drag all <code>ItemData</code> assets into its <code>_items</code> array.</li>
              <li>Assign <code>ItemDatabase</code> to <code>PlayerInventory</code> in the Inspector.</li>
              <li>Assign <code>PlayerInventory</code> and <code>ItemDatabase</code> to <code>InventoryUI</code>.</li>
              <li>Register the player prefab in NetworkManager → Network Prefabs.</li>
            </ol>
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="ระบบ Inventory"
          description="ระบบ inventory แบบ network สมบูรณ์ พร้อม item stacking, drag-and-drop slots, equipment, การเรียงลำดับ และ ScriptableObject item database ใช้ SyncList และ SyncDictionary เพื่อ sync แบบ real-time ทั่ว clients ทั้งหมด"
          badge="Example"
          href="/docs/inventory-system"
        >
          {/* ── ภาพรวม ── */}
          <div className="prose">
            <h2>ภาพรวม — หน้าที่ของแต่ละ script</h2>
            <p>
              ตัวอย่างนี้แบ่งออกเป็น 6 scripts ที่มีหน้าที่เฉพาะ แต่ละ script มีงานเพียงอย่างเดียว
              ทำให้ง่ายต่อการสลับหรือขยายแต่ละส่วนโดยไม่กระทบส่วนอื่น
            </p>
            <ul>
              <li>
                <strong>ItemData</strong> — ScriptableObject ที่เก็บข้อมูล static ทั้งหมดสำหรับ item
                ประเภทหนึ่ง: ID, ชื่อที่แสดง, icon, จำนวน stack สูงสุด และ equipment slot
              </li>
              <li>
                <strong>ItemDatabase</strong> — ScriptableObject ที่เป็นเจ้าของ <code>ItemData</code>{" "}
                ทุก asset และให้การค้นหาด้วย string key ที่รวดเร็วในขณะ runtime
              </li>
              <li>
                <strong>InventoryItem</strong> — struct ขนาดเล็กที่ serialize ผ่าน network ได้ แทนหนึ่ง slot
                ที่มี item: เพียงแค่ string <code>itemId</code> และ <code>quantity</code>
              </li>
              <li>
                <strong>PlayerInventory</strong> — <code>NetworkBehaviour</code> ที่เป็นเจ้าของ slot list
                ที่เชื่อถือได้ การเปลี่ยนแปลงทั้งหมดผ่าน <code>[ServerRpc]</code> เพื่อให้ server
                ควบคุมเสมอ
              </li>
              <li>
                <strong>InventorySlotUI</strong> — หนึ่งช่องในกริด UI จัดการ drag-and-drop events
                และส่ง RPC requests ไปยัง <code>PlayerInventory</code>
              </li>
              <li>
                <strong>InventoryUI</strong> — ตัวควบคุม panel สร้าง slot widgets ทั้งหมดใน{" "}
                <code>Start</code> และ render ใหม่เมื่อ <code>onInventoryChanged</code> ทำงาน
              </li>
            </ul>
          </div>

          {/* ── Script 1: ItemData ── */}
          <div className="prose">
            <h2>Script 1 — ItemData (ScriptableObject)</h2>
            <p>
              <code>ItemData</code> เป็น container ข้อมูลล้วนๆ คุณสร้าง asset หนึ่งชิ้นต่อ item ประเภท
              ใน Unity Editor (คลิกขวา → PurrNet → Item Data) และกรอกข้อมูลในช่อง เพราะมันเป็น{" "}
              <code>ScriptableObject</code> มันจึงอยู่ใน project ของคุณเป็น asset file ไม่เคยเดินทาง
              ผ่าน network และสามารถ reference โดย database โดยไม่ต้องทำซ้ำข้อมูล
            </p>
            <p>
              ช่อง <code>itemId</code> คือ primary key ของระบบ ทุก script อื่นใช้ string นี้เพื่อค้นหา
              คุณสมบัติ item ใน runtime เก็บให้สั้น ตัวพิมพ์เล็ก และไม่ซ้ำกัน — เช่น{" "}
              <code>&quot;sword_iron&quot;</code>, <code>&quot;potion_health&quot;</code>
            </p>
          </div>

          <CodeBlock filename="ItemData.cs" language="csharp" code={itemDataCode} />

          {/* ── Script 2: ItemDatabase ── */}
          <div className="prose">
            <h2>Script 2 — ItemDatabase (ScriptableObject)</h2>
            <p>
              <code>ItemDatabase</code> คือแค็ตตาล็อก item ของคุณ ลาก <code>ItemData</code> assets
              ทั้งหมดเข้าไปใน array <code>_items</code> ใน Inspector ใน <code>OnEnable</code>
              จะสร้าง <code>Dictionary&lt;string, ItemData&gt;</code> สำหรับการค้นหาที่รวดเร็วเพื่อให้{" "}
              <code>Get(itemId)</code> เป็น O(1) — สำคัญเมื่อ server ประมวลผลการ add/remove หลายครั้งต่อ frame
            </p>
            <p>
              ทั้ง <code>PlayerInventory</code> และ UI scripts ถือ reference ที่ serialize ไปยัง{" "}
              <code>ItemDatabase</code> asset เดียวกัน มีแค่ instance เดียวเสมอ ดังนั้นข้อมูลจึงไม่
              เคย out of sync ระหว่าง server และ client (ทั้งคู่อ่านจาก assets ที่เหมือนกันที่มาพร้อม game build)
            </p>
          </div>

          <CodeBlock filename="ItemDatabase.cs" language="csharp" code={itemDatabaseCode} />

          {/* ── Script 3: InventoryItem ── */}
          <div className="prose">
            <h2>Script 3 — InventoryItem (Network Struct)</h2>
            <p>
              <code>InventoryItem</code> มีขนาดเล็กโดยตั้งใจ เก็บเพียง string ID และ quantity — ไม่มีอะไรอื่น
              ทำให้ payload ต่อ slot เล็กที่สุดเท่าที่จะเป็นไปได้เมื่อ PurrNet serialize delta ของ{" "}
              <code>SyncList</code> ข้อมูลการแสดงผลทั้งหมด (icon, ชื่อ, คำอธิบาย) แก้ไขในเครื่องโดยเรียก{" "}
              <code>ItemDatabase.Get(itemId)</code>
            </p>
            <p>
              interface <code>IPackedAuto</code> บอก BitPacker ของ PurrNet ให้สร้าง serializer ที่
              มีประสิทธิภาพสำหรับ struct นี้โดยอัตโนมัติ computed property <code>IsEmpty</code> เป็น
              helper สะดวกที่ใช้ทั่ว scripts อื่นเพื่อหลีกเลี่ยง null checks
            </p>
          </div>

          <CodeBlock filename="InventoryItem.cs" language="csharp" code={inventoryItemCode} />

          {/* ── Script 4: PlayerInventory ── */}
          <div className="prose">
            <h2>Script 4 — PlayerInventory (ระบบ Network)</h2>
            <p>
              นี่คือหัวใจของระบบ มันขยาย <code>NetworkBehaviour</code> และเป็นเจ้าของ collections ที่
              networked สองชุด: <code>SyncList&lt;InventoryItem&gt;</code> สำหรับ bag slots และ{" "}
              <code>SyncDictionary&lt;EquipmentSlotType, InventoryItem&gt;</code> สำหรับ items ที่
              equipped PurrNet จะ replicate การเปลี่ยนแปลงทุกอย่างไปยัง observers ที่เชื่อมต่อทั้งหมด
              โดยอัตโนมัติ — คุณไม่ต้องเขียนโค้ด send/receive ด้วยตนเอง
            </p>
            <p>
              ทุก write method (<code>CmdAddItem</code>, <code>CmdRemoveItem</code> ฯลฯ) ตกแต่งด้วย{" "}
              <code>[ServerRpc(requireOwnership: true)]</code> ซึ่งหมายความว่า message ถูกส่งไปยัง server,
              server ตรวจสอบและใช้การเปลี่ยนแปลง และข้อมูล <code>SyncList</code> ที่อัปเดตแล้วไหลกลับออกไปยัง
              observers ทั้งหมด Clients สามารถอ่าน inventory ได้อย่างอิสระแต่ไม่สามารถเขียนไปยัง slots
              ของคนอื่นได้
            </p>
          </div>

          <CodeBlock filename="PlayerInventory.cs" language="csharp" code={playerInventoryCode} />

          <Callout type="tip" title="เฉพาะเจ้าของเท่านั้นที่สามารถแก้ไข inventory ของตัวเอง">
            method การเขียนทั้งหมดใช้ <code>[ServerRpc(requireOwnership: true)]</code> ซึ่งหมายความว่า
            เฉพาะผู้เล่นที่เป็นเจ้าของ inventory object เท่านั้นที่สามารถเรียก AddItem, RemoveItem ฯลฯ
            Server ตรวจสอบและใช้การเปลี่ยนแปลงทุกอย่าง
          </Callout>

          <Callout type="tip" title="maxStackSize ถูกบังคับฝั่ง server">
            Clients ไม่สามารถข้ามขีดจำกัด stack ได้เพราะการเขียนทั้งหมดผ่าน <code>[ServerRpc]</code>{" "}
            Server อ่าน <code>maxStackSize</code> จาก <code>ItemDatabase</code> และบังคับก่อนที่การเขียนใดๆ
            จะสำเร็จ
          </Callout>

          <Callout type="warning" title="SyncDictionary callbacks มีพารามิเตอร์ที่สาม">
            callback <code>onChanged</code> บน <code>SyncDictionary</code> มีพารามิเตอร์เหตุผล{" "}
            <code>SyncDictionaryChange</code> ใช้ <code>_</code> เพื่อเพิกเฉยหากต้องการตอบสนองต่อ
            การเปลี่ยนแปลงใดๆ
          </Callout>

          {/* ── Script 5: InventorySlotUI ── */}
          <div className="prose">
            <h2>Script 5 — InventorySlotUI (Drag &amp; Drop)</h2>
            <p>
              <code>InventorySlotUI</code> เป็น <code>MonoBehaviour</code> ธรรมดา — ไม่ขยาย{" "}
              <code>NetworkBehaviour</code> งานของมันเป็นการนำเสนอล้วนๆ: แสดง icon และ quantity text
              ที่ถูกต้อง และแปล drag-and-drop events ของ UI เป็น RPC calls บน{" "}
              <code>PlayerInventory</code> ของผู้เล่นในเครื่อง
            </p>
            <p>
              เมื่อผู้เล่นลาก slot หนึ่งไปวางบนอีก slot <code>OnDrop</code> จะทำงานและเรียก{" "}
              <code>CmdMoveItem</code> ทันที Server ประมวลผลการสลับและการอัปเดต <code>SyncList</code>{" "}
              กระจายกลับไปยัง clients ทั้งหมด — รวมถึงผู้เล่นที่กำลัง drag — ดังนั้น UI จึงสะท้อนสถานะ
              ที่เชื่อถือได้เสมอแทนที่จะเป็น client-side prediction
            </p>
          </div>

          <CodeBlock
            filename="InventorySlotUI.cs"
            language="csharp"
            code={inventorySlotUICode}
          />

          <Callout type="warning" title="ใช้ itemId strings เสมอ ไม่ใช่ asset references">
            <code>InventoryItem</code> เก็บ string ID ไม่ใช่ reference ไปยัง <code>ItemData</code>{" "}
            ทำให้ struct มีขนาดเล็กและ network-serializable เสมอ ค้นหา <code>ItemData</code> ผ่าน{" "}
            <code>ItemDatabase.Get(itemId)</code> เมื่อต้องการข้อมูลการแสดงผล
          </Callout>

          {/* ── Script 6: InventoryUI ── */}
          <div className="prose">
            <h2>Script 6 — InventoryUI (ตัวควบคุม Panel)</h2>
            <p>
              <code>InventoryUI</code> คือตัวจัดการ panel ระดับบนสุด ใน <code>Start</code> มันอ่าน
              จำนวน slot จาก <code>PlayerInventory.GetInventory()</code>, สร้าง{" "}
              <code>InventorySlotUI</code> prefabs จำนวนเท่านั้น และจัดวางใน grid container
            </p>
            <p>
              หลังตั้งค่าแล้ว มันแค่ฟัง <code>onInventoryChanged</code> และเรียก <code>RefreshAll()</code>{" "}
              เมื่อ list เปลี่ยนแปลง เพราะ PurrNet ยิง event นี้บน client ทุกตัวโดยอัตโนมัติ UI จึงมีชีวิต
              ชีวาบนทุกเครื่องด้วย subscription เดียว
            </p>
          </div>

          <CodeBlock filename="InventoryUI.cs" language="csharp" code={inventoryUICode} />

          {/* ── อ้างอิง API ── */}
          <div className="prose">
            <h2>อ้างอิง API</h2>
            <p>
              surface สาธารณะทั้งหมดของ <code>PlayerInventory</code> ที่คุณจะเรียกจาก UI scripts
              หรือ game logic:
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsTH} />
          </div>

          {/* ── การตั้งค่า Scene ── */}
          <div className="prose">
            <h2>การตั้งค่า Scene</h2>
          </div>

          <Callout type="info" title="การตั้งค่า Scene">
            <ol className="list-decimal pl-4 space-y-1">
              <li>สร้าง <code>ItemData</code> assets สำหรับแต่ละ item (คลิกขวา → PurrNet → Item Data)</li>
              <li>สร้าง <code>ItemDatabase</code> asset และลาก <code>ItemData</code> assets ทั้งหมดเข้าไปใน array <code>_items</code></li>
              <li>กำหนด <code>ItemDatabase</code> ให้ <code>PlayerInventory</code> ใน Inspector</li>
              <li>กำหนด <code>PlayerInventory</code> และ <code>ItemDatabase</code> ให้ <code>InventoryUI</code></li>
              <li>ลงทะเบียน player prefab ใน NetworkManager → Network Prefabs</li>
            </ol>
          </Callout>
        </DocPage>
      }
    />
  );
}
