import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SyncTimerVisualizer } from "@/components/visualizers/SyncTimerVisualizer";

export const metadata = { title: "SyncTimer" };

const propertyParamsEN = [
  { name: "timeRemaining", type: "float", description: "Seconds left until the timer expires. Updated every tick by the server and synced to clients." },
  { name: "duration", type: "float", description: "The total duration the timer was started with. Does not change after Start() is called." },
  { name: "normalizedProgress", type: "float", description: "A 0–1 value representing how much of the timer has elapsed. 0 = just started, 1 = expired. Useful for driving progress bars and lerps." },
  { name: "isRunning", type: "bool", description: "True between Start() and expiry (or Stop()). False when paused, stopped, or not yet started." },
  { name: "isPaused", type: "bool", description: "True when the timer has been paused with Pause() and is waiting to be resumed." },
  { name: "onExpired", type: "event Action", description: "Fires on all clients when timeRemaining reaches zero. Subscribe to trigger end-of-round logic, loot drops, etc." },
];

const methodParamsEN = [
  { name: "Start(float duration)", type: "void", description: "Begins the countdown from the given duration in seconds. Syncs the start time to all clients immediately." },
  { name: "Stop()", type: "void", description: "Halts the timer and resets timeRemaining to 0. Does not fire onExpired." },
  { name: "Pause()", type: "void", description: "Freezes the countdown. isPaused becomes true. timeRemaining does not decrease while paused." },
  { name: "Resume()", type: "void", description: "Continues the countdown from where it was paused. isPaused becomes false." },
];

const propertyParamsTH = [
  { name: "timeRemaining", type: "float", description: "วินาทีที่เหลือจนกว่า timer จะหมดเวลา อัปเดตทุก tick โดย server และ sync ไปยัง clients" },
  { name: "duration", type: "float", description: "ระยะเวลาทั้งหมดที่ timer ถูก Start() ด้วย ไม่เปลี่ยนแปลงหลังจากเรียก Start()" },
  { name: "normalizedProgress", type: "float", description: "ค่า 0–1 ที่แสดงว่า timer ผ่านไปเท่าไร 0 = เพิ่งเริ่ม, 1 = หมดเวลา ใช้สำหรับ progress bars และ lerps" },
  { name: "isRunning", type: "bool", description: "True ระหว่าง Start() และการหมดเวลา (หรือ Stop()) False เมื่อ paused, stopped หรือยังไม่เริ่ม" },
  { name: "isPaused", type: "bool", description: "True เมื่อ timer ถูก pause ด้วย Pause() และรอการ resume" },
  { name: "onExpired", type: "event Action", description: "Fire บน clients ทั้งหมดเมื่อ timeRemaining ถึงศูนย์ Subscribe เพื่อ trigger logic สิ้นสุดรอบ, loot drops เป็นต้น" },
];

const methodParamsTH = [
  { name: "Start(float duration)", type: "void", description: "เริ่มนับถอยหลังจากระยะเวลาที่กำหนดในหน่วยวินาที Sync เวลาเริ่มต้นไปยัง clients ทั้งหมดทันที" },
  { name: "Stop()", type: "void", description: "หยุด timer และ reset timeRemaining เป็น 0 ไม่ fire onExpired" },
  { name: "Pause()", type: "void", description: "หยุดการนับถอยหลัง isPaused กลายเป็น true timeRemaining ไม่ลดลงขณะ paused" },
  { name: "Resume()", type: "void", description: "ดำเนินการนับถอยหลังต่อจากที่ pause ไว้ isPaused กลายเป็น false" },
];

const basicUsageCode = `using PurrNet;
using UnityEngine;

public class RoundTimer : NetworkBehaviour
{
    [SerializeField] private float roundDuration = 120f;

    private SyncTimer _timer = new();

    private void Awake()
    {
        _timer.onExpired += OnTimerExpired;
    }

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        if (asServer)
            _timer.Start(roundDuration);
    }

    private void OnTimerExpired()
    {
        // Fires on ALL clients simultaneously
        if (isServer)
            GameManager.Instance.EndRound();

        HUD.ShowRoundOverBanner();
    }

    // Server can pause mid-round (e.g. during a cutscene)
    public void PauseRound()
    {
        if (!isServer) return;
        _timer.Pause();
    }

    public void ResumeRound()
    {
        if (!isServer) return;
        _timer.Resume();
    }
}`;

