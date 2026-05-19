import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Network Rules" };

const flagParamsEN = [
  { name: "CanClientSpawn", type: "bool", default: "false", description: "Allow connected clients to spawn network objects without requesting from the server. Enabled in the Unsafe preset." },
  { name: "CanClientDespawn", type: "bool", default: "false", description: "Allow any client to despawn (destroy) networked objects. Only enable with strict ownership validation." },
  { name: "CanClientSetOwner", type: "bool", default: "false", description: "Allow clients to transfer ownership of objects they don't currently own. Unsafe in competitive games." },
  { name: "DefaultOwnership", type: "OwnershipMode", default: "Server", description: "Who automatically becomes owner when an object is spawned: Server, Spawner, or None." },
  { name: "CanCallServerRpc", type: "bool", default: "true", description: "Master switch: allow clients to call [ServerRpc] methods at all. Disabling blocks all client→server RPC calls." },
  { name: "CanCallObserversRpc", type: "bool", default: "false", description: "Allow clients (not just the server) to broadcast [ObserversRpc] calls. Disabled in ServerOwner and ServerStrict presets." },
  { name: "CanClientWriteSyncVars", type: "bool", default: "false", description: "Allow clients to write SyncVars that don't have ownerAuth set. Keep false unless prototyping." },
];

const flagParamsTH = [
  { name: "CanClientSpawn", type: "bool", default: "false", description: "อนุญาตให้ client ที่เชื่อมต่อ spawn network objects โดยไม่ต้องร้องขอจาก server เปิดใช้งานใน Unsafe preset" },
  { name: "CanClientDespawn", type: "bool", default: "false", description: "อนุญาตให้ client ใดก็ได้ despawn (ทำลาย) networked objects ควรเปิดเฉพาะเมื่อมีการตรวจสอบ ownership อย่างเข้มงวด" },
  { name: "CanClientSetOwner", type: "bool", default: "false", description: "อนุญาตให้ client โอนการเป็นเจ้าของ objects ที่ตนเองไม่ได้เป็นเจ้าของอยู่ ไม่ปลอดภัยในเกมแข่งขัน" },
  { name: "DefaultOwnership", type: "OwnershipMode", default: "Server", description: "ใครจะกลายเป็นเจ้าของโดยอัตโนมัติเมื่อ object ถูก spawn: Server, Spawner หรือ None" },
  { name: "CanCallServerRpc", type: "bool", default: "true", description: "สวิตช์หลัก: อนุญาตให้ client เรียกเมธอด [ServerRpc] เลย ปิดการใช้งานจะบล็อกการเรียก RPC client→server ทั้งหมด" },
  { name: "CanCallObserversRpc", type: "bool", default: "false", description: "อนุญาตให้ client (ไม่ใช่แค่ server) broadcast การเรียก [ObserversRpc] ปิดใช้งานใน ServerOwner และ ServerStrict presets" },
  { name: "CanClientWriteSyncVars", type: "bool", default: "false", description: "อนุญาตให้ client เขียน SyncVars ที่ไม่มี ownerAuth set ไว้ เก็บให้เป็น false เว้นแต่คุณกำลัง prototype" },
];

const rulesManagerCode = `using PurrNet;
using UnityEngine;

public class RulesManager : NetworkBehaviour
{
    [SerializeField] private NetworkRules lobbyRules;    // ServerOwner
    [SerializeField] private NetworkRules gameplayRules; // ServerStrict
    [SerializeField] private NetworkRules replayRules;   // Unsafe (spectator/replay)

    public void TransitionToGameplay()
    {
        if (!isServer) return;
        networkManager.networkRules = gameplayRules;
        Debug.Log("[Server] Switched to ServerStrict rules for gameplay.");
    }

    public void TransitionToLobby()
    {
        if (!isServer) return;
        networkManager.networkRules = lobbyRules;
    }
}`;

