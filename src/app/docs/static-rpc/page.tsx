import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { StaticRpcVisualizer } from "@/components/visualizers/StaticRpcVisualizer";

export const metadata = { title: "StaticRpc" };

const constraintParamsEN = [
  { name: "T : struct", type: "constraint", description: "Generic RPCs work best with structs because they are value types and are fully serialized by PurrNet without any additional configuration." },
  { name: "T : IPackedAuto", type: "constraint", description: "Adding IPackedAuto lets PurrNet automatically serialize every field. Required for non-primitive struct payloads." },
  { name: "[RegisterNetworkType(typeof(T))]", type: "attribute", description: "Registers a concrete type so PurrNet includes it in the type manifest. Place this attribute on the struct definition." },
  { name: "T : class", type: "constraint", description: "Class types are supported but must implement a custom IPackedAuto serializer. Prefer structs to avoid GC pressure on frequently called RPCs." },
];

const constraintParamsTH = [
  { name: "T : struct", type: "constraint", description: "Generic RPCs ทำงานได้ดีที่สุดกับ structs เพราะเป็น value types และ serialize ได้อย่างสมบูรณ์โดย PurrNet โดยไม่ต้องตั้งค่าเพิ่มเติม" },
  { name: "T : IPackedAuto", type: "constraint", description: "การเพิ่ม IPackedAuto ทำให้ PurrNet serialize ทุก field ได้อัตโนมัติ จำเป็นสำหรับ non-primitive struct payloads" },
  { name: "[RegisterNetworkType(typeof(T))]", type: "attribute", description: "ลงทะเบียน concrete type เพื่อให้ PurrNet รวมไว้ใน type manifest วาง attribute นี้บน struct definition" },
  { name: "T : class", type: "constraint", description: "รองรับ class types แต่ต้อง implement custom IPackedAuto serializer ต้องการ Prefer structs เพื่อหลีกเลี่ยง GC pressure บน RPCs ที่เรียกบ่อย" },
];

const globalAnnouncerCode = `using PurrNet;
using UnityEngine;

// This manager exists as a single instance in every scene.
public class GlobalAnnouncer : NetworkBehaviour
{
    // Static RPC — no instance state needed, but routes via this NetworkIdentity.
    [ObserversRpc(bufferLast: false)]
    public static void BroadcastAnnouncement(string message, AnnouncementPriority priority)
    {
        // Runs on ALL clients when the server calls it.
        AnnouncerUI.ShowBanner(message, priority);
        AudioManager.PlayAnnouncerClip(priority);
    }

    // Only the server triggers world announcements
    public void AnnounceKingOfTheHill(PlayerID capturer)
    {
        if (!isServer) return;
        string name = PlayerRegistry.GetDisplayName(capturer);
        BroadcastAnnouncement($"{name} captured the hill!", AnnouncementPriority.High);
    }
}`;

const dataRelayCode = `using PurrNet;

public class DataRelay : NetworkBehaviour
{
    // A single declaration handles any registered struct payload.
    [ServerRpc(requireOwnership: true)]
    private void CmdSendData<T>(T payload) where T : struct, IPackedAuto
    {
        // Server receives and processes any registered T
        ProcessPayload(payload);
    }

    // Callers pass whatever concrete type they need:
    public void SendEquipment(EquipRequest req) => CmdSendData(req);
    public void SendCraftOrder(CraftRequest req) => CmdSendData(req);
}`;

