// PurrNetAnimancerSync.cs
// ────────────────────────────────────────────────────────────────────────────
// Drop-in PurrNet integration for Animancer by Kybernetik.
//
// Requirements:
//   - PurrNet       (any version that supports SyncVar + ObserversRpc)
//   - Animancer     8.x (https://kybernetik.com.au/animancer/)
//
// Setup:
//   1. Add this component to your character prefab alongside AnimancerComponent.
//   2. Populate _registeredClips with every AnimationClip you want to play.
//      The ORDER must be identical on every peer — it is the network key.
//   3. From the owner's controller, call Play(index) or Play(clip).
//      Non-owners follow automatically via SyncVar + periodic RPC.
// ────────────────────────────────────────────────────────────────────────────

using System;
using Animancer;
using PurrNet;
using UnityEngine;

/// <summary>
/// Synchronizes an AnimancerComponent over a PurrNet network session.
/// </summary>
[RequireComponent(typeof(AnimancerComponent))]
[AddComponentMenu("PurrNet/Animancer Sync")]
public class PurrNetAnimancerSync : NetworkBehaviour
{
    // ── Inspector ─────────────────────────────────────────────────────────────

    [Tooltip("Every clip that may be played over the network.\n" +
             "The order must be identical on all peers — index is the network key.")]
    [SerializeField] private AnimationClip[] _registeredClips = Array.Empty<AnimationClip>();

    [Header("Sync Settings")]
    [Tooltip("Seconds between periodic normalized-time broadcasts (owner → observers).")]
    [SerializeField, Range(0.05f, 1f)] private float _syncInterval = 0.1f;

    [Tooltip("Normalized-time drift that triggers a correction lerp on observers.")]
    [SerializeField, Range(0.01f, 0.5f)] private float _correctionThreshold = 0.05f;

    [Tooltip("Lerp speed used to close the drift gap (units of normalized time / second).")]
    [SerializeField, Range(1f, 30f)] private float _correctionSpeed = 12f;

    // ── Network state (server-authoritative) ──────────────────────────────────

    /// <summary>Index into _registeredClips. −1 = nothing playing.</summary>
    private SyncVar<int>   _clipIndex    = new(-1,    ownerAuth: true);
    private SyncVar<float> _fadeDuration = new(0.25f, ownerAuth: true);
    private SyncVar<float> _speed        = new(1f,    ownerAuth: true);
    private SyncVar<bool>  _paused       = new(false, ownerAuth: true);

    // ── Private ───────────────────────────────────────────────────────────────

    private AnimancerComponent _animancer;
    private AnimancerState     _currentState;    // local reference to playing state
    private float              _syncTimer;
    private float              _remoteNT;         // latest normalized time from RPC

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override void OnSpawned()
    {
        _animancer = GetComponent<AnimancerComponent>();

        _clipIndex.onChanged += OnClipIndexChanged;
        _speed.onChanged     += OnSpeedChanged;
        _paused.onChanged    += OnPausedChanged;
    }

    private void Update()
    {
        if (isOwner)
            OwnerTick();
        else
            ObserverTick();
    }

    // ── Owner tick ────────────────────────────────────────────────────────────

    private void OwnerTick()
    {
        if (_currentState == null) return;

        _syncTimer += Time.deltaTime;
        if (_syncTimer < _syncInterval) return;
        _syncTimer = 0f;

        BroadcastNormalizedTime(_clipIndex.value, _currentState.NormalizedTime);
    }

    // ── Observer tick ─────────────────────────────────────────────────────────

    private void ObserverTick()
    {
        if (_currentState == null) return;

        float drift = _currentState.NormalizedTime - _remoteNT;
        if (Mathf.Abs(drift) > _correctionThreshold)
        {
            _currentState.NormalizedTime = Mathf.MoveTowards(
                _currentState.NormalizedTime,
                _remoteNT,
                _correctionSpeed * Time.deltaTime);
        }
    }

    // ── Owner API ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Play a registered clip by index on all connected peers.
    /// Only the owner may call this.
    /// </summary>
    /// <param name="index">Index in _registeredClips.</param>
    /// <param name="fadeDuration">Cross-fade duration in seconds.</param>
    public void Play(int index, float fadeDuration = 0.25f)
    {
        if (!isOwner)
        {
            Debug.LogWarning("[PurrNetAnimancerSync] Only the owner can call Play().", this);
            return;
        }

        if ((uint)index >= (uint)_registeredClips.Length)
        {
            Debug.LogError($"[PurrNetAnimancerSync] Clip index {index} out of range (0–{_registeredClips.Length - 1}).", this);
            return;
        }

        _fadeDuration.value = fadeDuration;
        _clipIndex.value    = index;

        // Play locally with no round-trip delay
        _currentState = PlayLocally(index, fadeDuration, 0f);

        // Push start position to observers immediately
        BroadcastNormalizedTime(index, 0f);
    }

    /// <summary>
    /// Play by AnimationClip reference on all peers.
    /// The clip must be present in _registeredClips.
    /// </summary>
    public void Play(AnimationClip clip, float fadeDuration = 0.25f)
    {
        int idx = Array.IndexOf(_registeredClips, clip);
        if (idx < 0)
        {
            Debug.LogWarning($"[PurrNetAnimancerSync] '{clip.name}' is not in _registeredClips. " +
                             "Add it to the list on the prefab.", this);
            return;
        }
        Play(idx, fadeDuration);
    }

    /// <summary>Set playback speed on all peers (owner only).</summary>
    public void SetSpeed(float speed) { if (isOwner) _speed.value = speed; }

    /// <summary>Pause the animation on all peers (owner only).</summary>
    public void Pause()  { if (isOwner) _paused.value = true;  }

    /// <summary>Resume the animation on all peers (owner only).</summary>
    public void Resume() { if (isOwner) _paused.value = false; }

    /// <summary>Name of the currently playing registered clip, or "None".</summary>
    public string CurrentClipName =>
        (_clipIndex.value >= 0 && _clipIndex.value < _registeredClips.Length)
            ? _registeredClips[_clipIndex.value].name
            : "None";

    // ── SyncVar callbacks (all non-owner peers) ────────────────────────────────

    private void OnClipIndexChanged(int _, int newIndex)
    {
        if (isOwner) return;
        _currentState = PlayLocally(newIndex, _fadeDuration.value, _remoteNT);
    }

    private void OnSpeedChanged(float _, float newSpeed)
    {
        if (isOwner || _currentState == null) return;
        _currentState.Speed = newSpeed;
    }

    private void OnPausedChanged(bool _, bool paused)
    {
        if (isOwner || _currentState == null) return;
        _currentState.IsPlaying = !paused;
    }

    // ── RPC ───────────────────────────────────────────────────────────────────

    /// <summary>
    /// Sent periodically by the owner so all observers can correct drift.
    /// </summary>
    [ObserversRpc(runLocally: false)]
    private void BroadcastNormalizedTime(int clipIndex, float normalizedTime)
    {
        _remoteNT = normalizedTime;

        // Also correct immediately if the clip mismatches (late-join fix)
        if (_currentState != null && _clipIndex.value == clipIndex)
        {
            float drift = Mathf.Abs(_currentState.NormalizedTime - normalizedTime);
            if (drift > _correctionThreshold * 3f)
                _currentState.NormalizedTime = normalizedTime;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AnimancerState PlayLocally(int index, float fade, float startNT)
    {
        if ((uint)index >= (uint)_registeredClips.Length) return null;

        AnimancerState state = _animancer.Play(_registeredClips[index], fade);
        state.NormalizedTime = startNT;
        state.Speed          = _speed.value;
        return state;
    }
}