const progressBarCode = `using PurrNet;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class RoundTimerUI : NetworkBehaviour
{
    [SerializeField] private RoundTimer    _roundTimer;
    [SerializeField] private Slider        _progressBar;
    [SerializeField] private TextMeshProUGUI _timerLabel;
    [SerializeField] private Image         _barFill;

    [SerializeField] private Color _normalColor  = Color.green;
    [SerializeField] private Color _urgentColor  = Color.red;
    [SerializeField] private float _urgentThreshold = 0.8f; // 80% elapsed

    private SyncTimer Timer => _roundTimer.Timer; // expose field via property

    private void Update()
    {
        if (!Timer.isRunning) return;

        // normalizedProgress goes 0 → 1 as time elapses
        float progress = Timer.normalizedProgress;
        float remaining = Timer.timeRemaining;

        // Update progress bar — inverted so it depletes left to right
        _progressBar.value = 1f - progress;

        // Format MM:SS
        int minutes = Mathf.FloorToInt(remaining / 60f);
        int seconds = Mathf.FloorToInt(remaining % 60f);
        _timerLabel.text = $"{minutes:00}:{seconds:00}";

        // Flash red when time is almost up
        _barFill.color = progress >= _urgentThreshold
            ? Color.Lerp(_normalColor, _urgentColor, (progress - _urgentThreshold) / (1f - _urgentThreshold))
            : _normalColor;
    }
}`;

