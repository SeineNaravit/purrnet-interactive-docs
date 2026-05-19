import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "SyncDictionary" };

const changeParamsEN = [
  { name: ".operation", type: "SyncDictionaryOperation", description: "The type of change: Set (key added or updated), Removed (key deleted), or Cleared (all entries removed)." },
  { name: ".key", type: "TKey", description: "The dictionary key affected by this operation. Present for Set and Removed operations." },
  { name: ".value", type: "TValue", description: "The new value for Set operations. For Removed and Cleared operations this field is the default value of TValue." },
];

const changeParamsTH = [
  { name: ".operation", type: "SyncDictionaryOperation", description: "ประเภทของการเปลี่ยนแปลงที่เกิดขึ้น: Set (key เพิ่มหรืออัปเดต), Removed (key ถูกลบ) หรือ Cleared (entries ทั้งหมดถูกลบ)" },
  { name: ".key", type: "TKey", description: "dictionary key ที่ได้รับผลกระทบจาก operation นี้ มีสำหรับ Set และ Removed operations" },
  { name: ".value", type: "TValue", description: "ค่าใหม่สำหรับ Set operations สำหรับ Removed และ Cleared operations field นี้เป็น default value ของ TValue" },
];

const constructorParamsEN = [
  { name: "ownerAuth", type: "bool", default: "false", description: "When true, only the current owner of the NetworkBehaviour can write to this dictionary. The server can always write regardless." },
  { name: "sendIntervalInSeconds", type: "float", default: "0", description: "Minimum time between sync packets. Use > 0 to throttle high-frequency updates such as per-frame score increments." },
];

const constructorParamsTH = [
  { name: "ownerAuth", type: "bool", default: "false", description: "เมื่อ true เฉพาะเจ้าของปัจจุบันของ NetworkBehaviour เท่านั้นที่สามารถเขียน dictionary นี้ server สามารถเขียนได้เสมอโดยไม่คำนึง" },
  { name: "sendIntervalInSeconds", type: "float", default: "0", description: "เวลาขั้นต่ำระหว่าง sync packets ใช้ > 0 เพื่อ throttle การอัปเดตความถี่สูง เช่น score increments ต่อ frame" },
];

const playerBuffSystemCode = `using PurrNet;
using UnityEngine;

public class PlayerBuffSystem : NetworkBehaviour
{
    // Maps buff ID → remaining duration in seconds
    private SyncDictionary<int, float> _activeBuffs = new SyncDictionary<int, float>();

    private void Awake()
    {
        _activeBuffs.onChanged += OnBuffChanged;
    }

    private void OnBuffChanged(SyncDictionaryChange<int, float> change)
    {
        switch (change.operation)
        {
            case SyncDictionaryOperation.Set:
                // Key was added or its value was updated
                BuffUI.ShowBuff(change.key, change.value);
                break;
            case SyncDictionaryOperation.Removed:
                BuffUI.RemoveBuff(change.key);
                break;
            case SyncDictionaryOperation.Cleared:
                BuffUI.ClearAll();
                break;
        }
    }

    // Server applies a buff to this player
    public void ApplyBuff(int buffId, float duration)
    {
        if (!isServer) return;
        _activeBuffs[buffId] = duration; // Set operation
    }

    public void RemoveBuff(int buffId)
    {
        if (!isServer) return;
        _activeBuffs.Remove(buffId); // Removed operation
    }

    private void Update()
    {
        if (!isServer) return;

        // Tick down all buff durations
        var expired = new System.Collections.Generic.List<int>();
        foreach (var kv in _activeBuffs)
        {
            _activeBuffs[kv.Key] = kv.Value - Time.deltaTime;
            if (_activeBuffs[kv.Key] <= 0f)
                expired.Add(kv.Key);
        }
        foreach (var id in expired)
            _activeBuffs.Remove(id);
    }
}`;

