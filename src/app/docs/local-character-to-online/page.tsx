import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { LocalCharacterToOnlineViz } from "@/components/visualizers/LocalCharacterToOnlineViz";

export const metadata = { title: "Local Character to Online" };

// ── API tables ─────────────────────────────────────────────────────────────────

const lifecycleParamsEN = [
  {
    name: "CharacterSave.Save(data)",
    type: "void",
    description: "Serializes CharacterData to JSON and writes it to PlayerPrefs. Call before any scene transition or disconnect.",
  },
  {
    name: "CharacterSave.Load()",
    type: "CharacterData",
    description: "Reads the saved JSON from PlayerPrefs. Returns a default CharacterData if no save exists yet.",
  },
  {
    name: "NetworkManager.StartHost()",
    type: "void",
    description: "Starts PurrNet as both server and client on this machine. Spawns the local player prefab automatically.",
  },
  {
    name: "NetworkManager.StartClient(address)",
    type: "void",
    description: "Connects to an existing session. Once connected, the server spawns a PlayerIdentity object for this client.",
  },
  {
    name: "OnSpawned()",
    type: "override void",
    description: "Called by PurrNet after the player object is spawned and registered. The safe place to push saved character data into SyncVars.",
  },
  {
    name: "OnPlayerLeft(PlayerID)",
    type: "override void",
    description: "Server-only callback. Fires before the player object is despawned. Use it to capture and persist the player's final state.",
  },
];

const lifecycleParamsTH = [
  {
    name: "CharacterSave.Save(data)",
    type: "void",
    description: "Serialize CharacterData เป็น JSON และเขียนลง PlayerPrefs เรียกก่อน scene transition หรือ disconnect ทุกครั้ง",
  },
  {
    name: "CharacterSave.Load()",
    type: "CharacterData",
    description: "อ่าน JSON ที่บันทึกไว้จาก PlayerPrefs คืน CharacterData ค่าเริ่มต้นถ้ายังไม่มี save",
  },
  {
    name: "NetworkManager.StartHost()",
    type: "void",
    description: "เริ่ม PurrNet ในฐานะทั้ง server และ client บนเครื่องนี้ spawn player prefab ของ local โดยอัตโนมัติ",
  },
  {
    name: "NetworkManager.StartClient(address)",
    type: "void",
    description: "เชื่อมต่อกับ session ที่มีอยู่ เมื่อเชื่อมต่อแล้ว server จะ spawn PlayerIdentity object ให้ client นี้",
  },
  {
    name: "OnSpawned()",
    type: "override void",
    description: "PurrNet เรียกหลังจาก player object ถูก spawn และลงทะเบียนแล้ว เป็นที่ที่ปลอดภัยสำหรับ push ข้อมูล character ที่บันทึกไว้เข้า SyncVars",
  },
  {
    name: "OnPlayerLeft(PlayerID)",
    type: "override void",
    description: "Server-only callback ยิงก่อน player object ถูก despawn ใช้ capture และ persist สถานะสุดท้ายของ player",
  },
];

// ── Code snippets ──────────────────────────────────────────────────────────────

const characterSaveCode = `using System;
using UnityEngine;

[Serializable]
public class CharacterData
{
    public string name    = "Hero";
    public int    level   = 1;
    public float  health  = 100f;
    public int    xp      = 0;
    // Add any stat you want to persist across sessions
}

public static class CharacterSave
{
    private const string KEY = "CharacterData";

    /// <summary>Persist character to local storage.</summary>
    public static void Save(CharacterData data)
    {
        PlayerPrefs.SetString(KEY, JsonUtility.ToJson(data));
        PlayerPrefs.Save();
    }

    /// <summary>Load character from local storage. Never returns null.</summary>
    public static CharacterData Load()
    {
        string json = PlayerPrefs.GetString(KEY, "{}");
        return JsonUtility.FromJson<CharacterData>(json) ?? new CharacterData();
    }
}`;

const onlinePlayerCode = `using PurrNet;
using UnityEngine;

/// <summary>Bridges local save data into the PurrNet network session.</summary>
public class OnlinePlayer : PlayerIdentity<OnlinePlayer>
{
    // ownerAuth: true lets the owning client write without a ServerRpc
    private SyncVar<string> _name   = new("Hero",  ownerAuth: true);
    private SyncVar<int>    _level  = new(1,        ownerAuth: true);
    private SyncVar<float>  _health = new(100f,     ownerAuth: true);
    private SyncVar<int>    _xp     = new(0,        ownerAuth: true);

    public string charName => _name.value;
    public int    level    => _level.value;
    public float  health   => _health.value;

    protected override void OnSpawned()
    {
        if (!isLocalPlayer) return;

        // Push the local save into the network — all peers see this
        CharacterData saved = CharacterSave.Load();
        _name.value   = saved.name;
        _level.value  = saved.level;
        _health.value = saved.health;
        _xp.value     = saved.xp;

        Debug.Log($"[Net] Spawned as {saved.name} lv{saved.level}");
    }
}`;

