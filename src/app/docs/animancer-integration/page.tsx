import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { AnimancerSyncVisualizer } from "@/components/visualizers/AnimancerSyncVisualizer";

export const metadata = { title: "Animancer Integration" };

// ── API tables ─────────────────────────────────────────────────────────────────

const apiParamsEN = [
  { name: "Play(int index, float fadeDuration = 0.25f)", type: "void", description: "Play a registered clip by index on all peers. Owner only. Resets normalizedTime to 0 and immediately broadcasts to observers." },
  { name: "Play(AnimationClip clip, float fadeDuration = 0.25f)", type: "void", description: "Play by clip reference. The clip must appear in _registeredClips — its index is the network key." },
  { name: "SetSpeed(float speed)", type: "void", description: "Set the playback speed SyncVar on all peers. Owner only." },
  { name: "Pause()", type: "void", description: "Set state.IsPlaying = false on all peers via SyncVar. Owner only." },
  { name: "Resume()", type: "void", description: "Resume a paused clip on all peers. Owner only." },
  { name: "CurrentClipName", type: "string", description: "The name of the currently playing registered clip, or 'None'. Read from any peer." },
  { name: "PlayMixer(float parameter)", type: "void", description: "(PurrNetAnimancerMixerSync) Start the LinearMixerState and set its blend parameter. Call every frame in your movement controller." },
];

const apiParamsTH = [
  { name: "Play(int index, float fadeDuration = 0.25f)", type: "void", description: "เล่น clip ที่ลงทะเบียนตาม index บนทุก peer เฉพาะ owner เท่านั้น รีเซ็ต normalizedTime เป็น 0 และ broadcast ไปยัง observers ทันที" },
  { name: "Play(AnimationClip clip, float fadeDuration = 0.25f)", type: "void", description: "เล่นโดยอ้างอิง clip clip ต้องอยู่ใน _registeredClips — index ของมันคือ network key" },
  { name: "SetSpeed(float speed)", type: "void", description: "ตั้งค่า playback speed SyncVar บนทุก peer เฉพาะ owner เท่านั้น" },
  { name: "Pause()", type: "void", description: "ตั้งค่า state.IsPlaying = false บนทุก peer ผ่าน SyncVar เฉพาะ owner เท่านั้น" },
  { name: "Resume()", type: "void", description: "Resume clip ที่ pause อยู่บนทุก peer เฉพาะ owner เท่านั้น" },
  { name: "CurrentClipName", type: "string", description: "ชื่อของ registered clip ที่กำลังเล่นอยู่ หรือ 'None' อ่านได้จาก peer ใดก็ได้" },
  { name: "PlayMixer(float parameter)", type: "void", description: "(PurrNetAnimancerMixerSync) เริ่ม LinearMixerState และตั้งค่า blend parameter เรียกทุก frame ใน movement controller ของคุณ" },
];

// ── Code snippets ──────────────────────────────────────────────────────────────

const basicUsageCode = `using PurrNet;
using Animancer;
using UnityEngine;

/// <summary>
/// Example character controller that uses PurrNetAnimancerSync.
/// Attach alongside AnimancerComponent and PurrNetAnimancerSync.
/// </summary>
public class AnimancerCharacter : NetworkBehaviour
{
    [Header("Animation Clips — same order as PurrNetAnimancerSync._registeredClips")]
    [SerializeField] private AnimationClip _idle;
    [SerializeField] private AnimationClip _walk;
    [SerializeField] private AnimationClip _run;
    [SerializeField] private AnimationClip _jump;
    [SerializeField] private AnimationClip _attack;

    private PurrNetAnimancerSync _animSync;
    private CharacterController  _cc;
    private bool                 _isGrounded;

    private void Awake()
    {
        _animSync = GetComponent<PurrNetAnimancerSync>();
        _cc       = GetComponent<CharacterController>();
    }

    private void Update()
    {
        // Only the owner drives animation state
        if (!isOwner) return;

        float speed = new Vector2(_cc.velocity.x, _cc.velocity.z).magnitude;

        if (!_isGrounded)
            _animSync.Play(_jump, fadeDuration: 0.15f);
        else if (speed > 5f)
            _animSync.Play(_run);
        else if (speed > 0.1f)
            _animSync.Play(_walk);
        else
            _animSync.Play(_idle, fadeDuration: 0.3f);
    }

    // Call from your input handler on the owner
    public void OnAttackInput()
    {
        if (!isOwner) return;
        _animSync.Play(_attack, fadeDuration: 0.1f);
    }
}`;