const inventoryTransactionCode = `using PurrNet;
using UnityEngine;

// ---- Payload types ----

[RegisterNetworkType(typeof(EquipTransaction))]
public struct EquipTransaction : IPackedAuto
{
    public int itemId;
    public int slotIndex;
}

[RegisterNetworkType(typeof(TradeTransaction))]
public struct TradeTransaction : IPackedAuto
{
    public PlayerID target;
    public int      offeredItemId;
    public int      requestedItemId;
}

[RegisterNetworkType(typeof(CraftTransaction))]
public struct CraftTransaction : IPackedAuto
{
    public int recipeId;
    public int ingredientSlot;
}

// ---- Network behaviour ----

public class InventoryTransactionSystem : NetworkBehaviour
{
    // One generic RPC handles all transaction types.
    [ServerRpc(requireOwnership: true)]
    public void CmdSubmitTransaction<T>(T tx, RPCInfo info = default) where T : struct, IPackedAuto
    {
        // Server resolves the concrete type and delegates
        switch (tx)
        {
            case EquipTransaction equip:
                HandleEquip(info.sender, equip);
                break;
            case TradeTransaction trade:
                HandleTrade(info.sender, trade);
                break;
            case CraftTransaction craft:
                HandleCraft(info.sender, craft);
                break;
            default:
                Debug.LogWarning($"[Server] Unknown transaction type: {typeof(T).Name}");
                break;
        }
    }

    private void HandleEquip(PlayerID player, EquipTransaction tx)
    {
        var inv = PlayerRegistry.GetInventory(player);
        if (!inv.HasItem(tx.itemId)) return;
        inv.EquipToSlot(tx.itemId, tx.slotIndex);
    }

    private void HandleTrade(PlayerID initiator, TradeTransaction tx)
    {
        TradeManager.ProposeTrade(initiator, tx.target, tx.offeredItemId, tx.requestedItemId);
    }

    private void HandleCraft(PlayerID player, CraftTransaction tx)
    {
        CraftingSystem.AttemptCraft(player, tx.recipeId, tx.ingredientSlot);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="StaticRpc"
          description="StaticRpc sends a method call to all clients without requiring a NetworkBehaviour instance. Useful for global events that aren't tied to any specific networked object."
          badge="RPC"
          href="/docs/static-rpc"
        >
          <div className="not-prose mb-6">
            <StaticRpcVisualizer showControls />
          </div>

          <div className="prose">
            <h2>Static RPCs</h2>
            <p>
              In most RPC patterns the method lives on a <code>NetworkBehaviour</code> instance.{" "}
              A <strong>static RPC</strong> lives on a static method but is still dispatched through
              a specific <code>NetworkIdentity</code> — PurrNet uses that identity&apos;s connection
              to route the packet, but the method itself has no <code>this</code> reference.
            </p>
            <p>
              Useful for singleton managers, global event dispatchers, or utility classes that
              don&apos;t need to store per-instance state.
            </p>
          </div>

          <CodeBlock
            filename="GlobalAnnouncer.cs"
            language="csharp"
            code={globalAnnouncerCode}
          />

          <Callout type="info" title="Static RPCs still require a NetworkIdentity">
            Even though the method is static, PurrNet still needs to route the RPC packet through a{" "}
            <code>NetworkIdentity</code> that is live. The static method must be declared inside a
            class that inherits from <code>NetworkBehaviour</code> and an instance of that behaviour
            must be spawned on the network. The method simply doesn&apos;t use <code>this</code>.
          </Callout>

          <div className="prose">
            <h2>Generic RPCs</h2>
            <p>
              A <strong>generic RPC</strong> takes a type parameter <code>T</code> so that a single
              network method can accept different payload shapes. Ideal for addon or plugin systems,
              generic inventory transactions, or cases where you want a single RPC declaration to
              cover multiple structurally similar messages of different types.
            </p>
            <p>Rules for generic RPCs:</p>
            <ul>
              <li>The type parameter must be serializable by PurrNet (struct + <code>IPackedAuto</code> recommended)</li>
              <li>Every concrete type used must be registered with <code>[RegisterNetworkType]</code></li>
              <li>Type constraints limit what PurrNet will attempt to serialize</li>
            </ul>

            <h2>Type constraints for generics</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={constraintParamsEN} />
          </div>

          <div className="prose">
            <h2>Basic generic RPC</h2>
          </div>

          <CodeBlock
            filename="DataRelay.cs"
            language="csharp"
            code={dataRelayCode}
          />

          <div className="prose">
            <h2>Situational example — generic inventory transaction system</h2>
            <p>
              Instead of writing a separate RPC for every inventory operation (equip, drop, trade,
              craft) a generic transaction RPC handles them all with a single network declaration.
              Each concrete transaction type encodes its own logic.
            </p>
          </div>

          <CodeBlock
            filename="InventoryTransactionSystem.cs"
            language="csharp"
            code={inventoryTransactionCode}
          />

          <Callout type="warning" title="Register every concrete type">
            Forgetting <code>[RegisterNetworkType(typeof(MyStruct))]</code> on a concrete type used
            with a generic RPC will cause a serialization error at runtime the first time that type
            is sent. Register all types in a central file (e.g. <code>NetworkTypeRegistry.cs</code>)
            so none are missed when new transaction types are added.
          </Callout>

          <Callout type="tip" title="Combine static + generic for utility managers">
            A static generic RPC on a singleton manager is a powerful pattern for global events with
            typed payloads — for example a global effect system where{" "}
            <code>EffectManager.BroadcastEffect&lt;T&gt;(T fx)</code> routes any registered effect
            struct to all clients without adding a new RPC method per effect type.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Static and Generic RPC"
          description="PurrNet รองรับ RPC methods บน static methods และพารามิเตอร์ generic type เพื่อความยืดหยุ่นสูงสุดโดยไม่ต้อง boilerplate ต่อแต่ละประเภทข้อความ"
          badge="Advanced"
          href="/docs/static-rpc"
        >
          <div className="not-prose mb-6">
            <StaticRpcVisualizer showControls />
          </div>

          <div className="prose">
            <h2>Static RPCs</h2>
            <p>
              ในรูปแบบ RPC ส่วนใหญ่เมธอดจะอยู่บน instance ของ <code>NetworkBehaviour</code> {" "}
              <strong>static RPC</strong> อยู่บน static method แต่ยังถูก dispatch ผ่าน <code>NetworkIdentity</code> เฉพาะ —
              PurrNet ใช้ connection ของ identity นั้นเพื่อ route packet แต่เมธอดเองไม่มี <code>this</code> reference
            </p>
            <p>
              มีประโยชน์สำหรับ singleton managers, global event dispatchers หรือ utility classes ที่ไม่ต้องการ
              เก็บ state ต่อ instance
            </p>
          </div>

          <CodeBlock
            filename="GlobalAnnouncer.cs"
            language="csharp"
            code={globalAnnouncerCode}
          />

          <Callout type="info" title="Static RPCs ยังต้องการ NetworkIdentity">
            แม้ว่าเมธอดจะเป็น static PurrNet ยังต้อง route RPC packet ผ่าน{" "}
            <code>NetworkIdentity</code> ที่ live อยู่ static method ต้องประกาศภายในคลาสที่สืบทอดจาก
            <code>NetworkBehaviour</code> และ instance ของ behaviour นั้นต้องถูก spawn บนเครือข่าย
            เมธอดเพียงแค่ไม่ใช้ <code>this</code>
          </Callout>

          <div className="prose">
            <h2>Generic RPCs</h2>
            <p>
              <strong>generic RPC</strong> รับ type parameter <code>T</code> เพื่อให้ network method เดียวกัน
              สามารถรับ payload shapes ที่แตกต่างกันได้ เหมาะสำหรับระบบ addon หรือ plugin,
              generic inventory transactions หรือกรณีที่คุณต้องการการประกาศ RPC เดียวสำหรับหลาย
              messages ที่มีโครงสร้างคล้ายกันแต่ type ต่างกัน
            </p>
            <p>
              กฎสำหรับ generic RPCs:
            </p>
            <ul>
              <li>Type parameter ต้อง serialize ได้โดย PurrNet (แนะนำ struct + <code>IPackedAuto</code>)</li>
              <li>แต่ละ concrete type ที่ใช้ต้องลงทะเบียนด้วย <code>[RegisterNetworkType]</code></li>
              <li>Type constraint จำกัดสิ่งที่ PurrNet จะพยายาม serialize</li>
            </ul>

            <h2>Type constraints สำหรับ generic</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={constraintParamsTH} />
          </div>

          <div className="prose">
            <h2>Generic RPC พื้นฐาน</h2>
          </div>

          <CodeBlock
            filename="DataRelay.cs"
            language="csharp"
            code={dataRelayCode}
          />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — ระบบ generic inventory transaction</h2>
            <p>
              แทนที่จะเขียน RPC แยกต่างหากสำหรับทุก inventory operation (equip, drop, trade, craft)
              generic transaction RPC จัดการทั้งหมดด้วยการประกาศ network เดียว แต่ละ concrete
              transaction type เข้ารหัส logic ของตัวเอง
            </p>
          </div>

          <CodeBlock
            filename="InventoryTransactionSystem.cs"
            language="csharp"
            code={inventoryTransactionCode}
          />

          <Callout type="warning" title="ลงทะเบียนทุก concrete type">
            การลืม <code>[RegisterNetworkType(typeof(MyStruct))]</code> บน concrete type ที่ใช้กับ
            generic RPC จะทำให้เกิด serialization error ขณะ runtime เมื่อ type นั้นถูกส่งครั้งแรก
            ลงทะเบียน types ทั้งหมดในไฟล์กลาง (เช่น <code>NetworkTypeRegistry.cs</code>) เพื่อไม่ให้พลาด
            เมื่อมีการเพิ่ม transaction types ใหม่
          </Callout>

          <Callout type="tip" title="รวม static + generic สำหรับ utility managers">
            static generic RPC บน singleton manager เป็นรูปแบบที่มีพลังสำหรับ global events ที่มี
            typed payloads — เช่น global effect system ที่{" "}
            <code>EffectManager.BroadcastEffect&lt;T&gt;(T fx)</code> route effect struct ที่ลงทะเบียนไว้
            ไปยัง clients ทั้งหมดโดยไม่ต้องเพิ่ม RPC method ใหม่ต่อ effect type
          </Callout>
        </DocPage>
      }
    />
  );
}