const hostDataCode = `using PurrNet;
using UnityEngine;

public class MatchManager : NetworkBehaviour
{
    /// <summary>Called by host when all players are ready.</summary>
    [Server]
    public void StartMatch()
    {
        foreach (OnlinePlayer p in OnlinePlayer.allPlayers)
        {
            // Balance: give level-scaled health at match start
            float maxHp = 100f + (p.level * 10f);
            RpcSetMaxHealth(p.playerID, maxHp);
            Debug.Log($"  {p.charName} lv{p.level} → {maxHp} max HP");
        }
    }

    /// <summary>Runs only on the targeted client.</summary>
    [TargetRpc]
    private void RpcSetMaxHealth(PlayerID target, float maxHp)
    {
        GetComponent<HealthSystem>().SetMax(maxHp);
    }

    // Look up any specific player by connection ID
    [Server]
    public void AwardXP(PlayerID id, int amount)
    {
        if (!OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p)) return;
        p._xp.value += amount;
    }
}`;

const leaveSaveCode = `using PurrNet;
using UnityEngine;

public class SessionManager : NetworkBehaviour
{
    /// <summary>Server: fires before the player object is despawned.</summary>
    protected override void OnPlayerLeft(PlayerID id)
    {
        if (!OnlinePlayer.TryGetPlayer(id, out OnlinePlayer p)) return;

        var snapshot = new CharacterData
        {
            name   = p.charName,
            level  = p.level,
            health = p.health,
            xp     = p._xp.value,
        };

        // Tell the leaving client to write the snapshot locally
        RpcSaveOnClient(id, snapshot);

        // Optionally persist to your own backend
        StartCoroutine(SaveToBackend(id.ToString(), snapshot));
    }

    [TargetRpc]
    private void RpcSaveOnClient(PlayerID target, CharacterData data)
    {
        CharacterSave.Save(data);
        Debug.Log("[Save] Progress kept for next session.");
    }
}`;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Local Character to Online"
          description="Take a character that lives on the player's local machine and bring it into a live PurrNet multiplayer session — preserving stats, joining a friend's lobby, letting the host read everyone's data, and saving progress back when a player leaves."
          badge="Example"
          href="/docs/local-character-to-online"
        >
          {/* Interactive visualizer */}
          <LocalCharacterToOnlineViz />

          {/* API table */}
          <div className="prose">
            <h2>Key API at each stage</h2>
          </div>
          <div className="not-prose">
            <ParamTable params={lifecycleParamsEN} />
          </div>

          {/* Step 1 */}
          <div className="prose">
            <h2>Step 1 — Save the character locally</h2>
            <p>
              The character exists before any network connection. Serialize your data class to
              PlayerPrefs or a file so it persists across game sessions and is always available
              when starting offline or transitioning to online.
            </p>
          </div>
          <CodeBlock filename="CharacterSave.cs" language="csharp" code={characterSaveCode} />

          {/* Step 2–3 */}
          <div className="prose">
            <h2>Step 2 — Connect and sync character data</h2>
            <p>
              Subclass <code>PlayerIdentity&lt;T&gt;</code> for your player prefab. In{" "}
              <code>OnSpawned</code>, load the local save and write it into SyncVars. PurrNet
              replicates the values to all peers automatically — no extra RPC needed.
            </p>
          </div>
          <CodeBlock filename="OnlinePlayer.cs" language="csharp" code={onlinePlayerCode} />

          <Callout type="tip" title="ownerAuth: true for character stats">
            Setting <code>ownerAuth: true</code> on a SyncVar lets the owning client write directly
            without going through a ServerRpc. This is safe for cosmetic and progression data that
            the server will validate on use — but avoid it for anything the server must enforce (HP
            in a combat game, currency, etc.).
          </Callout>

          {/* Step 4–5 */}
          <div className="prose">
            <h2>Step 3 — Host reads and uses player data</h2>
            <p>
              Once all players are spawned, the host can iterate{" "}
              <code>OnlinePlayer.allPlayers</code> to read every character and apply server-side
              logic — level-scaling, matchmaking balance, anti-cheat checks, and targeted RPCs.
            </p>
          </div>
          <CodeBlock filename="MatchManager.cs" language="csharp" code={hostDataCode} />

          {/* Step 6 */}
          <div className="prose">
            <h2>Step 4 — Save data when a player leaves</h2>
            <p>
              Override <code>OnPlayerLeft</code> on a server-side NetworkBehaviour. This fires
              before the player object is despawned, giving you a guaranteed window to capture and
              persist their final state.
            </p>
          </div>
          <CodeBlock filename="SessionManager.cs" language="csharp" code={leaveSaveCode} />

          <Callout type="warning" title="Always save on unexpected disconnect">
            Override <code>OnApplicationQuit</code> and subscribe to{" "}
            <code>NetworkManager.onClientDisconnected</code> on the client side too. A player
            losing internet or force-quitting won&apos;t trigger <code>OnPlayerLeft</code> cleanly —
            save locally from the client as a fallback before the RPC can arrive.
          </Callout>

          <Callout type="info" title="This pattern works with any PurrNet transport">
            The CharacterSave + PlayerIdentity pattern is transport-agnostic. It works identically
            over Steam (via SteamTransport), direct IP (TCP/UDP), or WebSockets. The only change
            for a Steam lobby flow is how you discover and connect to the host session — the
            character sync and data-save steps are identical.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Local Character to Online"
          description="นำ character ที่อยู่บนเครื่อง local ของ player เข้าสู่ PurrNet multiplayer session แบบ live — รักษา stats, เข้าร่วม lobby ของเพื่อน, ให้ host อ่านข้อมูลของทุกคน และบันทึก progress กลับเมื่อ player ออกจากเกม"
          badge="Example"
          href="/docs/local-character-to-online"
        >
          <LocalCharacterToOnlineViz />

          <div className="prose">
            <h2>API หลักในแต่ละขั้นตอน</h2>
          </div>
          <div className="not-prose">
            <ParamTable params={lifecycleParamsTH} />
          </div>

          <div className="prose">
            <h2>ขั้นตอนที่ 1 — บันทึก character ไว้ใน local</h2>
            <p>
              Character มีอยู่ก่อนการเชื่อมต่อ network ใดๆ Serialize data class ของคุณลง PlayerPrefs
              หรือไฟล์เพื่อให้ข้อมูลคงอยู่ข้ามเซสชั่นและพร้อมใช้เสมอไม่ว่าจะเล่น offline หรือเปลี่ยนเป็น online
            </p>
          </div>
          <CodeBlock filename="CharacterSave.cs" language="csharp" code={characterSaveCode} />

          <div className="prose">
            <h2>ขั้นตอนที่ 2 — เชื่อมต่อและ sync ข้อมูล character</h2>
            <p>
              Subclass <code>PlayerIdentity&lt;T&gt;</code> สำหรับ player prefab ของคุณ ใน{" "}
              <code>OnSpawned</code> โหลด save ที่เก็บไว้ใน local และเขียนลง SyncVars PurrNet
              จะ replicate ค่าให้กับทุก peer โดยอัตโนมัติ — ไม่ต้องใช้ RPC เพิ่มเติม
            </p>
          </div>
          <CodeBlock filename="OnlinePlayer.cs" language="csharp" code={onlinePlayerCode} />

          <Callout type="tip" title="ownerAuth: true สำหรับ character stats">
            การตั้ง <code>ownerAuth: true</code> บน SyncVar ให้ client ที่เป็นเจ้าของเขียนได้โดยตรงโดยไม่ต้องผ่าน
            ServerRpc ปลอดภัยสำหรับข้อมูล cosmetic และ progression ที่ server จะ validate เมื่อใช้งาน — แต่หลีกเลี่ยง
            สิ่งที่ server ต้อง enforce (HP ในเกม combat, currency ฯลฯ)
          </Callout>

          <div className="prose">
            <h2>ขั้นตอนที่ 3 — Host อ่านและใช้ข้อมูล player</h2>
            <p>
              เมื่อ player ทุกคน spawn แล้ว host สามารถ iterate{" "}
              <code>OnlinePlayer.allPlayers</code> เพื่ออ่าน character ทุกคนและใช้ logic ฝั่ง server —
              level-scaling, matchmaking balance, anti-cheat checks และ targeted RPCs
            </p>
          </div>
          <CodeBlock filename="MatchManager.cs" language="csharp" code={hostDataCode} />

          <div className="prose">
            <h2>ขั้นตอนที่ 4 — บันทึกข้อมูลเมื่อ player ออก</h2>
            <p>
              Override <code>OnPlayerLeft</code> บน NetworkBehaviour ฝั่ง server callback นี้จะยิงก่อน
              player object ถูก despawn ให้คุณมีช่วงเวลาที่รับประกันสำหรับ capture และ persist
              สถานะสุดท้ายของพวกเขา
            </p>
          </div>
          <CodeBlock filename="SessionManager.cs" language="csharp" code={leaveSaveCode} />

          <Callout type="warning" title="บันทึกเสมอเมื่อ disconnect โดยไม่คาดหมาย">
            Override <code>OnApplicationQuit</code> และ subscribe กับ{" "}
            <code>NetworkManager.onClientDisconnected</code> ฝั่ง client ด้วย player ที่หลุด internet
            หรือ force-quit จะไม่ trigger <code>OnPlayerLeft</code> อย่างสะอาด —
            บันทึกจาก client เป็น fallback ก่อน RPC จะมาถึง
          </Callout>

          <Callout type="info" title="Pattern นี้ใช้ได้กับทุก PurrNet transport">
            Pattern CharacterSave + PlayerIdentity เป็น transport-agnostic ใช้ได้เหมือนกันทั้งบน
            Steam (SteamTransport), IP ตรง (TCP/UDP) หรือ WebSockets สิ่งเดียวที่เปลี่ยนสำหรับ Steam
            lobby flow คือวิธีค้นหาและเชื่อมต่อกับ host session — ขั้นตอน character sync และ data-save เหมือนกัน
          </Callout>
        </DocPage>
      }
    />
  );
}
