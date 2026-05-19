import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { MonsterStatusMindMap } from "@/components/visualizers/ComponentMindMapVisualizer";

export const metadata = { title: "Monster Status System" };

// ---------------------------------------------------------------------------
// API table — split into EN and TH variants
// ---------------------------------------------------------------------------

const apiParamsEN = [
  {
    name: "TakeDamage(int amount)",
    type: "[ServerRpc] void",
    description:
      "Subtracts amount from health. Validated server-side — callers don't need ownership.",
  },
  {
    name: "Heal(int amount)",
    type: "[ServerRpc] void",
    description:
      "Restores health up to MaxHealth. Has no effect if the monster is dead.",
  },
  {
    name: "CurrentHealth",
    type: "int",
    description:
      "Read-only current HP. Backed by a SyncVar<int> so all clients see the same value.",
  },
  {
    name: "MaxHealth",
    type: "int",
    description:
      "The max HP defined in MonsterData. Does not change at runtime.",
  },
  {
    name: "IsDead",
    type: "bool",
    description: "True once health reaches zero. Backed by SyncVar<bool>.",
  },
  {
    name: "onHealthChanged",
    type: "event Action<int,int>",
    description:
      "Fires on all clients when HP changes. Parameters: (currentHP, maxHP).",
  },
  {
    name: "onDied",
    type: "event Action",
    description: "Fires on all clients when the monster dies.",
  },
];

const apiParamsTH = [
  {
    name: "TakeDamage(int amount)",
    type: "[ServerRpc] void",
    description:
      "ลด health ลง amount ตรวจสอบฝั่ง server — ผู้เรียกไม่ต้องเป็นเจ้าของ object",
  },
  {
    name: "Heal(int amount)",
    type: "[ServerRpc] void",
    description:
      "ฟื้นฟู health สูงสุดถึง MaxHealth ไม่มีผลถ้ามอนสเตอร์ตายแล้ว",
  },
  {
    name: "CurrentHealth",
    type: "int",
    description:
      "HP ปัจจุบันแบบ read-only รองรับโดย SyncVar<int> ทำให้ clients ทุกตัวเห็นค่าเดียวกัน",
  },
  {
    name: "MaxHealth",
    type: "int",
    description:
      "HP สูงสุดที่กำหนดใน MonsterData ไม่เปลี่ยนแปลงขณะ runtime",
  },
  {
    name: "IsDead",
    type: "bool",
    description: "True เมื่อ health ถึงศูนย์ รองรับโดย SyncVar<bool>",
  },
  {
    name: "onHealthChanged",
    type: "event Action<int,int>",
    description:
      "ทำงานบน clients ทั้งหมดเมื่อ HP เปลี่ยน พารามิเตอร์: (currentHP, maxHP)",
  },
  {
    name: "onDied",
    type: "event Action",
    description: "ทำงานบน clients ทั้งหมดเมื่อมอนสเตอร์ตาย",
  },
];

// ---------------------------------------------------------------------------
// C# code blocks — IDENTICAL in both EN and TH versions
// ---------------------------------------------------------------------------

const monsterDataCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// Immutable configuration data for a single monster type.
/// Create one asset per monster via Assets → Create → PurrNet → MonsterData.
/// </summary>
[CreateAssetMenu(menuName = "PurrNet/MonsterData", fileName = "NewMonsterData")]
public class MonsterData : ScriptableObject
{
    /// <summary>Display name shown in UI and debug logs.</summary>
    [field: SerializeField] public string MonsterName { get; private set; } = "Monster";

    /// <summary>Starting and maximum hit-points for this monster type.</summary>
    [field: SerializeField] public int MaxHealth { get; private set; } = 100;

    /// <summary>
    /// How long (in seconds) the hit-flash colour is shown before
    /// reverting to the normal colour.
    /// </summary>
    [field: SerializeField] public float FlashDuration { get; private set; } = 0.15f;

    /// <summary>Renderer colour applied for one FlashDuration when hit.</summary>
    [field: SerializeField] public Color HitColor { get; private set; } = Color.red;

    /// <summary>Renderer colour when the monster is alive and not flashing.</summary>
    [field: SerializeField] public Color NormalColor { get; private set; } = Color.white;
}`;

const monsterHealthCode = `using PurrNet;
using System;
using UnityEngine;

/// <summary>
/// Owns all networked health state for one monster instance.
/// Server is the sole writer; every client reads via SyncVar properties.
/// </summary>
public class MonsterHealth : NetworkBehaviour
{
    [SerializeField] private MonsterData _data;

    // SyncVar<T> automatically replicates value changes to all clients.
    private SyncVar<int>  _health = new(0);
    private SyncVar<bool> _isDead = new(false);

    // -----------------------------------------------------------------------
    // Public events — subscribe from MonsterHitEffect, MonsterController, UI
    // -----------------------------------------------------------------------

    /// <summary>
    /// Raised on ALL clients when HP changes.
    /// Parameters: (currentHP, maxHP)
    /// </summary>
    public event Action<int, int> onHealthChanged;

    /// <summary>Raised on ALL clients the moment the monster dies.</summary>
    public event Action onDied;

    // -----------------------------------------------------------------------
    // Public read-only properties
    // -----------------------------------------------------------------------

