import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SyncEventVisualizer } from "@/components/visualizers/SyncEventVisualizer";

export const metadata = { title: "SyncEvent" };

const comparisonParamsEN = [
  { name: "SyncEvent", type: "[SyncEvent] event Action", description: "Declare a C# event. Invoking it on the authority automatically broadcasts to all observers. No manual RPC call needed." },
  { name: "ObserversRpc", type: "[ObserversRpc] void Method()", description: "A named method the server explicitly calls to push a message. Supports bufferLast for late joiners. More explicit, slightly more boilerplate." },
  { name: "ObserversRpc + bufferLast", type: "[ObserversRpc(bufferLast: true)]", description: "Replays the last call for new observers. SyncEvent does not buffer — use ObserversRpc + bufferLast when late joiners must receive the event." },
];

const comparisonParamsTH = [
  { name: "SyncEvent", type: "[SyncEvent] event Action", description: "ประกาศ C# event เมื่อเรียกใช้บน authority จะ broadcast ไปยัง observers ทั้งหมดโดยอัตโนมัติ ไม่ต้องเรียก RPC ด้วยตนเอง" },
  { name: "ObserversRpc", type: "[ObserversRpc] void Method()", description: "เมธอดที่มีชื่อซึ่ง server เรียกอย่างชัดเจนเพื่อ push message รองรับ bufferLast สำหรับผู้เข้าร่วมช้า ชัดเจนกว่า มี boilerplate เล็กน้อยมากกว่า" },
  { name: "ObserversRpc + bufferLast", type: "[ObserversRpc(bufferLast: true)]", description: "เล่นซ้ำการเรียกล่าสุดสำหรับ observers ใหม่ SyncEvent ไม่ buffer — ใช้ ObserversRpc + bufferLast เมื่อผู้เข้าร่วมช้าต้องได้รับ event" },
];

const declarationCode = `using PurrNet;
using System;
using UnityEngine;

public class GameEvents : NetworkBehaviour
{
    // Zero-argument event — simple signal
    [SyncEvent] public event Action OnRoundStarted;

    // Events with arguments — any serializable types
    [SyncEvent] public event Action<PlayerID, int> OnPlayerScored;   // player, points
    [SyncEvent] public event Action<PlayerID>      OnPlayerEliminated;
    [SyncEvent] public event Action<string>        OnAnnouncementPlayed;

    // ---- Server raises these ----

    public void StartRound()
    {
        if (!isServer) return;
        // Set up server state...
        OnRoundStarted?.Invoke(); // Fires on ALL clients automatically
    }

    public void AwardScore(PlayerID player, int points)
    {
        if (!isServer) return;
        scoreTracker.Add(player, points);
        OnPlayerScored?.Invoke(player, points); // Fires on ALL clients
    }
}`;

const subscribingCode = `using PurrNet;
using UnityEngine;

public class ScoreboardListener : NetworkBehaviour
{
    [SerializeField] private GameEvents _gameEvents;
    [SerializeField] private ScoreboardUI _ui;
    [SerializeField] private EliminationFeed _feed;

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        // Subscribe on all machines — server and clients alike
        _gameEvents.OnRoundStarted       += HandleRoundStarted;
        _gameEvents.OnPlayerScored       += HandlePlayerScored;
        _gameEvents.OnPlayerEliminated   += HandlePlayerEliminated;
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);

        // Always unsubscribe to prevent memory leaks
        _gameEvents.OnRoundStarted       -= HandleRoundStarted;
        _gameEvents.OnPlayerScored       -= HandlePlayerScored;
        _gameEvents.OnPlayerEliminated   -= HandlePlayerEliminated;
    }

    private void HandleRoundStarted()
    {
        _ui.ResetScores();
        countdownDisplay.StartCountdown(3);
    }

    private void HandlePlayerScored(PlayerID player, int points)
    {
        _ui.AnimateScore(player, points);
    }

    private void HandlePlayerEliminated(PlayerID player)
    {
        _feed.AddEntry(player);
        if (player == localPlayer)
            ShowDeathScreen();
    }
}`;

