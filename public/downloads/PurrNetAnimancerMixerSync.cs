// PurrNetAnimancerMixerSync.cs
// ────────────────────────────────────────────────────────────────────────────
// Extends PurrNetAnimancerSync to synchronize a 1-D LinearMixerState parameter
// (equivalent to a Unity Blend Tree) across all peers.
//
// Usage:
//   1. Add this component alongside PurrNetAnimancerSync on the same prefab.
//   2. Assign your LinearMixerTransition asset to _mixerTransition.
//   3. Call PlayMixer(parameter) from the owner to blend and sync.
//      e.g. PlayMixer(moveSpeed) in your movement controller every frame.
// ────────────────────────────────────────────────────────────────────────────

using Animancer;
using PurrNet;
using UnityEngine;

/// <summary>
/// Synchronizes the float parameter of an Animancer LinearMixerState over PurrNet.
/// Attach alongside PurrNetAnimancerSync on the same GameObject.
/// </summary>
[RequireComponent(typeof(PurrNetAnimancerSync))]
[AddComponentMenu("PurrNet/Animancer Mixer Sync")]
public class PurrNetAnimancerMixerSync : NetworkBehaviour
{
    // ── Inspector ─────────────────────────────────────────────────────────────

    [Tooltip("The LinearMixerTransition asset (Animancer) to play and sync.\n" +
             "Create via Assets > Create > Animancer > Mixer Transition > Linear.")]
    [SerializeField] private LinearMixerTransition _mixerTransition;

    [Tooltip("Seconds between parameter broadcasts. Lower = smoother but more traffic.")]
    [SerializeField, Range(0.016f, 0.5f)] private float _syncInterval = 0.05f;

    [Tooltip("Minimum parameter change before a broadcast is sent (reduces redundant traffic).")]
    [SerializeField, Range(0.001f, 0.1f)] private float _changeThreshold = 0.01f;

    // ── Network state ─────────────────────────────────────────────────────────

    private SyncVar<float> _parameter = new(0f, ownerAuth: true);

    // ── Private ───────────────────────────────────────────────────────────────

    private AnimancerComponent  _animancer;
    private LinearMixerState    _mixerState;
    private float               _syncTimer;
    private float               _lastSentParameter;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override void OnSpawned()
    {
        _animancer = GetComponent<AnimancerComponent>();
        _parameter.onChanged += OnParameterChanged;
    }

    private void Update()
    {
        if (!isOwner || _mixerState == null) return;

        _syncTimer += Time.deltaTime;
        if (_syncTimer < _syncInterval) return;
        _syncTimer = 0f;

        float current = _mixerState.Parameter;
        if (Mathf.Abs(current - _lastSentParameter) > _changeThreshold)
        {
            _parameter.value = current;
            _lastSentParameter = current;
        }
    }

    // ── Owner API ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Start playing the mixer and set its blending parameter (owner only).
    /// Call every frame with your movement speed / blend value.
    /// </summary>
    /// <param name="parameter">
    /// Value along the mixer's parameter axis (matches the Animancer Inspector thresholds).
    /// </param>
    public void PlayMixer(float parameter)
    {
        if (!isOwner) return;

        // Ensure the mixer is playing
        if (_mixerState == null || !_animancer.IsPlaying(_mixerTransition))
            _mixerState = _animancer.Play(_mixerTransition) as LinearMixerState;

        if (_mixerState == null) return;

        _mixerState.Parameter = parameter;
    }

    /// <summary>
    /// Manually set the parameter without replaying the mixer (e.g. from Update).
    /// Call this every frame if the mixer is already playing.
    /// </summary>
    public void SetParameter(float parameter)
    {
        if (!isOwner || _mixerState == null) return;
        _mixerState.Parameter = parameter;
    }

    // ── SyncVar callback ──────────────────────────────────────────────────────

    private void OnParameterChanged(float _, float newParam)
    {
        if (isOwner) return;

        // Lazily start the mixer on the observer side
        if (_mixerState == null || !_animancer.IsPlaying(_mixerTransition))
            _mixerState = _animancer.Play(_mixerTransition) as LinearMixerState;

        if (_mixerState != null)
            _mixerState.Parameter = newParam;
    }
}
