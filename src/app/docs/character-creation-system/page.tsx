import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { CharacterCreationViz } from "@/components/visualizers/CharacterCreationViz";

export const metadata = { title: "Character Creation System" };

const apiParamsEN = [
  { name: "CheckSaveServerRpc(string playerId)", type: "ServerRpc", description: "Client sends its persistent ID (Steam ID, device ID, etc.). Server checks the in-memory database and responds via TargetRpc with either a saved character or a flag to show the creation screen." },
  { name: "CreateCharacterServerRpc(CharacterData data)", type: "ServerRpc", description: "New player sends their chosen character. Server validates uniqueness, stores it, and sends the character back via TargetRpc to confirm." },
  { name: "RpcShowCreationScreen(PlayerID)", type: "TargetRpc", description: "Server tells only the new player to display the character creation UI. Other players are unaffected." },
  { name: "RpcLoadCharacter(PlayerID, CharacterData)", type: "TargetRpc", description: "Server sends the returning player's stored character. The client applies it locally and enters the game." },
  { name: "_database (Dictionary<string, CharacterData>)", type: "Server-only", description: "Host-side dictionary mapping persistent player ID → CharacterData. Never synced — no other player needs another player's creation data." },
];

const apiParamsTH = [
  { name: "CheckSaveServerRpc(string playerId)", type: "ServerRpc", description: "Client ส่ง persistent ID ของตน (Steam ID, device ID ฯลฯ) Server ตรวจสอบ database ใน memory และตอบกลับผ่าน TargetRpc พร้อม character ที่บันทึกไว้หรือ flag เพื่อแสดง creation screen" },
  { name: "CreateCharacterServerRpc(CharacterData data)", type: "ServerRpc", description: "ผู้เล่นใหม่ส่ง character ที่เลือก Server validate ความ unique เก็บไว้ และส่ง character กลับผ่าน TargetRpc เพื่อยืนยัน" },
  { name: "RpcShowCreationScreen(PlayerID)", type: "TargetRpc", description: "Server บอกเฉพาะผู้เล่นใหม่ให้แสดง UI การสร้าง character ผู้เล่นคนอื่นไม่ได้รับผลกระทบ" },
  { name: "RpcLoadCharacter(PlayerID, CharacterData)", type: "TargetRpc", description: "Server ส่ง character ที่บันทึกไว้ของผู้เล่นที่กลับมา Client apply มัน local และเข้าสู่เกม" },
  { name: "_database (Dictionary<string, CharacterData>)", type: "Server-only", description: "Dictionary ฝั่ง host ที่ map persistent player ID → CharacterData ไม่ sync เลย — ไม่มีผู้เล่นคนอื่นที่ต้องการข้อมูลการสร้าง character ของผู้เล่นอื่น" },
];

const characterDataCode = `using System;
using PurrNet;
using UnityEngine;

public enum CharacterClass { Warrior, Mage, Archer, Rogue }

[Serializable]
[RegisterNetworkType(typeof(CharacterData))]
public struct CharacterData : IPackedAuto
{
    public string         name;
    public CharacterClass charClass;
    public int            level;
    public float          health;
    public int            xp;
    public int            gold;
}

[Serializable]
public class SavedCharacter
{
    public CharacterData data;
    public DateTime      createdAt;
    public DateTime      lastSeen;
    public int           sessionsPlayed;
}`;

