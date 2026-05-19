import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { GridCraftingViz } from "@/components/visualizers/GridCraftingViz";

export const metadata = { title: "Grid Survival Crafting" };

const apiParamsEN = [
  { name: "SyncDictionary<Vector2Int, int>", type: "SyncDictionary", description: "The world grid. Key = grid position, value = item ID. Automatically replicated to all peers on change. Late-joining clients receive the full current state on connect." },
  { name: "PlaceItemServerRpc(Vector2Int[] cells, int itemId)", type: "ServerRpc", description: "Client sends the cells it wants to fill and the item ID. Server validates all cells are empty and within bounds before writing to the SyncDictionary." },
  { name: "RemoveItemServerRpc(Vector2Int anchor)", type: "ServerRpc", description: "Client sends the anchor cell. Server finds all cells the item occupies (via item size), removes them all atomically." },
  { name: "OnPlayerJoined(PlayerID)", type: "override", description: "Server checks the player's ID against _playerSaves. Returning players load their inventory and progress; new players receive an empty inventory and start fresh." },
  { name: "OnPlayerLeft(PlayerID)", type: "override", description: "Server saves the leaving player's inventory and progress to the in-memory dictionary before their object is despawned." },
];

const apiParamsTH = [
  { name: "SyncDictionary<Vector2Int, int>", type: "SyncDictionary", description: "World grid Key = ตำแหน่ง grid, value = item ID replicate ไปยังทุก peer โดยอัตโนมัติเมื่อเปลี่ยน client ที่ join ช้าจะได้รับ state ปัจจุบันทั้งหมดเมื่อเชื่อมต่อ" },
  { name: "PlaceItemServerRpc(Vector2Int[] cells, int itemId)", type: "ServerRpc", description: "Client ส่ง cells ที่ต้องการเติมและ item ID Server validate ว่าทุก cell ว่างและอยู่ในขอบเขตก่อนเขียนลง SyncDictionary" },
  { name: "RemoveItemServerRpc(Vector2Int anchor)", type: "ServerRpc", description: "Client ส่ง anchor cell Server หา cells ทั้งหมดที่ item ครอบครอง (ผ่านขนาด item) และลบทั้งหมดในครั้งเดียว" },
  { name: "OnPlayerJoined(PlayerID)", type: "override", description: "Server ตรวจสอบ ID ของ player กับ _playerSaves ผู้เล่นที่กลับมาโหลด inventory และ progress ผู้เล่นใหม่ได้รับ inventory ว่างและเริ่มต้นใหม่" },
  { name: "OnPlayerLeft(PlayerID)", type: "override", description: "Server บันทึก inventory และ progress ของ player ที่กำลังจะออกลงใน dictionary ก่อนที่ object ของพวกเขาจะถูก despawn" },
];

