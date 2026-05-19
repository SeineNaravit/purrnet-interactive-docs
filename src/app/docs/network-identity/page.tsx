import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "NetworkIdentity" };

const lifecycleCode = `using PurrNet;
using UnityEngine;

public class MyNetworkObject : NetworkBehaviour
{
    protected override void OnSpawned(bool asServer)
    {
        // Called when this object becomes live on the network.
        // asServer=true when running on the server instance.
        if (isOwner) SetupLocalPlayer();
        if (asServer) InitServerState();
    }

    protected override void OnDespawned()
    {
        // Called before this object is removed from the network.
        // Clean up subscriptions, pooled resources, etc.
        CleanupResources();
    }

    protected override void OnOwnerChanged(PlayerID? oldOwner, PlayerID? newOwner)
    {
        // Fires on ALL clients when ownership changes.
        bool iAmNewOwner = newOwner.HasValue && newOwner == localPlayer;
        inputController.enabled = iAmNewOwner;
    }

    protected override void OnOwnerDisconnected()
    {
        // Fires on the server when the owner's connection drops.
        if (isServer)
        {
            // Decide: re-assign, destroy, or make server-controlled?
            GiveOwnership(null); // server takes control
        }
    }

    protected override void OnPoolReset()
    {
        // Called when this object is returned to an object pool.
        // Reset to initial state for reuse.
        _health = maxHealth;
        _ammo = maxAmmo;
        gameObject.SetActive(true);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="NetworkIdentity"
          description="NetworkIdentity is the core component that registers a GameObject with the network. Every networked object must have at least one."
          badge="Core"
          href="/docs/network-identity"
        >
          <div className="prose">
            <h2>What it does</h2>
            <p>
              NetworkIdentity assigns a unique network ID to a GameObject and tracks which player owns it,
              who can observe it, and whether it has been spawned on the network. Without a NetworkIdentity,
              PurrNet has no way to identify or synchronize that object.
            </p>
            <p>
              In practice, most scripts inherit from <code>NetworkBehaviour</code> (which extends
              NetworkIdentity) rather than adding NetworkIdentity as a separate component. Both approaches work.
            </p>

            <h2>NetworkIdentity vs NetworkBehaviour</h2>

            <table>
              <thead><tr><th>Use</th><th>When</th></tr></thead>
              <tbody>
                <tr><td><code>NetworkIdentity</code></td><td>You need a networked object but no script logic (e.g. a pure geometry object tracked over the network).</td></tr>
                <tr><td><code>NetworkBehaviour</code></td><td>You need RPCs, SyncVars, or lifecycle callbacks. Inherit from this instead — it already includes NetworkIdentity.</td></tr>
              </tbody>
            </table>

            <h2>Lifecycle callbacks</h2>
            <p>Override these in any <code>NetworkBehaviour</code> to react to network events:</p>
          </div>

          <CodeBlock
            filename="MyNetworkObject.cs"
            language="csharp"
            code={lifecycleCode}
          />

          <Callout type="tip" title="asServer vs isServer">
            <code>OnSpawned(bool asServer)</code> — the parameter describes the context of that specific callback invocation.{" "}
            <code>isServer</code> — the property tells you whether this machine is the server at any point in time.
            They are equal in value, but <code>asServer</code> is only available inside <code>OnSpawned</code>.
          </Callout>

          <div className="prose">
            <h2>Key properties</h2>
            <ul>
              <li><code>networkId</code> — unique identifier assigned by the server at spawn time</li>
              <li><code>isServer</code> — true when running on the server</li>
              <li><code>isClient</code> — true when running on a client</li>
              <li><code>isOwner</code> — true on the client that owns this object</li>
              <li><code>IsController</code> — true if you are the owner, or (server when there is no owner)</li>
              <li><code>owner</code> — nullable <code>PlayerID?</code> of the current owner</li>
              <li><code>isSpawned</code> — true once this object is live on the network</li>
              <li><code>localPlayer</code> — shortcut to the local machine&apos;s PlayerID</li>
            </ul>
          </div>
        </DocPage>
      }
      th={
        <DocPage
          title="NetworkIdentity"
          description="NetworkIdentity คือคอมโพเนนต์หลักที่ลงทะเบียน GameObject กับเครือข่าย PurrNet ทุก networked object ต้องมีอย่างน้อยหนึ่ง"
          badge="Core"
          href="/docs/network-identity"
        >
          <div className="prose">
            <h2>สิ่งที่มันทำ</h2>
            <p>
              NetworkIdentity กำหนด network ID เฉพาะให้กับ GameObject และติดตามว่าผู้เล่นคนไหนเป็นเจ้าของ
              ใครสามารถสังเกตเห็น และ spawn บนเครือข่ายหรือยัง โดยไม่มี NetworkIdentity
              PurrNet ไม่มีวิธีระบุหรือซิงโครไนซ์ object นั้น
            </p>
            <p>
              ในทางปฏิบัติ สคริปต์ส่วนใหญ่สืบทอดจาก <code>NetworkBehaviour</code> (ซึ่งขยาย
              NetworkIdentity) แทนที่จะเพิ่ม NetworkIdentity เป็นคอมโพเนนต์แยก ทั้งสองวิธีใช้งานได้
            </p>

            <h2>NetworkIdentity vs NetworkBehaviour</h2>

            <table>
              <thead><tr><th>ใช้</th><th>เมื่อ</th></tr></thead>
              <tbody>
                <tr><td><code>NetworkIdentity</code></td><td>คุณต้องการ networked object แต่ไม่ต้องการ script logic (เช่น pure geometry object ที่ติดตามผ่านเครือข่าย)</td></tr>
                <tr><td><code>NetworkBehaviour</code></td><td>คุณต้องการ RPCs, SyncVars หรือ lifecycle callbacks สืบทอดจากนี้แทน — มี NetworkIdentity รวมอยู่แล้ว</td></tr>
              </tbody>
            </table>

            <h2>Lifecycle callbacks</h2>
            <p>Override สิ่งเหล่านี้ใน <code>NetworkBehaviour</code> ใดก็ได้เพื่อตอบสนองต่อ network events:</p>
          </div>

          <CodeBlock
            filename="MyNetworkObject.cs"
            language="csharp"
            code={lifecycleCode}
          />

          <Callout type="tip" title="asServer vs isServer">
            <code>OnSpawned(bool asServer)</code> — พารามิเตอร์บอก context ของ callback นั้นๆ
            <code>isServer</code> — property บอกว่าเครื่องนี้เป็น server หรือเปล่าในทุกเวลา
            ค่าเท่ากัน แต่ <code>asServer</code> มีเฉพาะใน <code>OnSpawned</code> เท่านั้น
          </Callout>

          <div className="prose">
            <h2>คุณสมบัติหลัก</h2>
            <ul>
              <li><code>networkId</code> — identifier เฉพาะที่ server กำหนดตอน spawn</li>
              <li><code>isServer</code> — true เมื่อรันบน server</li>
              <li><code>isClient</code> — true เมื่อรันบน client</li>
              <li><code>isOwner</code> — true บน client ที่เป็นเจ้าของ object นี้</li>
              <li><code>IsController</code> — true ถ้าเป็นเจ้าของ หรือ (server ที่ไม่มีเจ้าของ)</li>
              <li><code>owner</code> — <code>PlayerID?</code> ที่ nullable ของเจ้าของปัจจุบัน</li>
              <li><code>isSpawned</code> — true เมื่อ object นี้ live บนเครือข่ายแล้ว</li>
              <li><code>localPlayer</code> — ทางลัดสู่ PlayerID ของเครื่องท้องถิ่น</li>
            </ul>
          </div>
        </DocPage>
      }
    />
  );
}
