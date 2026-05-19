import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { AwaitableRpcVisualizer } from "@/components/visualizers/AwaitableRpcVisualizer";

export const metadata = { title: "Awaitable Rpc" };

const comparisonParamsEN = [
  { name: "Awaitable RPC", type: "Task<T>", description: "Client sends a request, suspends via await, and resumes when the server replies with a return value. One-to-one request/response." },
  { name: "ObserversRpc + callback", type: "void + event", description: "Server pushes results to all observers. No built-in request ID. Better for broadcasting results to multiple clients simultaneously." },
  { name: "SyncVar poll", type: "SyncVar<T>", description: "Server writes the value; client reads it on the next sync cycle. Best for state that must always be visible, not a one-time query." },
];

const comparisonParamsTH = [
  { name: "Awaitable RPC", type: "Task<T>", description: "Client ส่งคำขอ, หยุดรอผ่าน await และดำเนินต่อเมื่อ server ตอบกลับด้วยค่าที่ return one-to-one request/response" },
  { name: "ObserversRpc + callback", type: "void + event", description: "Server push ผลลัพธ์ไปยัง observers ทั้งหมด ไม่มี request ID ในตัว ดีกว่าสำหรับการ broadcast ผลลัพธ์ไปยัง client หลายตัวพร้อมกัน" },
  { name: "SyncVar poll", type: "SyncVar<T>", description: "Server เขียนค่า client อ่านในรอบ sync ถัดไป ดีที่สุดสำหรับ state ที่ต้องมองเห็นเสมอ ไม่ใช่ query ครั้งเดียว" },
];

const declarationCode = `using PurrNet;
using System.Threading.Tasks;
using UnityEngine;

public class LootRoller : NetworkBehaviour
{
    // The return type IS the response type — no separate callback needed.
    [ServerRpc(requireOwnership: true)]
    public async Task<LootResult> CmdRollLoot(int chestId)
    {
        // This entire body runs on the server.
        var chest = ChestRegistry.Get(chestId);
        if (chest == null || chest.isLooted)
            return new LootResult { success = false };

        var item = LootTable.Roll(chest.tier, Random.Range(0, int.MaxValue));
        chest.isLooted = true;
        await chest.PlayOpenAnimation(); // server-side async work is fine

        return new LootResult
        {
            success  = true,
            itemId   = item.id,
            quantity = item.quantity,
            rarity   = item.rarity,
        };
    }
}

[System.Serializable]
public struct LootResult : IPackedAuto
{
    public bool   success;
    public int    itemId;
    public int    quantity;
    public string rarity;
}`;

const callerCode = `using PurrNet;
using System;
using System.Threading.Tasks;
using UnityEngine;

public class ChestInteraction : NetworkBehaviour
{
    [SerializeField] private LootRoller _roller;

    public async void OnInteract(int chestId)
    {
        if (!isOwner) return;

        // Show a spinner while we wait for the server
        UI.ShowLoadingSpinner(true);

        try
        {
            LootResult result = await _roller.CmdRollLoot(chestId);

            if (result.success)
            {
                InventoryManager.AddItem(result.itemId, result.quantity);
                UI.ShowLootPopup(result.itemId, result.rarity);
            }
            else
            {
                UI.ShowMessage("That chest is already empty.");
            }
        }
        catch (TimeoutException)
        {
            UI.ShowMessage("Server did not respond. Try again.");
        }
        catch (OperationCanceledException)
        {
            // Player disconnected or scene unloaded during the await
        }
        finally
        {
            UI.ShowLoadingSpinner(false);
        }
    }
}`;

