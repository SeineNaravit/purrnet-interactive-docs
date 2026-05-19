import { DocPage } from "@/components/docs/DocPage";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { Callout } from "@/components/docs/Callout";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { RpcFlowVisualizer } from "@/components/visualizers/RpcFlowVisualizer";

export const metadata = { title: "TargetRpc" };

const paramsEN = [
  { name: "target (first argument)", type: "PlayerID", description: "The PlayerID of the client to receive this call. Pass null to send to the object's current owner. Passed as the first argument in the method signature.", required: true },
  { name: "requireServer", type: "bool", default: "Network Rules", description: "When true, only the server can call this RPC." },
  { name: "bufferLast", type: "bool", default: "false", description: "Stores the most recent call and replays it to the target player when they join." },
  { name: "runLocally", type: "bool", default: "false", description: "The caller also executes the method immediately." },
];

const paramsTH = [
  { name: "target (อาร์กิวเมนต์แรก)", type: "PlayerID", description: "ผู้เล่นที่จะส่ง RPC นี้ไปให้ ส่งเป็นอาร์กิวเมนต์แรกใน method signature", required: true },
  { name: "requireServer", type: "bool", default: "Network Rules", description: "เมื่อ true เฉพาะ server เท่านั้นที่สามารถเรียก RPC นี้" },
  { name: "bufferLast", type: "bool", default: "false", description: "จัดเก็บการเรียกครั้งล่าสุดและ replay ให้กับ target player เมื่อเข้าร่วม" },
  { name: "runLocally", type: "bool", default: "false", description: "ผู้เรียกก็ดำเนินการเมธอดทันที" },
];

const sharedCode = `using PurrNet;

public class QuestSystem : NetworkBehaviour
{
    // Only the specific player receives their quest reward
    [TargetRpc]
    public void RpcGrantReward(PlayerID target, int goldAmount, string itemName)
    {
        // Runs ONLY on the client matching 'target'
        UI.ShowRewardPopup(goldAmount, itemName);
        AudioManager.Play("reward_fanfare");
    }

    // Server trigger — after quest completion check
    [ServerRpc(requireOwnership: false)]
    public void CmdCompleteQuest(int questId, RPCInfo info = default)
    {
        if (!ValidateQuestCompletion(info.sender, questId)) return;

        var reward = questDatabase.GetReward(questId);
        // Send reward only to the completing player
        RpcGrantReward(info.sender, reward.gold, reward.item);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="TargetRpc"
          description="TargetRpc sends a method call from the server to a single specific client. Use it for private messages, personal UI updates, or per-player results that other clients must not see."
          badge="RPC"
          href="/docs/target-rpc"
        >
          <div className="not-prose mb-6">
            <RpcFlowVisualizer defaultType="TargetRpc" showControls />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              The server calls a method marked with <code>[TargetRpc]</code>, passing a{" "}
              <code>PlayerID</code> as the first argument. Only that player's client executes the
              method body. All other connected clients are unaware of the call.
            </p>
            <p>
              Common uses: displaying private chat messages, delivering loot drops to an inventory,
              sending kill confirmations, or sharing per-player secret game data.
            </p>

            <h2>Parameters</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
          </div>

          <CodeBlock filename="QuestSystem.cs" language="csharp" code={sharedCode} />

          <Callout type="tip">
            TargetRpc is the right choice for any data that should stay private to one player —
            inventory loot, personal notifications, anti-cheat feedback, or spectator-only
            information.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="TargetRpc"
          description="TargetRpc ส่งการเรียกเมธอดจาก server ไปยัง client เฉพาะหนึ่งคน ระบุด้วย PlayerID"
          badge="RPC"
          href="/docs/target-rpc"
        >
          <div className="not-prose mb-6">
            <RpcFlowVisualizer defaultType="TargetRpc" showControls />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              server เรียกเมธอด <code>[TargetRpc]</code> โดยส่ง <code>PlayerID</code> เป็นอาร์กิวเมนต์แรก
              เฉพาะ client ของผู้เล่นนั้นเท่านั้นที่ดำเนินการเมธอด client อื่นทั้งหมดไม่รู้ถึงการเรียกนั้น
            </p>
            <p>
              การใช้งานทั่วไป: การแสดงข้อความแชทส่วนตัว, การส่ง loot drops ใน inventory,
              การส่ง kill confirmations หรือข้อมูลเกมลับ
            </p>

            <h2>พารามิเตอร์</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={paramsTH} />
          </div>

          <div className="prose">
            <h2>การใช้งาน</h2>
          </div>

          <CodeBlock filename="QuestSystem.cs" language="csharp" code={sharedCode} />

          <Callout type="tip">
            TargetRpc เหมาะสำหรับข้อมูลใดๆ ที่ควรเป็นส่วนตัวสำหรับผู้เล่นคนเดียว — inventory loot,
            การแจ้งเตือนส่วนตัว, anti-cheat feedback หรือข้อมูลเฉพาะ spectator
          </Callout>
        </DocPage>
      }
    />
  );
}