    /// <summary>Current hit-points. Backed by a SyncVar — always in sync.</summary>
    public int  CurrentHealth => _health.value;

    /// <summary>Maximum HP from MonsterData. Constant after spawn.</summary>
    public int  MaxHealth     => _data.maxHealth;

    /// <summary>True once health reaches zero.</summary>
    public bool IsDead        => _isDead.value;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        // Subscribe to SyncVar change callbacks so every client raises events.
        _health.onChanged += HandleHealthChanged;
        _isDead.onChanged += HandleDeathChanged;

        // Only the server sets the initial value.
        if (asServer)
            _health.value = _data.maxHealth;
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);

        _health.onChanged -= HandleHealthChanged;
        _isDead.onChanged -= HandleDeathChanged;
    }

    // -----------------------------------------------------------------------
    // ServerRpcs — callable by any game object, no ownership required
    // -----------------------------------------------------------------------

    /// <summary>
    /// Deals damage to this monster. Safe to call from traps, AoE,
    /// projectiles, or other players — server validates everything.
    /// </summary>
    [ServerRpc(requireOwnership: false)]
    public void CmdTakeDamage(int amount, RPCInfo info = default)
    {
        if (_isDead.value || amount <= 0) return;

        _health.value = Mathf.Max(0, _health.value - amount);

        if (_health.value == 0)
            _isDead.value = true;
    }

    /// <summary>
    /// Heals the monster up to MaxHealth. No-op when already dead.
    /// Useful for regeneration mechanics or a healer enemy type.
    /// </summary>
    [ServerRpc(requireOwnership: false)]
    public void CmdHeal(int amount)
    {
        if (_isDead.value || amount <= 0) return;

        _health.value = Mathf.Min(_data.maxHealth, _health.value + amount);
    }

    // -----------------------------------------------------------------------
    // SyncVar callbacks — run on every client (including host)
    // -----------------------------------------------------------------------

    private void HandleHealthChanged(int oldHP, int newHP)
    {
        onHealthChanged?.Invoke(newHP, _data.maxHealth);
    }

    private void HandleDeathChanged(bool wasAlive, bool isDead)
    {
        if (isDead)
            onDied?.Invoke();
    }
}`;

const monsterHitEffectCode = `using PurrNet;
using System.Collections;
using UnityEngine;

/// <summary>
/// Pure visual script — flashes all renderers to HitColor when
/// MonsterHealth reports a change, then restores the original colours.
/// No network traffic: driven entirely by the onHealthChanged event.
/// </summary>
public class MonsterHitEffect : NetworkBehaviour
{
    [SerializeField] private MonsterHealth _health;

    /// <summary>All renderers that should flash on hit (body, eyes, etc.).</summary>
    [SerializeField] private Renderer[] _renderers;

    private Color[]   _originalColors;
    private Coroutine _flashCoroutine;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    private void Awake()
    {
        // Cache original colours before any flashing occurs.
        _originalColors = new Color[_renderers.Length];
        for (int i = 0; i < _renderers.Length; i++)
            _originalColors[i] = _renderers[i].material.color;
    }

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        _health.onHealthChanged += HandleHealthChanged;
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        _health.onHealthChanged -= HandleHealthChanged;
    }

    // -----------------------------------------------------------------------
    // Event handler
    // -----------------------------------------------------------------------

    private void HandleHealthChanged(int currentHP, int maxHP)
    {
        // If a flash is already running, restart it so rapid hits all register.
        if (_flashCoroutine != null)
            StopCoroutine(_flashCoroutine);

        _flashCoroutine = StartCoroutine(FlashRoutine());
    }

    // -----------------------------------------------------------------------
    // Flash coroutine
    // -----------------------------------------------------------------------

    private IEnumerator FlashRoutine()
    {
        SetColor(_health.GetComponent<MonsterData>()?.HitColor ?? Color.red);
        yield return new WaitForSeconds(
            _health.GetComponent<MonsterData>()?.FlashDuration ?? 0.15f);
        RestoreColors();
        _flashCoroutine = null;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void SetColor(Color color)
    {
        foreach (var r in _renderers)
            r.material.color = color;
    }

    private void RestoreColors()
    {
        for (int i = 0; i < _renderers.Length; i++)
            _renderers[i].material.color = _originalColors[i];
    }
}`;

const monsterHitEffectImprovedCode = `using PurrNet;
using System.Collections;
using UnityEngine;

/// <summary>
/// Pure visual script — flashes all renderers to HitColor when
/// MonsterHealth reports a change, then restores the original colours.
/// No network traffic: driven entirely by the onHealthChanged event.
/// </summary>
public class MonsterHitEffect : NetworkBehaviour
{
    [SerializeField] private MonsterHealth _health;
    [SerializeField] private MonsterData   _data;   // same asset referenced by MonsterHealth

    /// <summary>All renderers that should flash on hit (body, eyes, etc.).</summary>
    [SerializeField] private Renderer[] _renderers;