const scoreboardManagerCode = `using PurrNet;
using UnityEngine;

public class ScoreboardManager : NetworkBehaviour
{
    // Server writes, all clients read
    private SyncDictionary<PlayerID, int> _scores = new SyncDictionary<PlayerID, int>();

    [SerializeField] private ScoreboardUI scoreboardUI;

    private void Awake()
    {
        _scores.onChanged += OnScoresChanged;
    }

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        if (asServer)
        {
            // Populate initial scores when the game starts
            foreach (var player in networkManager.players)
                _scores[player] = 0;

            networkManager.onPlayerConnected    += OnPlayerJoined;
            networkManager.onPlayerDisconnected += OnPlayerLeft;
        }
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);

        if (asServer)
        {
            networkManager.onPlayerConnected    -= OnPlayerJoined;
            networkManager.onPlayerDisconnected -= OnPlayerLeft;
        }
    }

    // ---- Server-side mutations ----

    public void AddScore(PlayerID player, int points)
    {
        if (!isServer) return;
        if (!_scores.ContainsKey(player)) return;
        _scores[player] = _scores[player] + points;
    }

    private void OnPlayerJoined(PlayerID player)
    {
        _scores[player] = 0;
    }

    private void OnPlayerLeft(PlayerID player)
    {
        _scores.Remove(player);
    }

    // ---- Client-side reaction ----

    private void OnScoresChanged(SyncDictionaryChange<PlayerID, int> change)
    {
        // Rebuild the entire UI row for the affected player
        switch (change.operation)
        {
            case SyncDictionaryOperation.Set:
                scoreboardUI.UpdateRow(change.key, change.value);
                break;
            case SyncDictionaryOperation.Removed:
                scoreboardUI.RemoveRow(change.key);
                break;
            case SyncDictionaryOperation.Cleared:
                scoreboardUI.Clear();
                break;
        }
        scoreboardUI.SortByScore(_scores);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="SyncDictionary"
          description="SyncDictionary<TKey, TValue> is a networked dictionary that syncs add, update, and remove operations across all clients. Only the changed key-value pair is sent per operation."
          badge="Sync Type"
          href="/docs/sync-dictionary"
        >
          <div className="prose">
            <h2>How it works</h2>
            <p>
              <code>SyncDictionary&lt;TKey, TValue&gt;</code> wraps a standard dictionary and
              intercepts every write. When you set a key, remove an entry, or call{" "}
              <code>Clear()</code>, PurrNet queues a delta packet describing that operation. All
              observers apply the same operation on their local copy, keeping every client in sync
              without resending the full dictionary.
            </p>
            <p>
              Late-joining clients receive the full current state on connect — no extra code needed.
            </p>

            <h2>Constructor Parameters</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={constructorParamsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
          </div>

          <CodeBlock
            filename="PlayerBuffSystem.cs"
            language="csharp"
            code={playerBuffSystemCode}
          />

          <div className="prose">
            <h2>SyncDictionaryChange properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={changeParamsEN} />
          </div>

          <div className="prose">
            <h2>Available operations</h2>
            <ul>
              <li><code>dict[key] = value</code> — set or update a key; fires <code>Set</code> operation</li>
              <li><code>Remove(key)</code> — removes a key; fires <code>Removed</code> operation</li>
              <li><code>Clear()</code> — removes all entries; fires <code>Cleared</code> operation</li>
              <li><code>ContainsKey(key)</code>, <code>TryGetValue(key, out val)</code> — read-only, not synced</li>
              <li><code>Count</code> — current number of entries</li>
            </ul>

            <h2>Situational example — real-time scoreboard</h2>
            <p>
              The scoreboard maps each player&apos;s PlayerID to their score. When the server
              updates a score, every client&apos;s UI refreshes through <code>onChanged</code>{" "}
              without any explicit broadcast.
            </p>
          </div>

          <CodeBlock
            filename="ScoreboardManager.cs"
            language="csharp"
            code={scoreboardManagerCode}
          />

          <Callout type="warning" title="Mutable struct values require SetDirty">
            If <code>TValue</code> is a mutable struct and you modify a field in place (e.g.{" "}
            <code>_scores[id].kills++</code>), the dictionary cannot detect the internal change.
            Read the struct, modify it, and reassign:{" "}
            <code>var s = _scores[id]; s.kills++; _scores[id] = s;</code> — or call{" "}
            <code>_scores.SetDirty(id)</code> after the mutation if direct assignment is inconvenient.
          </Callout>

          <Callout type="tip" title="Use simple keys">
            Prefer primitive keys (<code>int</code>, <code>string</code>, <code>PlayerID</code>)
            where possible. Complex struct keys require a custom equality comparer and add per-packet
            overhead because the key must be serialized alongside every delta operation.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="SyncDictionary"
          description="SyncDictionary คือ Dictionary&lt;TKey, TValue&gt; ที่ network-aware ซึ่ง replicate ทุก key-value mutation — add, update, remove และ clear — ทั่ว clients ที่เชื่อมต่อทั้งหมด"
          badge="Sync Type"
          href="/docs/sync-dictionary"
        >
          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              <code>SyncDictionary&lt;TKey, TValue&gt;</code> ห่อ dictionary มาตรฐานและสกัดกั้น
              ทุกการเขียน เมื่อคุณ set key, ลบ entry หรือเรียก <code>Clear()</code> PurrNet
              จะ queue delta packet ที่อธิบาย operation นั้น observers ทั้งหมดจะ apply operation เดียวกัน
              บน copy ท้องถิ่นของพวกเขา ทำให้ทุก client sync โดยไม่ต้องส่ง dictionary ทั้งหมดซ้ำ
            </p>
            <p>
              Clients ที่เข้าร่วมช้าจะได้รับสถานะปัจจุบันทั้งหมดเมื่อเชื่อมต่อ — ไม่ต้องเขียนโค้ดเพิ่ม
            </p>

            <h2>พารามิเตอร์ Constructor</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={constructorParamsTH} />
          </div>

          <div className="prose">
            <h2>การใช้พื้นฐาน</h2>
          </div>

          <CodeBlock
            filename="PlayerBuffSystem.cs"
            language="csharp"
            code={playerBuffSystemCode}
          />

          <div className="prose">
            <h2>คุณสมบัติ SyncDictionaryChange</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={changeParamsTH} />
          </div>

          <div className="prose">
            <h2>Operations ที่มีให้ใช้</h2>
            <ul>
              <li><code>dict[key] = value</code> — set หรืออัปเดต key; fire operation <code>Set</code></li>
              <li><code>Remove(key)</code> — ลบ key; fire operation <code>Removed</code></li>
              <li><code>Clear()</code> — ลบ entries ทั้งหมด; fire operation <code>Cleared</code></li>
              <li><code>ContainsKey(key)</code>, <code>TryGetValue(key, out val)</code> — read-only ไม่ sync</li>
              <li><code>Count</code> — จำนวน entries ปัจจุบัน</li>
            </ul>

            <h2>ตัวอย่างสถานการณ์ — scoreboard แบบ real-time</h2>
            <p>
              scoreboard map PlayerID ของแต่ละผู้เล่นกับคะแนนของพวกเขา เมื่อ server อัปเดตคะแนน
              UI ของทุก client จะ refresh ผ่าน <code>onChanged</code> โดยไม่ต้อง broadcast ชัดเจน
            </p>
          </div>

          <CodeBlock
            filename="ScoreboardManager.cs"
            language="csharp"
            code={scoreboardManagerCode}
          />

          <Callout type="warning" title="ค่า struct ที่ mutable ต้องใช้ SetDirty">
            ถ้า <code>TValue</code> เป็น mutable struct และคุณแก้ไข field หนึ่งใน place (เช่น{" "}
            <code>_scores[id].kills++</code>) dictionary ไม่สามารถตรวจจับการเปลี่ยนแปลงภายในได้
            คุณต้องอ่าน struct, แก้ไข และกำหนดซ้ำ: <code>var s = _scores[id]; s.kills++; _scores[id] = s;</code>{" "}
            หรือเรียก <code>_scores.SetDirty(id)</code> หลัง mutation ถ้า direct assignment ไม่สะดวก
          </Callout>

          <Callout type="tip" title="ใช้ keys ที่เรียบง่าย">
            ใช้ primitive keys (<code>int</code>, <code>string</code>, <code>PlayerID</code>) เมื่อเป็นไปได้
            Struct keys ที่ซับซ้อนต้องการ custom equality comparer และเพิ่ม per-packet overhead
            เพราะ key ต้อง serialize พร้อมกับทุก delta operation
          </Callout>
        </DocPage>
      }
    />
  );
}