const authorityBootstrapCode = `using PurrNet;
using UnityEngine;

public class AuthorityBootstrap : MonoBehaviour
{
    [Header("Rules assets")]
    [SerializeField] private NetworkRules unsafeRules;      // for prototyping
    [SerializeField] private NetworkRules serverOwnerRules; // for co-op release
    [SerializeField] private NetworkRules serverStrictRules;// for competitive release

    [Header("Build flags")]
    [SerializeField] private bool isPrototypeBuild = false;
    [SerializeField] private bool isCompetitive    = false;

    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
        ApplyRules();
    }

    private void ApplyRules()
    {
        if (isPrototypeBuild)
        {
            _nm.networkRules = unsafeRules;
            Debug.LogWarning("NetworkRules: UNSAFE — prototyping only!");
            return;
        }

        _nm.networkRules = isCompetitive ? serverStrictRules : serverOwnerRules;
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Network Rules"
          description="NetworkRules is a ScriptableObject that defines the authority model for the entire game — who can spawn objects, call RPCs, and write sync state."
          badge="Core"
          href="/docs/network-rules"
        >
          <div className="prose">
            <h2>What Are Network Rules?</h2>
            <p>
              Every PurrNet project has one active <code>NetworkRules</code> asset assigned on the{" "}
              <code>NetworkManager</code>. Rules answer a single question for every network
              operation: <em>Is this machine allowed to do this right now?</em>
            </p>
            <p>
              Rules are checked before an RPC is dispatched, before a spawn is processed, and before
              a SyncVar write is applied. Violations are silently rejected on the server — no
              exception on the client — so the game stays stable even if a client attempts something
              unexpected.
            </p>

            <h2>Three Built-In Presets</h2>
            <table>
              <thead>
                <tr><th>Preset</th><th>Authority</th><th>Common Use</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>Unsafe</code></td>
                  <td>Full client authority — any client can spawn, despawn, and write SyncVars freely.</td>
                  <td>Rapid prototyping, single-player-with-network, game-jam builds</td>
                </tr>
                <tr>
                  <td><code>ServerOwner</code></td>
                  <td>Server + the current owner of an object share authority.</td>
                  <td>Co-op games, player-owned vehicles, owner-driven inventory</td>
                </tr>
                <tr>
                  <td><code>ServerStrict</code></td>
                  <td>Server only — clients request via ServerRpc, server validates and applies.</td>
                  <td>Competitive multiplayer, authoritative shooters, anti-cheat-critical games</td>
                </tr>
              </tbody>
            </table>

            <h2>Creating a NetworkRules Asset</h2>
            <p>
              In the Unity Project window, right-click any folder and select{" "}
              <strong>Create → PurrNet → Network Rules</strong>. Then drag the created asset into the{" "}
              <strong>Network Rules</strong> field on your <code>NetworkManager</code> component.
            </p>

            <h2>Configurable Flags</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={flagParamsEN} />
          </div>

          <div className="prose">
            <h2>Hot-Swapping Rules at Runtime</h2>
            <p>
              You can swap the active rules at any time from server code. Useful for games that change
              authority models between lobby, gameplay, and post-game phases.
            </p>
          </div>

          <CodeBlock
            filename="RulesManager.cs"
            language="csharp"
            code={rulesManagerCode}
          />

          <div className="prose">
            <h2>Overriding Rules Per-Object via NetworkIdentity</h2>
            <p>
              Global rules apply to all objects by default. You can override them for a specific
              prefab by assigning a different <code>NetworkRules</code> asset directly on that
              prefab&apos;s <code>NetworkIdentity</code> component. Per-object rules take precedence
              over global rules for every operation on that object.
            </p>

            <h2>Scenario Example — Prototype to Production</h2>
            <p>
              Many games start with <code>Unsafe</code> rules to iterate quickly, then tighten before
              shipping. The pattern below shows a single manager that swaps rules based on build type
              or feature flag.
            </p>
          </div>

          <CodeBlock
            filename="AuthorityBootstrap.cs"
            language="csharp"
            code={authorityBootstrapCode}
          />

          <Callout type="danger" title="Never ship with Unsafe rules">
            <code>Unsafe</code> rules allow any client to spawn any prefab, destroy other
            players&apos; objects, and overwrite any SyncVar. In a publicly accessible game this is
            trivially exploitable. Switch to <code>ServerOwner</code> or <code>ServerStrict</code>{" "}
            before any public playtest.
          </Callout>

          <Callout type="tip" title="Per-object rules for special cases">
            Use the NetworkIdentity override when you need one object to behave differently from the
            rest — for example, an &quot;admin tool&quot; object that only the server interacts with in
            a ServerOwner game, or a physics prop that uses client authority for responsiveness.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Network Rules"
          description="NetworkRules คือ ScriptableObject ที่กำหนด authority model สำหรับเกมทั้งหมด — ใครสามารถ spawn objects, เรียก RPCs และเขียน sync state ได้"
          badge="Core"
          href="/docs/network-rules"
        >
          <div className="prose">
            <h2>Network Rules คืออะไร?</h2>
            <p>
              ทุกโครงการ PurrNet มี <code>NetworkRules</code> asset ที่ active หนึ่งตัวที่กำหนดบน
              <code>NetworkManager</code> rules ตอบคำถามเดียวสำหรับทุก network operation:{" "}
              <em>เครื่องนี้ได้รับอนุญาตให้ทำสิ่งนี้ตอนนี้ไหม?</em>
            </p>
            <p>
              Rules จะถูกตรวจสอบก่อนที่ RPC จะถูก dispatch ก่อนที่ spawn จะถูกประมวลผล และก่อนที่
              SyncVar write จะถูก apply การละเมิดจะถูกปฏิเสธเงียบๆ บน server — ไม่มี exception บน client
              ดังนั้นเกมยังคงเสถียรแม้ client ลองทำบางอย่างที่ไม่คาดไว้
            </p>

            <h2>สาม preset ที่มีอยู่แล้วในตัว</h2>
            <table>
              <thead>
                <tr><th>Preset</th><th>Authority</th><th>การใช้งานทั่วไป</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>Unsafe</code></td>
                  <td>client authority เต็มรูปแบบ — client ใดก็ได้สามารถ spawn, despawn และเขียน SyncVars ได้อย่างอิสระ</td>
                  <td>Rapid prototyping, single-player-with-network, game-jam builds</td>
                </tr>
                <tr>
                  <td><code>ServerOwner</code></td>
                  <td>Server + เจ้าของปัจจุบันของ object แชร์ authority</td>
                  <td>เกม co-op, ยานพาหนะที่ผู้เล่นเป็นเจ้าของ, inventory ที่ owner-driven</td>
                </tr>
                <tr>
                  <td><code>ServerStrict</code></td>
                  <td>Server เท่านั้น — client ร้องขอผ่าน ServerRpc, server ตรวจสอบและ apply</td>
                  <td>Multiplayer แข่งขัน, shooters ที่มี authoritative, เกมที่ anti-cheat critical</td>
                </tr>
              </tbody>
            </table>

            <h2>การสร้าง NetworkRules asset</h2>
            <p>
              ใน Unity Project window คลิกขวาที่โฟลเดอร์ใดก็ได้แล้วเลือก{" "}
              <strong>Create → PurrNet → Network Rules</strong> จากนั้นลาก asset ที่สร้างไปยังช่อง{" "}
              <strong>Network Rules</strong> บนคอมโพเนนต์ <code>NetworkManager</code> ของคุณ
            </p>

            <h2>Flags ที่ตั้งค่าได้</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={flagParamsTH} />
          </div>

          <div className="prose">
            <h2>การสลับ rules ขณะรัน</h2>
            <p>
              คุณสามารถ hot-swap rules ที่ active ได้ตลอดเวลาจากโค้ด server มีประโยชน์สำหรับเกมที่
              เปลี่ยน authority models ระหว่าง lobby, gameplay และ post-game phases
            </p>
          </div>

          <CodeBlock
            filename="RulesManager.cs"
            language="csharp"
            code={rulesManagerCode}
          />

          <div className="prose">
            <h2>การ override rules ต่อ object ผ่าน NetworkIdentity</h2>
            <p>
              rules ทั่วไปใช้กับ objects ทั้งหมดโดยค่าเริ่มต้น คุณสามารถ override สำหรับ prefab เฉพาะ
              โดยกำหนด <code>NetworkRules</code> asset ที่แตกต่างโดยตรงบนคอมโพเนนต์
              <code>NetworkIdentity</code> ของ prefab นั้น rules ต่อ object มีความสำคัญกว่า rules ทั่วไป
              สำหรับทุก operation บน object นั้น
            </p>

            <h2>ตัวอย่างสถานการณ์ — prototype สู่ production</h2>
            <p>
              เกมหลายเกมเริ่มด้วย <code>Unsafe</code> rules เพื่อ iterate อย่างรวดเร็ว จากนั้น tighten ก่อน
              shipping รูปแบบด้านล่างแสดง manager เดียวที่สลับ rules ตาม build type หรือ feature flag
            </p>
          </div>

          <CodeBlock
            filename="AuthorityBootstrap.cs"
            language="csharp"
            code={authorityBootstrapCode}
          />

          <Callout type="danger" title="ห้าม ship ด้วย Unsafe rules">
            <code>Unsafe</code> rules อนุญาตให้ client ใดก็ได้ spawn prefabs ใดก็ได้, ทำลาย objects ของผู้เล่นอื่น
            และเขียนทับ SyncVar ใดก็ได้ ในเกมที่เข้าถึงได้สาธารณะนี้ถูกโจมตีได้ง่ายมาก
            เปลี่ยนไปใช้ <code>ServerOwner</code> หรือ <code>ServerStrict</code> ก่อน playtest สาธารณะใดๆ
          </Callout>

          <Callout type="tip" title="Rules ต่อ object สำหรับกรณีพิเศษ">
            ใช้ NetworkIdentity override เมื่อคุณต้องการให้ object หนึ่งทำงานต่างจาก objects ที่เหลือ —
            เช่น object &quot;admin tool&quot; ที่มีเฉพาะ server โต้ตอบได้ในเกม ServerOwner
            หรือ physics prop ที่ใช้ client authority เพื่อความตอบสนอง
          </Callout>
        </DocPage>
      }
    />
  );
}