const gameManagerCode = `using PurrNet;
using System;
using System.Collections;
using UnityEngine;

public class GameManager : NetworkBehaviour
{
    [SyncEvent] public event Action<float>    OnGameTimerStarted;  // duration
    [SyncEvent] public event Action           OnGameOver;
    [SyncEvent] public event Action<PlayerID> OnMVPAnnounced;
    [SyncEvent] public event Action<int>      OnScoreThresholdReached; // new threshold

    private SyncVar<int> _totalScore = new(0);

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        if (asServer)
        {
            _totalScore.onChanged += OnTotalScoreChanged;
            StartCoroutine(RunGame());
        }
    }

    private IEnumerator RunGame()
    {
        float duration = 180f;
        OnGameTimerStarted?.Invoke(duration); // fires on all clients

        yield return new WaitForSeconds(duration);

        PlayerID mvp = ScoreRegistry.GetTopPlayer();
        OnMVPAnnounced?.Invoke(mvp); // fires on all clients

        yield return new WaitForSeconds(2f);

        OnGameOver?.Invoke(); // fires on all clients
    }

    private void OnTotalScoreChanged(int newScore)
    {
        // Server checks milestones and fires threshold events
        int[] thresholds = { 100, 250, 500, 1000 };
        foreach (var t in thresholds)
        {
            if (newScore >= t && (_totalScore.previousValue < t))
                OnScoreThresholdReached?.Invoke(t);
        }
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="SyncEvent"
          description="SyncEvent turns a standard C# event into a networked one. When the authority raises the event, PurrNet automatically propagates it to every observer — no manual RPC dispatch required."
          badge="Sync Type"
          href="/docs/sync-event"
        >
          <div className="not-prose mb-6">
            <SyncEventVisualizer showControls />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              Decorate a C# event field with <code>[SyncEvent]</code> on a <code>NetworkBehaviour</code>. When the server (or owner, if owner-auth is enabled) invokes the event, PurrNet intercepts the invocation and fans it out as a network message. On all observing clients the event fires locally — any subscriber receives the call exactly as if it had been raised on that machine.
            </p>
            <p>
              The key difference from <code>[ObserversRpc]</code> is that no separate method is needed for broadcasting. You just raise the event in your game logic and PurrNet handles the network layer.
            </p>

            <h2>Declaration</h2>
          </div>

          <CodeBlock
            filename="GameEvents.cs"
            language="csharp"
            code={declarationCode}
          />

          <div className="prose">
            <h2>Subscribing from any client</h2>
            <p>
              Clients subscribe and unsubscribe to a SyncEvent exactly like a normal C# event. Subscription is purely local — no network message is sent when you add or remove a listener.
            </p>
          </div>

          <CodeBlock
            filename="ScoreboardListener.cs"
            language="csharp"
            code={subscribingCode}
          />

          <div className="prose">
            <h2>Situational example — GameManager with multiple sync events</h2>
            <p>
              Centralising game-flow signals in a single manager makes it easy for any other behaviour in the scene to react without needing a direct reference to the source of the action.
            </p>
          </div>

          <CodeBlock
            filename="GameManager.cs"
            language="csharp"
            code={gameManagerCode}
          />

          <div className="prose">
            <h2>SyncEvent vs ObserversRpc</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={comparisonParamsEN} />
          </div>

          <Callout type="tip" title="SyncEvent does not buffer for late joiners">
            Unlike <code>[ObserversRpc(bufferLast: true)]</code>, a SyncEvent is fire-and-forget — clients who connect after the event fires will not receive it. For events that late joiners must see (game state, round phase), use a <code>SyncVar</code> to hold the current state, or use an ObserversRpc with <code>bufferLast: true</code>.
          </Callout>

          <Callout type="warning" title="Only invoke on the authority">
            Raising a SyncEvent from a non-authority machine (a client that does not own the object) will silently no-op on other clients. If you need clients to trigger server-side events, use a <code>[ServerRpc]</code> to request the server raise the SyncEvent on their behalf.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="SyncEvent"
          description="SyncEvent แปลง C# event มาตรฐานให้เป็น networked event เมื่อ authority raise event PurrNet จะ propagate ไปยัง observer ทุกคนโดยอัตโนมัติ — ไม่ต้อง dispatch RPC ด้วยตนเอง"
          badge="Sync Type"
          href="/docs/sync-event"
        >
          <div className="not-prose mb-6">
            <SyncEventVisualizer showControls />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              ตกแต่ง C# event field ด้วย <code>[SyncEvent]</code> บน <code>NetworkBehaviour</code>
              เมื่อ server (หรือ owner ถ้าเปิดใช้ owner-auth) เรียก event PurrNet จะสกัดกั้น
              การเรียกและกระจายเป็น network message บน clients ที่ observe ทั้งหมด event จะ fire
              ในเครื่อง — subscriber ใดก็ตามได้รับการเรียกเหมือนกับว่า raise บนเครื่องนั้น
            </p>
            <p>
              ความแตกต่างหลักจาก <code>[ObserversRpc]</code> คือไม่ต้องการเมธอดแยกต่างหากสำหรับ
              broadcasting คุณแค่ raise event ใน game logic แล้ว PurrNet จัดการ network layer
            </p>

            <h2>การประกาศ</h2>
          </div>

          <CodeBlock
            filename="GameEvents.cs"
            language="csharp"
            code={declarationCode}
          />

          <div className="prose">
            <h2>การ subscribe จาก client ใดก็ได้</h2>
            <p>
              Clients subscribe และ unsubscribe กับ SyncEvent เหมือนกับ C# event ปกติ การ subscription
              เป็น local เท่านั้น — ไม่มี network message ถูกส่งเมื่อคุณเพิ่มหรือลบ listener
            </p>
          </div>

          <CodeBlock
            filename="ScoreboardListener.cs"
            language="csharp"
            code={subscribingCode}
          />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — GameManager ที่มี sync events หลายตัว</h2>
            <p>
              การรวมศูนย์ game-flow signals ใน manager เดียวทำให้ behaviour อื่นๆ ใน scene
              สามารถตอบสนองได้โดยไม่ต้องการ reference โดยตรงไปยังแหล่งที่มาของ action
            </p>
          </div>

          <CodeBlock
            filename="GameManager.cs"
            language="csharp"
            code={gameManagerCode}
          />

          <div className="prose">
            <h2>SyncEvent vs ObserversRpc</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={comparisonParamsTH} />
          </div>

          <Callout type="tip" title="SyncEvent ไม่ buffer สำหรับผู้เข้าร่วมช้า">
            ต่างจาก <code>[ObserversRpc(bufferLast: true)]</code>, SyncEvent เป็นแบบ fire-and-forget — clients
            ที่เชื่อมต่อหลังจาก event fire จะไม่ได้รับมัน สำหรับ events ที่ผู้เข้าร่วมช้าต้องเห็น
            (game state, round phase) ใช้ <code>SyncVar</code> เพื่อเก็บ current state หรือใช้
            ObserversRpc กับ <code>bufferLast: true</code>
          </Callout>

          <Callout type="warning" title="เรียกใช้บน authority เท่านั้น">
            การ raise SyncEvent จากเครื่องที่ไม่ใช่ authority (client ที่ไม่ได้เป็นเจ้าของ object)
            จะ no-op อย่างเงียบบน clients อื่น ถ้าคุณต้องการให้ clients trigger server-side events ใช้
            <code>[ServerRpc]</code> เพื่อขอให้ server raise SyncEvent แทน
          </Callout>
        </DocPage>
      }
    />
  );
}