const gridWorldCode = `using System;
using System.Collections.Generic;
using PurrNet;
using UnityEngine;

[Serializable]
public class PlayerWorldData
{
    public List<InventoryItem> inventory = new();
    public Vector3             spawnPosition;
    public float               health = 100f;
}

[Serializable]
public class InventoryItem { public int itemId; public int count; }

/// <summary>
/// Host-authoritative world grid. Shared across all players.
/// Each player has individual progress saved per PlayerID.
/// </summary>
public class NetworkWorldGrid : NetworkBehaviour
{
    [Header("Grid Size")]
    [SerializeField] private int _cols = 16;
    [SerializeField] private int _rows = 16;

    [Header("Item Database")]
    [SerializeField] private ItemDatabase _itemDb;

    // ── Shared world state (all peers mirror this) ────────────────────────────

    /// <summary>Key = grid cell position, Value = item prefab ID.</summary>
    private SyncDictionary<Vector2Int, int> _worldGrid = new();

    // ── Per-player saves (host memory only) ───────────────────────────────────

    private readonly Dictionary<string, PlayerWorldData> _playerSaves = new();

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override void OnSpawned()
    {
        _worldGrid.onAdded   += (pos, id) => WorldRenderer.PlaceItem(pos, id);
        _worldGrid.onRemoved += (pos, _)  => WorldRenderer.RemoveItem(pos);
    }

    protected override void OnPlayerJoined(PlayerID id)
    {
        string key = id.ToString();
        if (_playerSaves.TryGetValue(key, out PlayerWorldData save))
        {
            // Returning player — restore their progress
            RpcLoadPlayerProgress(id, save);
        }
        else
        {
            // New player — create fresh save
            _playerSaves[key] = new PlayerWorldData
            {
                spawnPosition = FindSpawnPoint(),
            };
            RpcNotifyNewPlayer(id);
        }
    }

    protected override void OnPlayerLeft(PlayerID id)
    {
        // Snapshot must happen before the player object is despawned
        SavePlayerProgress(id);
    }

    // ── Server-side placement ─────────────────────────────────────────────────

    /// <summary>
    /// Validate and place a multi-cell item.
    /// cells[0] is the anchor — must be same order as the client's preview.
    /// </summary>
    [ServerRpc]
    public void PlaceItemServerRpc(Vector2Int[] cells, int itemId)
    {
        if (!_itemDb.TryGet(itemId, out ItemData item)) return;
        if (cells.Length != item.width * item.height)    return;

        foreach (var cell in cells)
        {
            if (cell.x < 0 || cell.x >= _cols || cell.y < 0 || cell.y >= _rows) return;
            if (_worldGrid.ContainsKey(cell)) return;
        }

        foreach (var cell in cells) _worldGrid[cell] = itemId;
    }

    /// <summary>Remove a multi-cell item by its anchor cell.</summary>
    [ServerRpc]
    public void RemoveItemServerRpc(Vector2Int anchor)
    {
        if (!_worldGrid.TryGetValue(anchor, out int itemId)) return;
        if (!_itemDb.TryGet(itemId, out ItemData item))      return;

        for (int dx = 0; dx < item.width; dx++)
        for (int dy = 0; dy < item.height; dy++)
            _worldGrid.Remove(new Vector2Int(anchor.x + dx, anchor.y + dy));
    }

    // ── Progress save / load ──────────────────────────────────────────────────

    [Server]
    private void SavePlayerProgress(PlayerID id)
    {
        if (!OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p)) return;

        _playerSaves[id.ToString()] = new PlayerWorldData
        {
            inventory     = p.GetInventorySnapshot(),
            spawnPosition = p.transform.position,
            health        = p.health,
        };
    }

    [TargetRpc]
    private void RpcLoadPlayerProgress(PlayerID target, PlayerWorldData data)
    {
        PlayerProgressLoader.Apply(data);
        UIManager.ShowMessage("Welcome back! Your progress has been restored.");
    }

    [TargetRpc]
    private void RpcNotifyNewPlayer(PlayerID target)
    {
        UIManager.ShowMessage("New world — start gathering resources!");
    }

    private Vector3 FindSpawnPoint() => Vector3.zero; // replace with your spawn logic
}`;

const furniturePlacerCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// Client-side placement preview + commit.
/// Reads from ItemDatabase to know multi-cell footprint before sending to server.
/// </summary>
public class FurniturePlacer : NetworkBehaviour
{
    [SerializeField] private NetworkWorldGrid _grid;
    [SerializeField] private ItemDatabase     _itemDb;
    [SerializeField] private GameObject       _previewPrefab;

    private int         _selectedItemId = -1;
    private GameObject  _preview;

    public void SelectItem(int itemId)
    {
        _selectedItemId = itemId;
        if (_preview != null) Destroy(_preview);
        if (_itemDb.TryGet(itemId, out ItemData item))
            _preview = Instantiate(_previewPrefab);
    }

    private void Update()
    {
        if (!isOwner || _selectedItemId < 0 || _preview == null) return;

        // Raycast to find hovered grid cell
        if (!TryGetHoveredCell(out Vector2Int anchor)) return;

        // Move preview to anchor
        _preview.transform.position = GridToWorld(anchor);

        // Show valid / invalid tint
        bool valid = CanPlace(anchor);
        _preview.GetComponent<Renderer>().material.color = valid ? Color.green : Color.red;

        if (Input.GetMouseButtonDown(0) && valid)
            CommitPlacement(anchor);
    }

    private void CommitPlacement(Vector2Int anchor)
    {
        if (!_itemDb.TryGet(_selectedItemId, out ItemData item)) return;

        // Build cell list matching the item footprint
        var cells = new Vector2Int[item.width * item.height];
        int idx = 0;
        for (int dy = 0; dy < item.height; dy++)
        for (int dx = 0; dx < item.width;  dx++)
            cells[idx++] = new Vector2Int(anchor.x + dx, anchor.y + dy);

        _grid.PlaceItemServerRpc(cells, _selectedItemId);
    }

    private bool CanPlace(Vector2Int anchor)
    {
        // Preview validity — server will re-validate
        if (!_itemDb.TryGet(_selectedItemId, out ItemData item)) return false;
        for (int dx = 0; dx < item.width;  dx++)
        for (int dy = 0; dy < item.height; dy++)
        {
            var cell = new Vector2Int(anchor.x + dx, anchor.y + dy);
            if (_grid.IsCellOccupied(cell)) return false;
        }
        return true;
    }

    private bool TryGetHoveredCell(out Vector2Int cell) { cell = default; return false; } // implement with Physics.Raycast
    private Vector3 GridToWorld(Vector2Int cell) => new Vector3(cell.x, 0, cell.y);
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Grid Survival Crafting"
          description="A host-world grid crafting system for PurrNet. The shared world grid is stored as a SyncDictionary so all peers instantly see placements. Multi-cell furniture (sofa, workbench) occupies multiple grid cells validated server-side. Each player has individual progress — returning players resume where they left off; new players start fresh."
          badge="Example"
          href="/docs/grid-survival-crafting"
        >
          <GridCraftingViz />