const managerCode = `using System;
using System.Collections.Generic;
using PurrNet;
using UnityEngine;

/// <summary>
/// Host-authoritative character creation and save system.
/// Attach to a DontDestroyOnLoad NetworkBehaviour on the host.
/// </summary>
public class NetworkCharacterManager : NetworkBehaviour
{
    // ── Host-only database ────────────────────────────────────────────────────

    // Key = persistent player identifier (Steam ID, GUID, etc.)
    private readonly Dictionary<string, SavedCharacter> _database = new();

    // ── Step 1: client connects and checks for an existing save ──────────────

    protected override void OnPlayerJoined(PlayerID id)
    {
        // Give the client a moment to initialize before asking
        // (alternatively, let the client call CheckSaveServerRpc from their own OnSpawned)
    }

    /// <summary>Client calls this from OnSpawned to find out if they have a save.</summary>
    [ServerRpc]
    public void CheckSaveServerRpc(string persistentId)
    {
        if (_database.TryGetValue(persistentId, out SavedCharacter saved))
        {
            saved.lastSeen = DateTime.UtcNow;
            saved.sessionsPlayed++;
            _database[persistentId] = saved;

            // Returning player — load their character
            RpcLoadCharacter(networkManager.GetCaller(), saved.data);
        }
        else
        {
            // New player — ask them to create a character
            RpcShowCreationScreen(networkManager.GetCaller());
        }
    }

    // ── Step 2a: new player creates a character ───────────────────────────────

    [ServerRpc]
    public void CreateCharacterServerRpc(string persistentId, CharacterData data)
    {
        // Validate: no duplicate names (optional rule)
        foreach (var save in _database.Values)
        {
            if (string.Equals(save.data.name, data.name, StringComparison.OrdinalIgnoreCase))
            {
                RpcNameTaken(networkManager.GetCaller());
                return;
            }
        }

        // Store the new character
        var newSave = new SavedCharacter
        {
            data           = data,
            createdAt      = DateTime.UtcNow,
            lastSeen       = DateTime.UtcNow,
            sessionsPlayed = 1,
        };
        _database[persistentId] = newSave;

        // Confirm and load the character on the creator's machine
        RpcLoadCharacter(networkManager.GetCaller(), data);
    }

    // ── Step 2b: returning player receives their saved character ──────────────

    /// <summary>Server → only this client: show creation UI.</summary>
    [TargetRpc]
    private void RpcShowCreationScreen(PlayerID target)
    {
        CharacterCreationUI.Show(OnCreateConfirmed);
    }

    /// <summary>Server → only this client: load the saved character and enter game.</summary>
    [TargetRpc]
    private void RpcLoadCharacter(PlayerID target, CharacterData data)
    {
        CharacterCreationUI.Hide();
        LocalCharacterStore.Apply(data);    // writes to local PlayerPrefs as cache
        GameSceneLoader.LoadGameScene();
    }

    [TargetRpc]
    private void RpcNameTaken(PlayerID target)
        => CharacterCreationUI.ShowError("That name is already taken — choose another.");

    // ── Persistence ───────────────────────────────────────────────────────────

    protected override void OnPlayerLeft(PlayerID id)
    {
        // Snapshot the leaving player's current character state
        if (OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p))
        {
            string key = p.persistentId;  // stored when player first joined
            if (_database.TryGetValue(key, out SavedCharacter save))
            {
                save.data     = p.GetCharacterSnapshot();
                save.lastSeen = DateTime.UtcNow;
                _database[key] = save;
            }
        }
    }

    /// <summary>
    /// Serialize the database to disk so it survives host restarts.
    /// Call from OnApplicationQuit and after any significant change.
    /// </summary>
    [Server]
    public void SaveDatabaseToDisk()
    {
        var wrapper = new DatabaseWrapper { records = new List<DatabaseEntry>() };
        foreach (var kv in _database)
            wrapper.records.Add(new DatabaseEntry { id = kv.Key, save = kv.Value });

        string json = JsonUtility.ToJson(wrapper, prettyPrint: true);
        System.IO.File.WriteAllText(Application.persistentDataPath + "/characters.json", json);
        Debug.Log($"[CharacterDB] Saved {_database.Count} records.");
    }

    [Server]
    public void LoadDatabaseFromDisk()
    {
        string path = Application.persistentDataPath + "/characters.json";
        if (!System.IO.File.Exists(path)) return;

        var wrapper = JsonUtility.FromJson<DatabaseWrapper>(System.IO.File.ReadAllText(path));
        _database.Clear();
        foreach (var entry in wrapper.records) _database[entry.id] = entry.save;
        Debug.Log($"[CharacterDB] Loaded {_database.Count} records.");
    }

    // ── Callback from creation UI (owner client) ──────────────────────────────

    private void OnCreateConfirmed(CharacterData data)
    {
        string persistentId = GetPersistentId();   // Steam ID, GUID, etc.
        CreateCharacterServerRpc(persistentId, data);
    }

    private static string GetPersistentId()
    {
        // Use Steam ID if available, otherwise fall back to a device GUID
        if (SteamInitializer.IsInitialized)
            return SteamInitializer.LocalSteamId.ToString();

        if (!PlayerPrefs.HasKey("DeviceId"))
            PlayerPrefs.SetString("DeviceId", Guid.NewGuid().ToString());
        return PlayerPrefs.GetString("DeviceId");
    }

    // ── Inner types for JSON serialization ────────────────────────────────────

    [Serializable] private class DatabaseWrapper  { public List<DatabaseEntry> records; }
    [Serializable] private class DatabaseEntry    { public string id; public SavedCharacter save; }
}`;

const clientBootCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// On the local client's player object — calls CheckSaveServerRpc
/// immediately after spawning so the host can determine new vs. returning.
/// </summary>
public class OnlinePlayer : PlayerIdentity<OnlinePlayer>
{
    public string persistentId { get; private set; }

    protected override void OnSpawned()
    {
        if (!isLocalPlayer) return;

        persistentId = NetworkCharacterManager.GetPersistentId();  // same helper as manager

        // Ask the host whether we have a save
        var manager = FindObjectOfType<NetworkCharacterManager>();
        if (manager != null) manager.CheckSaveServerRpc(persistentId);
    }

    public CharacterData GetCharacterSnapshot() => LocalCharacterStore.Current;
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Character Creation System"
          description="A host-based character creation and persistence system for PurrNet. The host stores all player saves in a server-side dictionary. When a player joins: if the host recognises their persistent ID (Steam, GUID) they load their saved character; if not, they create a new one. Progress is saved whenever a player leaves."
          badge="Example"
          href="/docs/character-creation-system"
        >
          <CharacterCreationViz />

          <div className="prose">
            <h2>How it works: new vs returning player</h2>
            <ol>
              <li>Player connects → their <code>OnlinePlayer.OnSpawned</code> fires → calls <code>CheckSaveServerRpc(persistentId)</code>.</li>
              <li>Host checks its in-memory <code>_database</code>.</li>
              <li><strong>Returning player</strong>: host calls <code>RpcLoadCharacter(target, savedData)</code> → client enters game with their character.</li>
              <li><strong>New player</strong>: host calls <code>RpcShowCreationScreen(target)</code> → client fills in the UI → calls <code>CreateCharacterServerRpc</code> → host stores it → client enters game.</li>
              <li>On disconnect: host snapshots the character from the player object and updates the record.</li>
            </ol>
            <p>
              The database is <strong>never synced</strong> to other clients — it lives only on the
              host. Each player receives only their own data via <code>TargetRpc</code>.
            </p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsEN} /></div>

          <div className="prose"><h2>CharacterData struct</h2></div>
          <CodeBlock filename="CharacterData.cs" language="csharp" code={characterDataCode} />

          <div className="prose"><h2>NetworkCharacterManager — host database</h2></div>
          <CodeBlock filename="NetworkCharacterManager.cs" language="csharp" code={managerCode} />

          <div className="prose"><h2>OnlinePlayer — client boot</h2></div>
          <CodeBlock filename="OnlinePlayer.cs" language="csharp" code={clientBootCode} />

          <Callout type="tip" title="Use a persistent ID, not PlayerID">
            <code>PlayerID</code> changes each session. Use Steam ID, a GUID stored in
            PlayerPrefs, or an account token as the dictionary key so you can match the same
            physical player across sessions even if they reconnect with a different{" "}
            <code>PlayerID</code>.
          </Callout>
          <Callout type="warning" title="Validate character data on the server">
            A client could send a crafted <code>CharacterData</code> with max stats. Validate max
            values, name length, and allowed class IDs inside <code>CreateCharacterServerRpc</code>{" "}
            before storing. Never trust client-supplied data at face value.
          </Callout>
          <Callout type="info" title="SaveDatabaseToDisk for persistent worlds">
            In-memory saves are lost when the host exits. Call{" "}
            <code>SaveDatabaseToDisk()</code> in <code>OnApplicationQuit</code> and{" "}
            <code>LoadDatabaseFromDisk()</code> in <code>Awake</code> to persist characters across
            host restarts.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Character Creation System"
          description="ระบบ character creation และ persistence แบบ host-based สำหรับ PurrNet host เก็บ saves ของ player ทั้งหมดใน server-side dictionary เมื่อ player join: ถ้า host รู้จัก persistent ID ของพวกเขา (Steam, GUID) พวกเขาจะโหลด character ที่บันทึกไว้; ถ้าไม่ พวกเขาจะสร้างใหม่"
          badge="Example"
          href="/docs/character-creation-system"
        >
          <CharacterCreationViz />
          <div className="prose">
            <h2>วิธีการทำงาน: new vs returning player</h2>
            <ol>
              <li>Player เชื่อมต่อ → <code>OnlinePlayer.OnSpawned</code> ยิง → เรียก <code>CheckSaveServerRpc(persistentId)</code></li>
              <li>Host ตรวจสอบ <code>_database</code> ใน memory</li>
              <li><strong>Returning player</strong>: host เรียก <code>RpcLoadCharacter(target, savedData)</code> → client เข้าเกมกับ character ของตน</li>
              <li><strong>New player</strong>: host เรียก <code>RpcShowCreationScreen(target)</code> → client กรอก UI → เรียก <code>CreateCharacterServerRpc</code> → host เก็บไว้ → client เข้าเกม</li>
              <li>เมื่อ disconnect: host snapshot character จาก player object และอัปเดต record</li>
            </ol>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>
          <div className="prose"><h2>CharacterData struct</h2></div>
          <CodeBlock filename="CharacterData.cs" language="csharp" code={characterDataCode} />
          <div className="prose"><h2>NetworkCharacterManager — host database</h2></div>
          <CodeBlock filename="NetworkCharacterManager.cs" language="csharp" code={managerCode} />
          <div className="prose"><h2>OnlinePlayer — client boot</h2></div>
          <CodeBlock filename="OnlinePlayer.cs" language="csharp" code={clientBootCode} />
          <Callout type="tip" title="ใช้ persistent ID ไม่ใช่ PlayerID"><code>PlayerID</code> เปลี่ยนแต่ละ session ใช้ Steam ID, GUID ที่เก็บใน PlayerPrefs หรือ account token เป็น dictionary key เพื่อให้คุณ match physical player เดิมข้ามเซสชั่น</Callout>
          <Callout type="warning" title="Validate ข้อมูล character บน server">Client อาจส่ง <code>CharacterData</code> ที่มี stats สูงสุด Validate max values, ความยาวชื่อ และ class IDs ที่อนุญาตภายใน <code>CreateCharacterServerRpc</code> ก่อนเก็บ ห้ามไว้วางใจข้อมูลที่ client ส่งมา</Callout>
          <Callout type="info" title="SaveDatabaseToDisk สำหรับ persistent worlds">Saves ใน memory หายไปเมื่อ host ออก เรียก <code>SaveDatabaseToDisk()</code> ใน <code>OnApplicationQuit</code> และ <code>LoadDatabaseFromDisk()</code> ใน <code>Awake</code> เพื่อ persist characters ข้าม host restarts</Callout>
        </DocPage>
      }
    />
  );
}