const cutsceneCode = `using PurrNet;
using System.Collections;

public class CutsceneManager : NetworkBehaviour
{
    [SerializeField] private RoundTimer _roundTimer;
    [SerializeField] private float      _cutsceneDuration = 5f;

    // Server triggers cutscene, pauses game timer during playback
    public void PlayVictoryCutscene(PlayerID winner)
    {
        if (!isServer) return;
        StartCoroutine(CutsceneCoroutine(winner));
    }

    private IEnumerator CutsceneCoroutine(PlayerID winner)
    {
        _roundTimer.PauseRound();
        RpcPlayCutscene(winner); // ObserversRpc to show video on all clients

        yield return new WaitForSeconds(_cutsceneDuration);

        _roundTimer.ResumeRound();
    }

    [ObserversRpc]
    private void RpcPlayCutscene(PlayerID winner)
    {
        CutscenePlayer.Play(winner);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="SyncTimer"
          description="SyncTimer is a server-driven countdown timer that stays in lockstep across all clients. Declare it as a field on your NetworkBehaviour and call Start() — every client sees the same timeRemaining."
          badge="Sync Type"
          href="/docs/sync-timer"
        >
          <div className="not-prose mb-6">
            <SyncTimerVisualizer />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              <code>SyncTimer</code> uses the server clock as the source of truth. When you call <code>Start(duration)</code> on the server, PurrNet records the server timestamp and syncs the timer state to all clients. Each client computes <code>timeRemaining</code> locally from that anchor timestamp and its own estimate of server time — so the display stays smooth at full frame rate without sending a packet every tick.
            </p>
            <p>
              Late-joining clients receive the current timer state on connect and catch up instantly.
            </p>

            <h2>Properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={propertyParamsEN} />
          </div>

          <div className="prose">
            <h2>Methods</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={methodParamsEN} />
          </div>

          <div className="prose">
            <h2>Basic usage</h2>
          </div>

          <CodeBlock
            filename="RoundTimer.cs"
            language="csharp"
            code={basicUsageCode}
          />

          <div className="prose">
            <h2>Situational example — round timer with UI progress bar</h2>
            <p>
              <code>normalizedProgress</code> maps the elapsed time to a 0–1 range, making it trivial to drive a UI progress bar, a radial countdown, or any other visual that needs to sweep from full to empty as time runs out.
            </p>
          </div>

          <CodeBlock
            filename="RoundTimerUI.cs"
            language="csharp"
            code={progressBarCode}
          />

          <div className="prose">
            <h2>Pause and resume example</h2>
          </div>

          <CodeBlock
            filename="CutsceneManager.cs"
            language="csharp"
            code={cutsceneCode}
          />

          <Callout type="tip" title="SyncTimer is server-driven">
            Only the server should call <code>Start()</code>, <code>Stop()</code>, <code>Pause()</code>, and <code>Resume()</code>. Clients have read-only access to the timer state. If a client needs to start a timer (e.g. a player-triggered event), use a <code>[ServerRpc]</code> to request it.
          </Callout>

          <Callout type="warning" title="Never use Time.time for networked timers">
            <code>Time.time</code> runs independently on each machine and drifts over the session. Two clients starting at different wall-clock moments will show different countdowns after a minute. Always use <code>SyncTimer</code> (or another server-anchored mechanism) for any timer that must appear identical on all clients.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="SyncTimer"
          description="SyncTimer คือ countdown timer ที่ server ขับเคลื่อนซึ่งซิงค์กันทั่ว clients ทั้งหมด ประกาศเป็น field บน NetworkBehaviour และเรียก Start() — ทุก client จะเห็น timeRemaining เดียวกัน"
          badge="Sync Type"
          href="/docs/sync-timer"
        >
          <div className="not-prose mb-6">
            <SyncTimerVisualizer />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              <code>SyncTimer</code> ใช้ server clock เป็นแหล่งความจริง เมื่อคุณเรียก{" "}
              <code>Start(duration)</code> บน server PurrNet จะบันทึก server timestamp และ sync
              timer state ไปยัง clients ทั้งหมด แต่ละ client คำนวณ <code>timeRemaining</code> ในเครื่อง
              จาก anchor timestamp นั้นและการประมาณ server time ของตัวเอง — ดังนั้นการแสดงผลยังคงราบรื่น
              ที่ frame rate เต็มโดยไม่ต้องส่ง packet ทุก tick
            </p>
            <p>
              Clients ที่เข้าร่วมช้าจะได้รับ timer state ปัจจุบันเมื่อเชื่อมต่อและอัปเดตทันที
            </p>

            <h2>Properties</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={propertyParamsTH} />
          </div>

          <div className="prose">
            <h2>Methods</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={methodParamsTH} />
          </div>

          <div className="prose">
            <h2>การใช้พื้นฐาน</h2>
          </div>

          <CodeBlock
            filename="RoundTimer.cs"
            language="csharp"
            code={basicUsageCode}
          />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — round timer พร้อม UI progress bar</h2>
            <p>
              <code>normalizedProgress</code> map เวลาที่ผ่านไปเป็นช่วง 0–1 ทำให้ง่ายต่อการขับเคลื่อน
              UI progress bar, radial countdown หรือ visual อื่นๆ ที่ต้องกวาดจากเต็มไปเปล่าเมื่อเวลาหมด
            </p>
          </div>

          <CodeBlock
            filename="RoundTimerUI.cs"
            language="csharp"
            code={progressBarCode}
          />

          <div className="prose">
            <h2>ตัวอย่าง pause และ resume</h2>
          </div>

          <CodeBlock
            filename="CutsceneManager.cs"
            language="csharp"
            code={cutsceneCode}
          />

          <Callout type="tip" title="SyncTimer ขับเคลื่อนโดย server">
            เฉพาะ server เท่านั้นที่ควรเรียก <code>Start()</code>, <code>Stop()</code>, <code>Pause()</code> และ
            <code>Resume()</code> Clients มีสิทธิ์อ่านอย่างเดียวสำหรับ timer state ถ้า client ต้องการ
            เริ่ม timer (เช่น player-triggered event) ใช้ <code>[ServerRpc]</code> เพื่อร้องขอ
          </Callout>

          <Callout type="warning" title="อย่าใช้ Time.time สำหรับ networked timers">
            <code>Time.time</code> ทำงานอิสระบนแต่ละเครื่องและ drift ตามระยะเวลา clients สองตัวที่เริ่มต้น
            ในช่วงเวลา wall-clock ต่างกันจะแสดง countdowns ที่ต่างกันหลังจากผ่านไปหนึ่งนาที
            ใช้ <code>SyncTimer</code> (หรือ mechanism ที่ anchored กับ server อื่น) เสมอสำหรับ timer
            ที่ต้องดูเหมือนกันบน clients ทั้งหมด
          </Callout>
        </DocPage>
      }
    />
  );
}