const matchmakingCode = `using PurrNet;
using System.Threading.Tasks;

public class MatchmakingClient : NetworkBehaviour
{
    [ServerRpc(requireOwnership: true)]
    public async Task<MatchResult> CmdFindMatch(GameMode mode, int mmr)
    {
        // Server queries its matchmaking pool and responds when a slot is found
        var slot = await MatchmakingService.FindSlot(mode, mmr);

        return new MatchResult
        {
            found      = slot != null,
            lobbyCode  = slot?.lobbyCode ?? string.Empty,
            serverIp   = slot?.ip        ?? string.Empty,
            serverPort = slot?.port      ?? 0,
        };
    }

    // ------- Caller side -------
    public async void StartSearching(GameMode mode, int localMmr)
    {
        searchButton.interactable = false;
        statusLabel.text = "Searching...";

        try
        {
            var result = await CmdFindMatch(mode, localMmr);

            if (result.found)
                ConnectToServer(result.serverIp, result.serverPort, result.lobbyCode);
            else
                statusLabel.text = "No match found. Try again later.";
        }
        catch
        {
            statusLabel.text = "Connection error.";
        }
        finally
        {
            searchButton.interactable = true;
        }
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Awaitable Rpc"
          description="Awaitable RPCs return a value from the server back to the calling client using async/await. The client sends a request and awaits the server's response in a single async method call."
          badge="RPC"
          href="/docs/awaitable-rpc"
        >
          <div className="not-prose mb-6">
            <AwaitableRpcVisualizer showControls />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              When you call an awaitable RPC, PurrNet attaches a unique request ID to the outgoing
              packet. The server executes the method, packages the return value with the original
              request ID, and sends a reply packet back to the caller only. The caller's{" "}
              <code>await</code> completes when that reply arrives, and the{" "}
              <code>Task&lt;T&gt;</code> resolves to the server's return value.
            </p>
            <p>
              From the programmer's perspective it looks like a normal <code>async</code> method
              call — no callbacks, no manual request/response correlation. You can return values
              from the server to the client without a separate callback or response RPC.
            </p>

            <h2>Declaration syntax</h2>
            <p>
              Mark the method with <code>[ServerRpc]</code> (or <code>[TargetRpc]</code>) and
              change the return type from <code>void</code> to{" "}
              <code>Task&lt;YourType&gt;</code>. PurrNet's source generator handles the rest.
            </p>
          </div>

          <CodeBlock filename="LootRoller.cs" language="csharp" code={declarationCode} />

          <div className="prose">
            <h2>Calling an awaitable RPC from the client</h2>
          </div>

          <CodeBlock filename="ChestInteraction.cs" language="csharp" code={callerCode} />

          <div className="prose">
            <h2>Handling timeouts</h2>
            <p>
              If the server does not respond (for example, the object is despawned during the call),
              the <code>Task</code> throws a <code>TimeoutException</code> after PurrNet's default
              RPC timeout. Wrap awaitable RPC calls in <code>try/catch</code> to handle this
              gracefully. You can also pass a <code>CancellationToken</code> to cancel early if the
              player leaves the screen.
            </p>

            <h2>When to use each approach</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={comparisonParamsEN} />
          </div>

          <div className="prose">
            <h2>Situational example — server-side matchmaking query</h2>
            <p>
              Awaitable RPCs are ideal for any client query that requires a confirmed answer from
              the server before the client can proceed — skill checks, trade confirmations,
              leaderboard lookups.
            </p>
          </div>

          <CodeBlock filename="MatchmakingClient.cs" language="csharp" code={matchmakingCode} />

          <Callout type="warning" title="Don't block the game loop">
            Awaiting an RPC inside <code>Update()</code> or any per-frame callback creates a new
            pending request every frame. Only await RPCs from one-shot handlers (button clicks,
            trigger events, coroutines). Use a guard flag or disable the trigger until the previous
            await completes.
          </Callout>

          <Callout type="tip" title="UniTask support">
            If your project uses Cysharp's UniTask, PurrNet awaitable RPCs are compatible — you
            can declare the return type as <code>UniTask&lt;T&gt;</code> instead of{" "}
            <code>Task&lt;T&gt;</code> for zero-allocation async without the overhead of the
            standard TPL scheduler. Add the PurrNet-UniTask bridge package to your project to
            enable this.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Awaitable RPC"
          description="Awaitable RPCs ขยาย ServerRpc pattern มาตรฐานให้ return ค่าแบบ asynchronous ผู้เรียก await Task&lt;T&gt; และดำเนินต่อเมื่อ server ตอบกลับแล้วเท่านั้น"
          badge="Advanced"
          href="/docs/awaitable-rpc"
        >
          <div className="not-prose mb-6">
            <AwaitableRpcVisualizer showControls />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              เมื่อคุณเรียก awaitable RPC PurrNet จะแนบ unique request ID กับ packet ที่ส่งออก
              server ดำเนินการเมธอด, package ค่าที่ return พร้อม original request ID
              และส่ง reply packet กลับไปยังผู้เรียกเท่านั้น <code>await</code> ของผู้เรียกจะ complete
              เมื่อ reply นั้นมาถึงและ <code>Task&lt;T&gt;</code> resolve เป็นค่า return ของ server
            </p>
            <p>
              จากมุมมองของโปรแกรมเมอร์มันดูเหมือนการเรียกเมธอด <code>async</code> ปกติ —
              ไม่มี callbacks ไม่มีการ correlate request และ response ด้วยตนเอง
            </p>

            <h2>ไวยากรณ์การประกาศ</h2>
            <p>
              ทำเครื่องหมายเมธอดด้วย <code>[ServerRpc]</code> (หรือ <code>[TargetRpc]</code>) และเปลี่ยน
              return type จาก <code>void</code> เป็น <code>Task&lt;YourType&gt;</code> source
              generator ของ PurrNet จัดการส่วนที่เหลือ
            </p>
          </div>

          <CodeBlock filename="LootRoller.cs" language="csharp" code={declarationCode} />

          <div className="prose">
            <h2>การเรียก awaitable RPC จาก client</h2>
          </div>

          <CodeBlock filename="ChestInteraction.cs" language="csharp" code={callerCode} />

          <div className="prose">
            <h2>การจัดการ timeout</h2>
            <p>
              ถ้า server ไม่ตอบกลับ (เช่น object ถูก despawn ระหว่างการเรียก) <code>Task</code>{" "}
              จะ throw <code>TimeoutException</code> หลังจาก RPC timeout เริ่มต้นของ PurrNet ห่อ
              awaitable RPC calls ใน <code>try/catch</code> เพื่อจัดการสิ่งนี้อย่างสง่างาม
              คุณยังสามารถใช้ <code>CancellationToken</code> เพื่อยกเลิกก่อนถ้าผู้เล่นออกจากหน้าจอ
            </p>

            <h2>เมื่อไหรควรใช้แต่ละวิธี</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={comparisonParamsTH} />
          </div>

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — server-side matchmaking query</h2>
            <p>
              Awaitable RPCs เหมาะสำหรับ client query ใดๆ ที่ต้องการคำตอบที่ยืนยันจาก server ก่อนที่
              client จะดำเนินต่อได้ — skill checks, trade confirmations, leaderboard lookups
            </p>
          </div>

          <CodeBlock filename="MatchmakingClient.cs" language="csharp" code={matchmakingCode} />

          <Callout type="warning" title="อย่าบล็อก game loop">
            การ await RPC ภายใน <code>Update()</code> หรือ per-frame callback ใดๆ จะสร้าง pending
            request ใหม่ทุก frame await RPCs จาก one-shot handlers เท่านั้น (การคลิกปุ่ม, trigger events,
            coroutines) ใช้ guard flag หรือปิดใช้งาน trigger จนกว่า await ก่อนหน้าจะ complete
          </Callout>

          <Callout type="tip" title="รองรับ UniTask">
            ถ้าโครงการของคุณใช้ UniTask ของ Cysharp awaitable RPCs ของ PurrNet เข้ากันได้ —
            คุณสามารถประกาศ return type เป็น <code>UniTask&lt;T&gt;</code> แทน <code>Task&lt;T&gt;</code>
            สำหรับ async แบบ zero-allocation โดยไม่มี overhead ของ standard TPL scheduler
            เพิ่มแพ็กเกจ PurrNet-UniTask bridge ในโครงการของคุณเพื่อเปิดใช้งาน
          </Callout>
        </DocPage>
      }
    />
  );
}