const mixerUsageCode = `using PurrNet;
using Animancer;
using UnityEngine;

/// <summary>
/// Movement controller that blends Walk/Run via a LinearMixerState.
/// The mixer parameter (moveSpeed 0-6) is synced to all peers via SyncVar.
/// </summary>
public class AnimancerMoverController : NetworkBehaviour
{
    private PurrNetAnimancerSync      _animSync;
    private PurrNetAnimancerMixerSync _mixerSync;
    private CharacterController       _cc;

    private void Awake()
    {
        _animSync  = GetComponent<PurrNetAnimancerSync>();
        _mixerSync = GetComponent<PurrNetAnimancerMixerSync>();
        _cc        = GetComponent<CharacterController>();
    }

    private void Update()
    {
        if (!isOwner) return;

        float speed = new Vector2(_cc.velocity.x, _cc.velocity.z).magnitude;

        // PlayMixer starts the LinearMixerState and sets the parameter each frame.
        // PurrNetAnimancerMixerSync syncs the parameter to all peers at _syncInterval.
        _mixerSync.PlayMixer(speed);
    }
}`;

const eventSyncCode = `using PurrNet;
using Animancer;
using UnityEngine;

/// <summary>
/// Shows how to sync Animancer end-events (one-shot attack finishing)
/// so all peers know when the animation completes.
/// </summary>
public class AnimancerEventSync : NetworkBehaviour
{
    [SerializeField] private AnimationClip _attack;
    [SerializeField] private AnimationClip _idle;

    private PurrNetAnimancerSync _animSync;
    private AnimancerComponent   _animancer;

    private void Awake()
    {
        _animSync = GetComponent<PurrNetAnimancerSync>();
        _animancer = GetComponent<AnimancerComponent>();
    }

    public void StartAttack()
    {
        if (!isOwner) return;

        // Clip index 3 = Attack in _registeredClips
        _animSync.Play(3, fadeDuration: 0.1f);

        // Attach an end-event only on the owner — then RPC the completion
        var state = _animancer.Play(_attack, 0.1f);
        state.Events.OnEnd = OnAttackEnd;
    }

    private void OnAttackEnd()
    {
        // Return to idle on all peers
        _animSync.Play(0, fadeDuration: 0.2f);

        // Notify server to apply the hit — decouple animation from gameplay
        NotifyAttackCompleteServerRpc();
    }

    [ServerRpc]
    private void NotifyAttackCompleteServerRpc()
    {
        // Server checks hit detection here — not in the animation callback
        Debug.Log($"[Server] {gameObject.name} attack confirmed.");
    }
}`;

const setupCode = `// ── Step 1: Register clips in the Inspector ─────────────────────────────────
//
//  PurrNetAnimancerSync._registeredClips must contain every clip
//  you'll call Play() with. Example for a typical humanoid:
//
//  Index 0  →  Idle
//  Index 1  →  Walk
//  Index 2  →  Run
//  Index 3  →  Jump
//  Index 4  →  Attack
//  Index 5  →  Death
//
//  Assign the same AnimationClip assets in the same order on the PREFAB
//  so that all peers share the same index↔clip mapping.

// ── Step 2: Add components ───────────────────────────────────────────────────
//
//  Your character prefab component stack:
//    ✓ Animator                    (required by AnimancerComponent)
//    ✓ AnimancerComponent          (Animancer's runtime)
//    ✓ PurrNetAnimancerSync        (this package — syncs clip index + time)
//    ✓ PurrNetAnimancerMixerSync   (optional — only for blend-tree blending)
//    ✓ NetworkIdentity             (PurrNet)
//    ✓ YourCharacterController     (call _animSync.Play() from here)

// ── Step 3: Wire the controller ──────────────────────────────────────────────

private PurrNetAnimancerSync _animSync;

private void Awake()
{
    _animSync = GetComponent<PurrNetAnimancerSync>();
}

private void Update()
{
    if (!isOwner) return;   // only the owner drives animations

    // Replace Animator.SetTrigger / Play with:
    _animSync.Play(clipIndex, fadeDuration);
    // or
    _animSync.Play(myAnimationClipReference);
}`;