    private Color[]   _originalColors;
    private Coroutine _flashCoroutine;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    private void Awake()
    {
        // Cache original colours before any flashing occurs.
        _originalColors = new Color[_renderers.Length];
        for (int i = 0; i < _renderers.Length; i++)
            _originalColors[i] = _renderers[i].material.color;
    }

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);
        _health.onHealthChanged += HandleHealthChanged;
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);
        _health.onHealthChanged -= HandleHealthChanged;
    }

    // -----------------------------------------------------------------------
    // Event handler
    // -----------------------------------------------------------------------

    private void HandleHealthChanged(int currentHP, int maxHP)
    {
        // If a flash is already running, restart it so rapid hits all register.
        if (_flashCoroutine != null)
            StopCoroutine(_flashCoroutine);

        _flashCoroutine = StartCoroutine(FlashRoutine());
    }

    // -----------------------------------------------------------------------
    // Flash coroutine
    // -----------------------------------------------------------------------

    private IEnumerator FlashRoutine()
    {
        SetColor(_data.HitColor);
        yield return new WaitForSeconds(_data.FlashDuration);
        RestoreColors();
        _flashCoroutine = null;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void SetColor(Color color)
    {
        foreach (var r in _renderers)
            r.material.color = color;
    }

    private void RestoreColors()
    {
        for (int i = 0; i < _renderers.Length; i++)
            _renderers[i].material.color = _originalColors[i];
    }
}`;

const monsterControllerCode = `using PurrNet;
using System.Collections;
using UnityEngine;

/// <summary>
/// Wires MonsterHealth, MonsterHitEffect, and the optional health-bar UI
/// together. Handles death: plays a visual effect on all clients, then
/// destroys the monster on the server after a short delay.
/// </summary>
public class MonsterController : NetworkBehaviour
{
    [Header("Components")]
    [SerializeField] private MonsterHealth _health;
    [SerializeField] private MonsterHitEffect _hitEffect;

    /// <summary>
    /// Optional UI health bar. Assign in the Inspector.
    /// MonsterController null-checks before calling it.
    /// </summary>
    [SerializeField] private HealthBarUI _healthBar;

    [SerializeField] private MonsterData _data;

    [Header("Death Settings")]
    [SerializeField] private ParticleSystem _deathParticles;
    [SerializeField] private Renderer[]     _renderers;
    [SerializeField] private float          _destroyDelay = 2f;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    protected override void OnSpawned(bool asServer)
    {
        base.OnSpawned(asServer);

        _health.onHealthChanged += HandleHealthChanged;
        _health.onDied          += HandleDeath;
    }

    protected override void OnDespawned(bool asServer)
    {
        base.OnDespawned(asServer);

        _health.onHealthChanged -= HandleHealthChanged;
        _health.onDied          -= HandleDeath;
    }

    // -----------------------------------------------------------------------
    // Health changed
    // -----------------------------------------------------------------------

    private void HandleHealthChanged(int currentHP, int maxHP)
    {
        // Health bar is optional — safe to leave unassigned in the Inspector.
        _healthBar?.UpdateDisplay(currentHP, maxHP);
    }

    // -----------------------------------------------------------------------
    // Death
    // -----------------------------------------------------------------------

    private void HandleDeath()
    {
        // Play the death visual on every client immediately.
        RpcPlayDeathEffect();

        // Only the server schedules the actual destruction.
        if (isServer)
            StartCoroutine(DestroyAfterDelay(_destroyDelay));
    }

    /// <summary>
    /// Plays particle burst and hides renderers on all clients.
    /// Called automatically by HandleDeath().
    /// </summary>
    [ObserversRpc]
    private void RpcPlayDeathEffect()
    {
        if (_deathParticles != null)
            _deathParticles.Play();

        foreach (var r in _renderers)
            r.enabled = false;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private IEnumerator DestroyAfterDelay(float delay)
    {
        yield return new WaitForSeconds(delay);
        Destroy(gameObject); // PurrNet syncs despawn to all clients
    }
}`;

// HealthBarUI stub so the code block compiles without a real implementation
const healthBarUICode = `using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Minimal health-bar UI helper referenced by MonsterController.
/// Replace the Slider with whatever UI widget your project uses.
/// </summary>
public class HealthBarUI : MonoBehaviour
{
    [SerializeField] private Slider _slider;