          <div className="prose">
            <h2>Architecture: shared world, individual progress</h2>
            <p>
              The grid world has two layers of data:
            </p>
            <ul>
              <li><strong>Shared world</strong> — the <code>SyncDictionary&lt;Vector2Int, int&gt;</code> that all peers see. Every placement or removal is authoritative server-side and instantly replicated.</li>
              <li><strong>Individual progress</strong> — each player&apos;s inventory, health, and position. Stored server-side in a plain <code>Dictionary&lt;string, PlayerWorldData&gt;</code> (not synced — no one needs to see another player&apos;s save). Restored via <code>TargetRpc</code> when that player joins.</li>
            </ul>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsEN} /></div>

          <div className="prose"><h2>World grid + per-player saves</h2></div>
          <CodeBlock filename="NetworkWorldGrid.cs" language="csharp" code={gridWorldCode} />

          <div className="prose"><h2>Client-side placement preview</h2></div>
          <CodeBlock filename="FurniturePlacer.cs" language="csharp" code={furniturePlacerCode} />

          <Callout type="tip" title="SyncDictionary handles late joiners automatically">
            A player who joins mid-session receives the full current <code>_worldGrid</code> snapshot
            on connect — every placed item appears instantly without any extra logic. The{" "}
            <code>onAdded</code> callback fires for each entry so the renderer reacts the same way
            it would for a real-time placement.
          </Callout>
          <Callout type="warning" title="Always validate placement server-side">
            The client sends the cells it wants to fill, but the server re-validates every cell
            before writing. This prevents a modified client from placing items on occupied cells,
            outside the world boundary, or without paying the item cost.
          </Callout>
          <Callout type="info" title="Persisting across server restarts">
            <code>_playerSaves</code> and the world grid live in memory — they are lost if the host
            closes the game. For persistent worlds, serialize <code>_playerSaves</code> and the
            grid to disk (JSON, SQLite, etc.) in <code>OnApplicationQuit</code> and reload on{" "}
            <code>Awake</code>.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Grid Survival Crafting"
          description="ระบบ crafting บน grid แบบ host-world สำหรับ PurrNet world grid ที่ใช้ร่วมกันถูกเก็บเป็น SyncDictionary เพื่อให้ peer ทุกคนเห็นการวางไว้ทันที เฟอร์นิเจอร์หลาย cell (โซฟา, โต๊ะทำงาน) ครอบครองหลาย grid cells ที่ validate ฝั่ง server ผู้เล่นแต่ละคนมี progress ส่วนตัว"
          badge="Example"
          href="/docs/grid-survival-crafting"
        >
          <GridCraftingViz />
          <div className="prose">
            <h2>สถาปัตยกรรม: world ร่วมกัน, progress ส่วนตัว</h2>
            <p>Grid world มีข้อมูลสองชั้น: <strong>World ร่วมกัน</strong> — <code>SyncDictionary&lt;Vector2Int, int&gt;</code> ที่ peer ทุกคนเห็น และ <strong>Progress ส่วนตัว</strong> — inventory, health และตำแหน่งของแต่ละ player เก็บฝั่ง server</p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>
          <div className="prose"><h2>World grid + saves ต่อ player</h2></div>
          <CodeBlock filename="NetworkWorldGrid.cs" language="csharp" code={gridWorldCode} />
          <div className="prose"><h2>Preview การวางฝั่ง client</h2></div>
          <CodeBlock filename="FurniturePlacer.cs" language="csharp" code={furniturePlacerCode} />
          <Callout type="tip" title="SyncDictionary จัดการ late joiners โดยอัตโนมัติ">Player ที่ join กลางเซสชั่นจะได้รับ snapshot <code>_worldGrid</code> ปัจจุบันทั้งหมดเมื่อเชื่อมต่อ — ทุก item ที่วางไว้ปรากฏทันทีโดยไม่ต้องมี logic เพิ่มเติม</Callout>
          <Callout type="warning" title="Validate การวางฝั่ง server เสมอ">Client ส่ง cells ที่ต้องการเติม แต่ server validate ทุก cell ก่อนเขียน วิธีนี้ป้องกัน client ที่ถูกแก้ไขจากการวาง items บน cells ที่มีอยู่แล้วหรือนอกขอบเขต world</Callout>
          <Callout type="info" title="การ persist ข้าม server restarts"><code>_playerSaves</code> และ world grid อยู่ใน memory — จะหายไปถ้า host ปิดเกม สำหรับ worlds ที่ต้องการความถาวร ให้ serialize ลงดิสก์ใน <code>OnApplicationQuit</code></Callout>
        </DocPage>
      }
    />
  );
}