// ── Download button component (server component safe) ─────────────────────────

function DownloadButton({ href, label, size }: { href: string; label: string; size: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
      </svg>
      {label}
      <span className="text-violet-300 text-xs">{size}</span>
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Animancer Integration"
          description="PurrNetAnimancerSync is a drop-in component that synchronizes Animancer's code-driven animation system over PurrNet — replicating clip playback, normalized time, speed, and pause state to all connected peers without touching Animator Controllers."
          badge="Integration"
          href="/docs/animancer-integration"
        >
          {/* Visualizer */}
          <AnimancerSyncVisualizer />

          {/* What is Animancer */}
          <div className="prose">
            <h2>What is Animancer?</h2>
            <p>
              <a href="https://kybernetik.com.au/animancer/" target="_blank" rel="noreferrer">Animancer</a>{" "}
              (by Kybernetik) replaces Unity&apos;s Animator Controller with code-driven animation.
              Instead of a visual state machine graph, you call{" "}
              <code>animancer.Play(clip)</code> directly — giving you full control over
              cross-fades, speeds, events, and layering from C# without any controller assets.
            </p>
            <p>
              Because Animancer bypasses Animator Controllers, Unity&apos;s built-in{" "}
              <code>NetworkAnimator</code> and PurrNet&apos;s <code>NetworkAnimator</code> component
              cannot sync Animancer state. <strong>PurrNetAnimancerSync</strong> fills this gap by
              syncing clip indices and normalized time directly.
            </p>
          </div>

          <Callout type="info" title="Animancer version">
            PurrNetAnimancerSync targets <strong>Animancer 8.x</strong>. If you are using an older
            version, the <code>LinearMixerTransition</code> type and{" "}
            <code>state.IsPlaying</code> setter may differ slightly — check the Animancer upgrade
            guide for your version.
          </Callout>

          {/* Download */}
          <div className="prose">
            <h2>Download &amp; Install</h2>
            <ol>
              <li>Download the scripts below.</li>
              <li>
                Place them anywhere inside your Unity project&apos;s <code>Assets/</code> folder
                (suggested: <code>Assets/PurrNetAnimancer/</code>).
              </li>
              <li>Both scripts compile automatically — no assembly definitions needed.</li>
              <li>Follow the setup steps below.</li>
            </ol>
          </div>

          <div className="not-prose flex flex-wrap gap-3 my-2">
            <DownloadButton
              href="/downloads/PurrNetAnimancerSync.cs"
              label="PurrNetAnimancerSync.cs"
              size="~6 KB"
            />
            <DownloadButton
              href="/downloads/PurrNetAnimancerMixerSync.cs"
              label="PurrNetAnimancerMixerSync.cs"
              size="~3 KB"
            />
          </div>

          {/* Setup */}
          <div className="prose">
            <h2>Setup</h2>
          </div>
          <CodeBlock filename="Setup.cs" language="csharp" code={setupCode} />

          {/* API */}
          <div className="prose">
            <h2>API reference</h2>
          </div>
          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          {/* Basic usage */}
          <div className="prose">
            <h2>Basic usage — clip-based controller</h2>
            <p>
              Replace every <code>animator.SetTrigger()</code> /{" "}
              <code>animator.Play()</code> call with{" "}
              <code>_animSync.Play(clip)</code>. The component handles replication.
            </p>
          </div>
          <CodeBlock filename="AnimancerCharacter.cs" language="csharp" code={basicUsageCode} />

          {/* Mixer */}
          <div className="prose">
            <h2>Blend trees — LinearMixerState sync</h2>
            <p>
              For locomotion blending (walk ↔ run based on speed), use{" "}
              <code>PurrNetAnimancerMixerSync</code> alongside the base component. It syncs
              the mixer parameter via a <code>SyncVar&lt;float&gt;</code> at a configurable
              interval so all peers see smooth blending.
            </p>
          </div>
          <CodeBlock filename="AnimancerMoverController.cs" language="csharp" code={mixerUsageCode} />

          {/* Events */}
          <div className="prose">
            <h2>Animancer events — syncing one-shot completion</h2>
            <p>
              Animancer&apos;s end-events fire only on the local machine. To notify the
              server when a one-shot animation (attack, roll, death) finishes, attach the
              event on the owner and send a ServerRpc — keep gameplay logic out of the
              animation callback.
            </p>
          </div>
          <CodeBlock filename="AnimancerEventSync.cs" language="csharp" code={eventSyncCode} />

          <Callout type="tip" title="Register clips once on the prefab">
            Set <code>_registeredClips</code> on the <strong>prefab</strong>, not in code.
            All runtime instantiations share the same list, guaranteeing that index 2 always
            means &quot;Run&quot; on every peer. If you change the list order at runtime you
            will desync.
          </Callout>

          <Callout type="warning" title="Late-join clients">
            A client that joins mid-session will receive the last-broadcast SyncVar values
            for <code>_clipIndex</code> and <code>_speed</code>. The first{" "}
            <code>BroadcastNormalizedTime</code> RPC (next sync interval) will correct any
            time drift. For critical one-shot clips (death, stagger), consider storing the
            last-played clip in a persistent SyncVar so late joiners can replay it.
          </Callout>

          <Callout type="danger" title="Do not call animancer.Play() directly on non-owners">
            If your character controller also calls <code>_animancer.Play()</code> directly
            (outside of <code>PurrNetAnimancerSync</code>), non-owners will override the
            synced state and break replication. All playback must go through{" "}
            <code>_animSync.Play()</code> on the owner.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Animancer Integration"
          description="PurrNetAnimancerSync คือ component แบบ drop-in ที่ sync ระบบ animation แบบ code-driven ของ Animancer ผ่าน PurrNet — replicate การเล่น clip, normalized time, speed และสถานะ pause ไปยัง peer ทุกคนที่เชื่อมต่ออยู่ โดยไม่ต้องแตะ Animator Controllers"
          badge="Integration"
          href="/docs/animancer-integration"
        >
          <AnimancerSyncVisualizer />

          <div className="prose">
            <h2>Animancer คืออะไร?</h2>
            <p>
              <a href="https://kybernetik.com.au/animancer/" target="_blank" rel="noreferrer">Animancer</a>{" "}
              (โดย Kybernetik) แทนที่ Animator Controller ของ Unity ด้วย animation แบบ code-driven
              แทนที่จะใช้ visual state machine graph คุณเรียก{" "}
              <code>animancer.Play(clip)</code> โดยตรง — ให้คุณควบคุม cross-fades, speeds,
              events และ layering ได้เต็มที่จาก C# โดยไม่ต้องมี controller assets ใดๆ
            </p>
            <p>
              เนื่องจาก Animancer ข้าม Animator Controllers ทำให้ <code>NetworkAnimator</code> ของ Unity
              และ component <code>NetworkAnimator</code> ของ PurrNet ไม่สามารถ sync state ของ Animancer ได้
              <strong>PurrNetAnimancerSync</strong> เติมช่องว่างนี้โดย sync clip indices และ normalized time โดยตรง
            </p>
          </div>

          <Callout type="info" title="เวอร์ชัน Animancer">
            PurrNetAnimancerSync รองรับ <strong>Animancer 8.x</strong> ถ้าคุณใช้เวอร์ชันเก่า
            type <code>LinearMixerTransition</code> และ setter ของ <code>state.IsPlaying</code> อาจแตกต่างเล็กน้อย
            — ตรวจสอบ upgrade guide ของ Animancer สำหรับเวอร์ชันของคุณ
          </Callout>

          <div className="prose">
            <h2>ดาวน์โหลด &amp; ติดตั้ง</h2>
            <ol>
              <li>ดาวน์โหลด scripts ด้านล่าง</li>
              <li>
                วางไว้ที่ใดก็ได้ภายในโฟลเดอร์ <code>Assets/</code> ของ Unity project
                (แนะนำ: <code>Assets/PurrNetAnimancer/</code>)
              </li>
              <li>Scripts ทั้งสองจะ compile โดยอัตโนมัติ — ไม่ต้องมี assembly definitions</li>
              <li>ทำตามขั้นตอน setup ด้านล่าง</li>
            </ol>
          </div>

          <div className="not-prose flex flex-wrap gap-3 my-2">
            <DownloadButton href="/downloads/PurrNetAnimancerSync.cs" label="PurrNetAnimancerSync.cs" size="~6 KB" />
            <DownloadButton href="/downloads/PurrNetAnimancerMixerSync.cs" label="PurrNetAnimancerMixerSync.cs" size="~3 KB" />
          </div>

          <div className="prose">
            <h2>การติดตั้ง</h2>
          </div>
          <CodeBlock filename="Setup.cs" language="csharp" code={setupCode} />

          <div className="prose">
            <h2>API reference</h2>
          </div>
          <div className="not-prose">
            <ParamTable params={apiParamsTH} />
          </div>

          <div className="prose">
            <h2>การใช้งานพื้นฐาน — controller แบบ clip-based</h2>
            <p>
              แทนที่ทุก call ของ <code>animator.SetTrigger()</code> /{" "}
              <code>animator.Play()</code> ด้วย{" "}
              <code>_animSync.Play(clip)</code> Component จัดการ replication ให้เอง
            </p>
          </div>
          <CodeBlock filename="AnimancerCharacter.cs" language="csharp" code={basicUsageCode} />

          <div className="prose">
            <h2>Blend trees — LinearMixerState sync</h2>
            <p>
              สำหรับการ blend locomotion (walk ↔ run ตาม speed) ใช้{" "}
              <code>PurrNetAnimancerMixerSync</code> ร่วมกับ base component มัน sync mixer parameter
              ผ่าน <code>SyncVar&lt;float&gt;</code> ตามช่วงเวลาที่กำหนด ทำให้ peer ทุกคนเห็น blending ที่ smooth
            </p>
          </div>
          <CodeBlock filename="AnimancerMoverController.cs" language="csharp" code={mixerUsageCode} />

          <div className="prose">
            <h2>Animancer events — sync การจบของ one-shot</h2>
            <p>
              end-events ของ Animancer ยิงเฉพาะบนเครื่อง local เท่านั้น เพื่อแจ้ง server เมื่อ
              animation แบบ one-shot (attack, roll, death) จบ ให้ attach event บน owner
              และส่ง ServerRpc — แยก gameplay logic ออกจาก animation callback
            </p>
          </div>
          <CodeBlock filename="AnimancerEventSync.cs" language="csharp" code={eventSyncCode} />

          <Callout type="tip" title="ลงทะเบียน clips ครั้งเดียวบน prefab">
            ตั้งค่า <code>_registeredClips</code> บน <strong>prefab</strong> ไม่ใช่ใน code
            ทุก instance ที่ runtime สร้างจะใช้ list เดียวกัน รับประกันว่า index 2 หมายถึง "Run"
            บนทุก peer เสมอ ถ้าเปลี่ยนลำดับ list ขณะ runtime จะทำให้ desync
          </Callout>

          <Callout type="warning" title="Client ที่เข้าร่วมช้า">
            Client ที่เข้าร่วมกลางเซสชั่นจะได้รับค่า SyncVar ล่าสุดของ <code>_clipIndex</code>{" "}
            และ <code>_speed</code> RPC <code>BroadcastNormalizedTime</code> ครั้งแรก (ช่วง sync interval
            ถัดไป) จะแก้ไข drift ใดๆ สำหรับ clips แบบ one-shot ที่สำคัญ (death, stagger)
            ลองเก็บ clip ที่เล่นล่าสุดใน persistent SyncVar เพื่อให้ late joiners สามารถ replay ได้
          </Callout>

          <Callout type="danger" title="ห้ามเรียก animancer.Play() โดยตรงบน non-owners">
            ถ้า character controller ของคุณเรียก <code>_animancer.Play()</code> โดยตรง
            (นอก <code>PurrNetAnimancerSync</code>) non-owners จะ override สถานะที่ sync มา
            และทำให้ replication เสีย การ playback ทั้งหมดต้องผ่าน <code>_animSync.Play()</code>{" "}
            บน owner เท่านั้น
          </Callout>
        </DocPage>
      }
    />
  );
}