    /// <summary>
    /// Updates the bar fill. Called by MonsterController on every HP change.
    /// </summary>
    /// <param name="current">Current hit-points.</param>
    /// <param name="max">Maximum hit-points.</param>
    public void UpdateDisplay(int current, int max)
    {
        if (_slider == null) return;
        _slider.value = max > 0 ? (float)current / max : 0f;
    }
}`;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Monster Status System"
          description="A complete multiplayer monster health system with damage, healing, hit-flash effects, and a controller that wires everything together. Written for junior developers — each script has one clear responsibility."
          badge="Example"
          href="/docs/monster-status"
        >
          {/* ----------------------------------------------------------------
              Overview
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Overview — how the scripts connect</h2>
            <p>
              This example is split into four scripts that each do exactly one job.
              Keeping responsibilities separate makes it easy to read, test, and
              swap parts without touching unrelated code.
            </p>
            <ul>
              <li>
                <strong>MonsterData</strong> — a ScriptableObject that holds configuration
                (max HP, flash colour, flash duration). No logic, just data. Create one asset
                per monster type in your project.
              </li>
              <li>
                <strong>MonsterHealth</strong> — the only script that owns networked state.
                It holds two <code>SyncVar</code> fields (<code>_health</code> and{" "}
                <code>_isDead</code>) and exposes them through events and read-only properties.
                Every other script reacts to its events rather than reading state directly.
              </li>
              <li>
                <strong>MonsterHitEffect</strong> — a pure visual script. It subscribes to
                <code>MonsterHealth.onHealthChanged</code> and flashes the renderer colour for
                a short duration. Zero network traffic — the SyncVar callback already runs
                locally on every client.
              </li>
              <li>
                <strong>MonsterController</strong> — the glue layer. It connects the health
                bar UI, triggers the death effect RPC, and schedules server-side destruction
                after the death animation plays out.
              </li>
            </ul>
            <p>
              The flow for a single hit looks like this:
            </p>
            <ol>
              <li>Any client (player, trap, etc.) calls <code>CmdTakeDamage()</code>.</li>
              <li>The server validates the call and subtracts HP from <code>_health</code>.</li>
              <li>PurrNet replicates the <code>SyncVar</code> change to every client.</li>
              <li>
                <code>onHealthChanged</code> fires on every client — <code>MonsterHitEffect</code>{" "}
                starts the flash coroutine and <code>MonsterController</code> updates the health bar.
              </li>
              <li>If HP reaches zero, <code>onDied</code> fires and the controller handles cleanup.</li>
            </ol>
          </div>

          {/* ----------------------------------------------------------------
              Component Mind Map
          ---------------------------------------------------------------- */}
          <div className="not-prose">
            <MonsterStatusMindMap />
          </div>

          {/* ----------------------------------------------------------------
              Script 1 — MonsterData
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 1 — MonsterData (ScriptableObject)</h2>
            <p>
              <code>MonsterData</code> is a plain Unity ScriptableObject — no networking involved.
              Think of it as a recipe card: it describes what a monster type looks like and how it
              behaves, but it has no runtime state. Creating a separate asset for each monster type
              (Slime, Dragon, Boss, etc.) lets designers tweak values in the Inspector without
              touching any C# code.
            </p>
            <p>
              The <code>[CreateAssetMenu]</code> attribute registers the asset in the{" "}
              <strong>Assets → Create → PurrNet</strong> menu so anyone on the team can make a new
              one without writing code.
            </p>
          </div>

          <CodeBlock filename="MonsterData.cs" language="csharp" code={monsterDataCode} />

          {/* ----------------------------------------------------------------
              Script 2 — MonsterHealth
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 2 — MonsterHealth (Networked)</h2>
            <p>
              <code>MonsterHealth</code> is the heart of the system. It extends{" "}
              <code>NetworkBehaviour</code> so PurrNet manages its lifetime on the network.
            </p>
            <p>
              The two <code>SyncVar</code> fields are the only networked state in the entire example:
            </p>
            <ul>
              <li>
                <code>_health</code> (<code>SyncVar&lt;int&gt;</code>) — the current HP value.
                The server writes it; every client reads the replicated copy.
              </li>
              <li>
                <code>_isDead</code> (<code>SyncVar&lt;bool&gt;</code>) — flips to{" "}
                <code>true</code> once HP hits zero. Separating this flag from the HP value
                makes death checks instant without recalculating on every frame.
              </li>
            </ul>
            <p>
              Two <code>[ServerRpc]</code> methods provide the public interface for damaging and
              healing. Both use <code>requireOwnership: false</code> so any game object — a player
              weapon, an AoE explosion, a trap — can call them without owning the monster.
            </p>
            <p>
              Subscribing to <code>SyncVar.onChanged</code> in <code>OnSpawned</code> (instead of
              <code>Awake</code>) is essential: the network layer is not ready until after spawn.
            </p>
          </div>

          <CodeBlock filename="MonsterHealth.cs" language="csharp" code={monsterHealthCode} />

          {/* ----------------------------------------------------------------
              Script 3 — MonsterHitEffect
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 3 — MonsterHitEffect (Visual Flash)</h2>
            <p>
              This script adds the hit-feedback that makes combat feel responsive. It listens for{" "}
              <code>onHealthChanged</code> and runs a coroutine that briefly changes every
              renderer&apos;s colour to <code>HitColor</code> before restoring the originals.
            </p>
            <p>
              Key design decisions:
            </p>
            <ul>
              <li>
                <strong>No RPCs needed.</strong> Because <code>onHealthChanged</code> is raised by a
                SyncVar callback, it already fires on every connected client. The flash is purely
                local and needs no additional network traffic.
              </li>
              <li>
                <strong>Rapid-hit restart.</strong> If a new hit arrives while the flash coroutine is
                still running, it is stopped and restarted — so players always see feedback for every
                hit, even rapid ones.
              </li>
              <li>
                <strong>Colours cached in Awake.</strong> Caching the original colours once avoids
                reading them from the material on every hit, which would allocate a new{" "}
                <code>Material</code> instance and cause unnecessary garbage.
              </li>
            </ul>
            <p>
              The script references <code>MonsterData</code> directly via its own{" "}
              <code>[SerializeField]</code> field so it can read <code>HitColor</code> and{" "}
              <code>FlashDuration</code> without coupling to <code>MonsterHealth</code>&apos;s
              internals.
            </p>
          </div>

          <CodeBlock
            filename="MonsterHitEffect.cs"
            language="csharp"
            code={monsterHitEffectImprovedCode}
          />

          {/* ----------------------------------------------------------------
              Script 4 — MonsterController
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 4 — MonsterController (Core Connector)</h2>
            <p>
              <code>MonsterController</code> is the coordinator. It does not own any networked state
              — it simply wires the other pieces together and handles the one situation that requires
              a new RPC: the death sequence.
            </p>
            <p>
              When <code>onDied</code> fires it does two things in order:
            </p>
            <ol>
              <li>
                Calls <code>RpcPlayDeathEffect()</code> — an <code>[ObserversRpc]</code> that tells
                every client to play particles and hide renderers at the same moment.
              </li>
              <li>
                On the server only, starts a coroutine that waits for <code>_destroyDelay</code>{" "}
                seconds (giving the death animation time to play) then calls{" "}
                <code>Destroy(gameObject)</code>. PurrNet automatically syncs the despawn to all
                clients.
              </li>
            </ol>
            <p>
              The health bar reference is optional — <code>MonsterController</code> uses{" "}
              <code>_healthBar?.UpdateDisplay()</code> (null-conditional operator) so the prefab
              still works in scenes without a UI canvas.
            </p>
          </div>

          <CodeBlock
            filename="MonsterController.cs"
            language="csharp"
            code={monsterControllerCode}
          />

          <div className="prose">
            <h2>Bonus — HealthBarUI helper</h2>
            <p>
              <code>MonsterController</code> references a <code>HealthBarUI</code> component. Here
              is a minimal implementation using Unity&apos;s built-in <code>Slider</code>. Replace
              it with whatever widget your project uses — just keep the{" "}
              <code>UpdateDisplay(int current, int max)</code> signature.
            </p>
          </div>

          <CodeBlock filename="HealthBarUI.cs" language="csharp" code={healthBarUICode} />

          {/* ----------------------------------------------------------------
              API Reference
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>API Reference</h2>
            <p>
              All public surface area of <code>MonsterHealth</code> — the only networked script
              in the system.
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          {/* ----------------------------------------------------------------
              Scene Setup
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Scene Setup</h2>
            <p>Follow these steps to get the system running in a new scene:</p>
            <ol>
              <li>
                Create a <strong>MonsterData</strong> asset:{" "}
                <em>Assets → Create → PurrNet → MonsterData</em>. Set{" "}
                <code>MonsterName</code>, <code>MaxHealth</code>, <code>HitColor</code>, and{" "}
                <code>FlashDuration</code>.
              </li>
              <li>
                Create a monster <strong>prefab</strong> with a <code>NetworkIdentity</code>{" "}
                component (or it will inherit one from <code>NetworkBehaviour</code>). Add all four
                scripts: <code>MonsterHealth</code>, <code>MonsterHitEffect</code>,{" "}
                <code>MonsterController</code>, and optionally <code>HealthBarUI</code>.
              </li>
              <li>
                In the Inspector, drag the <strong>MonsterData</strong> asset into the{" "}
                <code>_data</code> field on both <code>MonsterHealth</code> and{" "}
                <code>MonsterHitEffect</code>.
              </li>
              <li>
                Assign the <code>_renderers</code> array on <code>MonsterHitEffect</code> to the
                renderers you want to flash (drag them from the hierarchy).
              </li>
              <li>
                Register the prefab in{" "}
                <strong>NetworkManager → Network Prefabs</strong>. PurrNet will not replicate objects
                whose prefabs are not registered.
              </li>
              <li>
                To spawn the monster at runtime, call{" "}
                <code>Instantiate(monsterPrefab, position, rotation)</code> on the server.
                PurrNet handles replication automatically.
              </li>
            </ol>
          </div>

          {/* ----------------------------------------------------------------
              Callouts
          ---------------------------------------------------------------- */}
          <Callout
            type="tip"
            title="requireOwnership: false on TakeDamage"
          >
            Any game object can deal damage — traps, AoE explosions, other players — without
            needing to own the monster. The server validates everything, so there is no security
            risk and no awkward ownership transfers just to subtract a few hit-points.
          </Callout>

          <Callout
            type="warning"
            title="Subscribe in OnSpawned, unsubscribe in OnDespawned"
          >
            Never subscribe to <code>SyncVar.onChanged</code> in <code>Awake</code> — the network
            layer is not ready yet and the callback will never fire. Always pair every{" "}
            <code>+=</code> in <code>OnSpawned</code> with a matching <code>-=</code> in{" "}
            <code>OnDespawned</code> to prevent memory leaks when the monster is destroyed and
            pooled objects are recycled.
          </Callout>

          <Callout
            type="info"
            title="Scene Setup checklist"
          >
            Add all four scripts to the monster prefab. Assign MonsterData in the Inspector on
            both <code>MonsterHealth</code> and <code>MonsterHitEffect</code>. Register the prefab
            in <strong>NetworkManager → Network Prefabs</strong>. Spawn with{" "}
            <code>Instantiate()</code> on the server — PurrNet replicates automatically.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="ระบบสถานะมอนสเตอร์"
          description="ระบบ health มอนสเตอร์แบบ multiplayer ที่สมบูรณ์ พร้อม damage, healing, เอฟเฟกต์กระพริบเมื่อโดนโจมตี และ controller ที่เชื่อมต่อทุกอย่างเข้าด้วยกัน เขียนสำหรับ junior developers — แต่ละ script มีหน้าที่ที่ชัดเจนเพียงอย่างเดียว"
          badge="Example"
          href="/docs/monster-status"
        >
          {/* ----------------------------------------------------------------
              ภาพรวม
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>ภาพรวม — วิธีที่ script เชื่อมต่อกัน</h2>
            <p>
              ตัวอย่างนี้แบ่งออกเป็นสี่ script ที่แต่ละตัวทำงานเพียงอย่างเดียว การแยกความรับผิดชอบออกจากกัน
              ทำให้อ่าน ทดสอบ และสลับส่วนต่างๆ ได้ง่ายโดยไม่ต้องแตะโค้ดที่ไม่เกี่ยวข้อง
            </p>
            <ul>
              <li>
                <strong>MonsterData</strong> — ScriptableObject ที่เก็บการตั้งค่า (HP สูงสุด สีกระพริบ
                ระยะเวลากระพริบ) ไม่มี logic แค่ข้อมูล สร้าง asset หนึ่งชุดต่อมอนสเตอร์แต่ละประเภทในโปรเจกต์
              </li>
              <li>
                <strong>MonsterHealth</strong> — script เดียวที่เป็นเจ้าของ networked state มี{" "}
                <code>SyncVar</code> สองตัว (<code>_health</code> และ <code>_isDead</code>) และ
                เปิดเผยผ่าน events และ properties แบบ read-only script อื่นๆ ทั้งหมดตอบสนองต่อ events
                แทนที่จะอ่าน state โดยตรง
              </li>
              <li>
                <strong>MonsterHitEffect</strong> — script visual ล้วนๆ subscribe{" "}
                <code>MonsterHealth.onHealthChanged</code> และทำให้สี renderer กระพริบในช่วงเวลาสั้น
                ไม่มี network traffic — SyncVar callback ทำงานในเครื่องบน client ทุกตัวอยู่แล้ว
              </li>
              <li>
                <strong>MonsterController</strong> — ชั้น glue เชื่อมต่อ health bar UI กับ UI,
                trigger death effect RPC และกำหนดเวลาทำลายฝั่ง server หลังจาก animation ตายเล่นจบ
              </li>
            </ul>
            <p>
              การไหลสำหรับการโจมตีครั้งเดียวมีลักษณะดังนี้:
            </p>
            <ol>
              <li>client ใดก็ได้ (ผู้เล่น กับดัก ฯลฯ) เรียก <code>CmdTakeDamage()</code></li>
              <li>server ตรวจสอบการเรียกและลบ HP ออกจาก <code>_health</code></li>
              <li>PurrNet replicates การเปลี่ยนแปลง <code>SyncVar</code> ไปยัง client ทุกตัว</li>
              <li>
                <code>onHealthChanged</code> fire บน client ทุกตัว — <code>MonsterHitEffect</code>{" "}
                เริ่ม flash coroutine และ <code>MonsterController</code> อัปเดต health bar
              </li>
              <li>ถ้า HP ถึงศูนย์ <code>onDied</code> fire และ controller จัดการ cleanup</li>
            </ol>
          </div>

          {/* ----------------------------------------------------------------
              Script 1 — MonsterData
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 1 — MonsterData (ScriptableObject)</h2>
            <p>
              <code>MonsterData</code> คือ Unity ScriptableObject ธรรมดา — ไม่มี networking เกี่ยวข้อง
              คิดว่าเป็นเหมือนบัตรสูตรอาหาร: อธิบายว่ามอนสเตอร์ประเภทหนึ่งมีลักษณะอย่างไร แต่ไม่มี runtime
              state การสร้าง asset แยกกันสำหรับมอนสเตอร์แต่ละประเภท (สไลม์, มังกร, บอส ฯลฯ) ทำให้
              designers ปรับแต่งค่าใน Inspector โดยไม่ต้องแตะโค้ด C# เลย
            </p>
            <p>
              attribute <code>[CreateAssetMenu]</code> ลงทะเบียน asset ในเมนู{" "}
              <strong>Assets → Create → PurrNet</strong> ทำให้ทุกคนในทีมสามารถสร้างอันใหม่ได้โดยไม่ต้องเขียนโค้ด
            </p>
          </div>

          <CodeBlock filename="MonsterData.cs" language="csharp" code={monsterDataCode} />

          {/* ----------------------------------------------------------------
              Script 2 — MonsterHealth
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 2 — MonsterHealth (ระบบ Network)</h2>
            <p>
              <code>MonsterHealth</code> คือหัวใจของระบบ มัน extend <code>NetworkBehaviour</code>{" "}
              ทำให้ PurrNet จัดการ lifetime ของมันบนเครือข่าย
            </p>
            <p>
              field <code>SyncVar</code> สองตัวคือ networked state เพียงอย่างเดียวในทั้งตัวอย่าง:
            </p>
            <ul>
              <li>
                <code>_health</code> (<code>SyncVar&lt;int&gt;</code>) — ค่า HP ปัจจุบัน server
                เขียน ทุก client อ่านสำเนาที่ replicated
              </li>
              <li>
                <code>_isDead</code> (<code>SyncVar&lt;bool&gt;</code>) — เปลี่ยนเป็น{" "}
                <code>true</code> เมื่อ HP ถึงศูนย์ การแยก flag นี้ออกจากค่า HP ทำให้การตรวจสอบ
                death ทันทีโดยไม่ต้องคำนวณซ้ำทุก frame
              </li>
            </ul>
            <p>
              method <code>[ServerRpc]</code> สองตัวให้ interface สาธารณะสำหรับ damage และ heal
              ทั้งคู่ใช้ <code>requireOwnership: false</code> ดังนั้น game object ใดก็ได้ — อาวุธผู้เล่น,
              การระเบิด AoE, กับดัก — สามารถเรียกได้โดยไม่ต้องเป็นเจ้าของมอนสเตอร์
            </p>
            <p>
              การ subscribe ไปยัง <code>SyncVar.onChanged</code> ใน <code>OnSpawned</code>{" "}
              (แทน <code>Awake</code>) เป็นสิ่งสำคัญ: network layer ยังไม่พร้อมจนกว่าจะ spawn
            </p>
          </div>

          <CodeBlock filename="MonsterHealth.cs" language="csharp" code={monsterHealthCode} />

          {/* ----------------------------------------------------------------
              Script 3 — MonsterHitEffect
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 3 — MonsterHitEffect (เอฟเฟกต์กระพริบ)</h2>
            <p>
              script นี้เพิ่ม hit-feedback ที่ทำให้การต่อสู้รู้สึก responsive มันฟัง{" "}
              <code>onHealthChanged</code> และรัน coroutine ที่เปลี่ยนสีของ renderer ทุกตัวชั่วคราวเป็น{" "}
              <code>HitColor</code> ก่อนที่จะ restore สีเดิม
            </p>
            <p>
              การตัดสินใจออกแบบหลัก:
            </p>
            <ul>
              <li>
                <strong>ไม่ต้อง RPC</strong> เพราะ <code>onHealthChanged</code> ถูก raise โดย
                SyncVar callback จึง fire บน client ที่เชื่อมต่อทุกตัวอยู่แล้ว การกระพริบเป็นแบบ
                local และไม่ต้อง network traffic เพิ่มเติม
              </li>
              <li>
                <strong>Rapid-hit restart</strong> ถ้าการโจมตีใหม่มาถึงขณะที่ flash coroutine
                ยังรันอยู่ มันจะหยุดและ restart ใหม่ — ดังนั้นผู้เล่นจะเห็น feedback สำหรับการโจมตีทุกครั้ง
                แม้การโจมตีอย่างรวดเร็ว
              </li>
              <li>
                <strong>Cache สีใน Awake</strong> การ cache สีเดิมครั้งเดียวหลีกเลี่ยงการอ่านจาก
                material ทุกครั้งที่โดนโจมตี ซึ่งจะ allocate instance <code>Material</code> ใหม่
                และทำให้เกิด garbage ที่ไม่จำเป็น
              </li>
            </ul>
            <p>
              script อ้างอิง <code>MonsterData</code> โดยตรงผ่าน field <code>[SerializeField]</code>{" "}
              ของตัวเองเพื่ออ่าน <code>HitColor</code> และ <code>FlashDuration</code> โดยไม่ต้อง
              coupling กับ internals ของ <code>MonsterHealth</code>
            </p>
          </div>

          <CodeBlock
            filename="MonsterHitEffect.cs"
            language="csharp"
            code={monsterHitEffectImprovedCode}
          />

          {/* ----------------------------------------------------------------
              Script 4 — MonsterController
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>Script 4 — MonsterController (ตัวเชื่อมต่อหลัก)</h2>
            <p>
              <code>MonsterController</code> คือ coordinator มันไม่ได้เป็นเจ้าของ networked state
              ใดๆ — เพียงแค่เชื่อมต่อส่วนอื่นๆ เข้าด้วยกันและจัดการสถานการณ์หนึ่งที่ต้องการ RPC ใหม่:
              ลำดับ death
            </p>
            <p>
              เมื่อ <code>onDied</code> fire มันทำสองสิ่งตามลำดับ:
            </p>
            <ol>
              <li>
                เรียก <code>RpcPlayDeathEffect()</code> — <code>[ObserversRpc]</code> ที่บอก
                client ทุกตัวให้เล่น particles และซ่อน renderers ในเวลาเดียวกัน
              </li>
              <li>
                บน server เท่านั้น เริ่ม coroutine ที่รอ <code>_destroyDelay</code> วินาที
                (ให้เวลา animation ตายเล่น) จากนั้นเรียก <code>Destroy(gameObject)</code>{" "}
                PurrNet sync การ despawn ไปยัง client ทุกตัวโดยอัตโนมัติ
              </li>
            </ol>
            <p>
              การอ้างอิง health bar เป็น optional — <code>MonsterController</code> ใช้{" "}
              <code>_healthBar?.UpdateDisplay()</code> (null-conditional operator) ดังนั้น prefab
              ยังคงทำงานใน scene ที่ไม่มี UI canvas
            </p>
          </div>

          <CodeBlock
            filename="MonsterController.cs"
            language="csharp"
            code={monsterControllerCode}
          />

          <div className="prose">
            <h2>โบนัส — HealthBarUI helper</h2>
            <p>
              <code>MonsterController</code> อ้างอิง component <code>HealthBarUI</code> นี่คือ
              implementation ขั้นต่ำที่ใช้ <code>Slider</code> ของ Unity แทนที่ด้วย widget
              ใดก็ตามที่โปรเจกต์ของคุณใช้ — เพียงแค่รักษา signature{" "}
              <code>UpdateDisplay(int current, int max)</code>
            </p>
          </div>

          <CodeBlock filename="HealthBarUI.cs" language="csharp" code={healthBarUICode} />

          {/* ----------------------------------------------------------------
              อ้างอิง API
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>อ้างอิง API</h2>
            <p>
              surface area สาธารณะทั้งหมดของ <code>MonsterHealth</code> — script ที่มีการ network
              เพียงตัวเดียวในระบบ
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsTH} />
          </div>

          {/* ----------------------------------------------------------------
              การตั้งค่า Scene
          ---------------------------------------------------------------- */}
          <div className="prose">
            <h2>การตั้งค่า Scene</h2>
            <p>ทำตามขั้นตอนเหล่านี้เพื่อให้ระบบทำงานใน scene ใหม่:</p>
            <ol>
              <li>
                สร้าง asset <strong>MonsterData</strong>:{" "}
                <em>Assets → Create → PurrNet → MonsterData</em> ตั้งค่า{" "}
                <code>MonsterName</code>, <code>MaxHealth</code>, <code>HitColor</code> และ{" "}
                <code>FlashDuration</code>
              </li>
              <li>
                สร้าง <strong>prefab</strong> มอนสเตอร์พร้อม component <code>NetworkIdentity</code>{" "}
                (หรือจะรับมาจาก <code>NetworkBehaviour</code>) เพิ่ม script ทั้งสี่:{" "}
                <code>MonsterHealth</code>, <code>MonsterHitEffect</code>,{" "}
                <code>MonsterController</code> และ <code>HealthBarUI</code> (ไม่บังคับ)
              </li>
              <li>
                ใน Inspector ลาก asset <strong>MonsterData</strong> ไปยัง field <code>_data</code>{" "}
                บนทั้ง <code>MonsterHealth</code> และ <code>MonsterHitEffect</code>
              </li>
              <li>
                กำหนด array <code>_renderers</code> บน <code>MonsterHitEffect</code> ให้กับ
                renderers ที่ต้องการให้กระพริบ (ลากจาก hierarchy)
              </li>
              <li>
                ลงทะเบียน prefab ใน{" "}
                <strong>NetworkManager → Network Prefabs</strong> PurrNet จะไม่ replicate
                objects ที่ prefab ไม่ได้ลงทะเบียน
              </li>
              <li>
                เพื่อ spawn มอนสเตอร์ขณะ runtime เรียก{" "}
                <code>Instantiate(monsterPrefab, position, rotation)</code> บน server PurrNet
                จัดการ replication โดยอัตโนมัติ
              </li>
            </ol>
          </div>

          {/* ----------------------------------------------------------------
              Callouts
          ---------------------------------------------------------------- */}
          <Callout
            type="tip"
            title="requireOwnership: false บน TakeDamage"
          >
            game object ใดก็ได้สามารถโจมตีได้ — กับดัก, การระเบิด AoE, ผู้เล่นอื่น — โดยไม่ต้องเป็นเจ้าของ
            มอนสเตอร์ Server ตรวจสอบทุกอย่าง ดังนั้นจึงไม่มีความเสี่ยงด้านความปลอดภัยและไม่ต้องมีการโอน
            ownership ที่ยุ่งยากเพียงเพื่อลบ HP สองสามจุด
          </Callout>

          <Callout
            type="warning"
            title="Subscribe ใน OnSpawned, unsubscribe ใน OnDespawned"
          >
            อย่า subscribe ไปยัง <code>SyncVar.onChanged</code> ใน <code>Awake</code> — network
            layer ยังไม่พร้อมและ callback จะไม่ทำงาน จับคู่ทุก <code>+=</code> ใน{" "}
            <code>OnSpawned</code> กับ <code>-=</code> ที่ตรงกันใน <code>OnDespawned</code>{" "}
            เสมอเพื่อป้องกัน memory leaks เมื่อมอนสเตอร์ถูกทำลายและ pooled objects ถูก recycle
          </Callout>

          <Callout
            type="info"
            title="การตั้งค่า Scene"
          >
            เพิ่มสคริปต์ทั้ง 4 ตัวบน monster prefab กำหนด MonsterData ใน Inspector บนทั้ง{" "}
            <code>MonsterHealth</code> และ <code>MonsterHitEffect</code> ลงทะเบียน prefab ใน{" "}
            <strong>NetworkManager → Network Prefabs</strong> Spawn ด้วย{" "}
            <code>Instantiate()</code> บน server — PurrNet replicates โดยอัตโนมัติ
          </Callout>
        </DocPage>
      }
    />
  );
}
