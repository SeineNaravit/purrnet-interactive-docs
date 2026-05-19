/**
 * Global dictionary of PurrNet API identifiers → tooltip descriptions.
 * The CodeTooltipHydrator scans rendered Shiki code blocks and injects
 * data-tip attributes for any token whose text exactly matches a key here.
 */
export const PURRNET_API: Record<string, string> = {
  // ── Authority flags ────────────────────────────────────────────
  isServer:          "True when this code is running on the server.",
  isClient:          "True when this code is running on a client.",
  isOwner:           "True on the client that currently owns this NetworkIdentity.",
  IsController:      "True if you are the owner, or the server when no owner is assigned. Shorthand for isOwner || isServer.",
  isHost:            "True when this machine is acting as both server and client simultaneously.",
  isActive:          "True after the object is spawned and before it is despawned.",

  // ── Lifecycle callbacks ────────────────────────────────────────
  OnSpawned:         "Called after the object is registered on the network. Use for network-aware initialization.",
  OnDespawned:       "Called before the object is removed from the network. Unsubscribe events here to prevent leaks.",
  OnOwnerChanged:    "Called whenever ownership of this NetworkIdentity changes.",
  OnSpawn:           "NetworkModule lifecycle — called when the parent NetworkIdentity spawns.",
  OnDespawn:         "NetworkModule lifecycle — called before the parent is removed from the network.",

  // ── SyncVar ───────────────────────────────────────────────────
  ownerAuth:         "When true, only the current owner can write this value. The server can always write regardless.",
  sendIntervalInSeconds: "Minimum seconds between sync packets. 0 = sync every tick. Increase to throttle bandwidth.",
  previousValue:     "The value before the most recent change. Useful for computing deltas in onChanged handlers.",
  SetDirty:          "Manually marks this element dirty, forcing a network sync even if the reference didn't change. Required for mutable structs.",

  // ── RPC attributes ─────────────────────────────────────────────
  requireOwnership:  "When true, only the object's current owner can invoke this RPC.",
  runLocally:        "When true, the method also executes on the caller immediately before the network round-trip completes.",
  bufferLast:        "When true, the most recent call is replayed for clients who join after it was invoked.",
  requireServer:     "When true, only the server can invoke this RPC.",
  channel:           "Channel.Reliable guarantees in-order delivery. Channel.Unreliable lowers latency at the cost of possible packet loss.",

  // ── Ownership API ──────────────────────────────────────────────
  GiveOwnership:     "Transfers ownership of this object to the specified PlayerID. Must be called from server code.",
  RemoveOwnership:   "Removes the current owner, making the server the sole authority over this object.",
  owner:             "The PlayerID of the client that currently owns this object. Null if the server is the authority.",

  // ── NetworkTransform ───────────────────────────────────────────
  TeleportTo:        "Instantly moves the object to a new position without interpolation. Use for respawns and portals.",
  interpolationMode: "Controls how remote positions are smoothed: Interpolate (smooth), Extrapolate (predictive), or None (snap).",

  // ── NetworkModule ─────────────────────────────────────────────
  identity:          "Reference to the parent NetworkIdentity this module is attached to.",

  // ── Timer ─────────────────────────────────────────────────────
  onExpired:         "Fired on all clients when the timer reaches zero.",
  normalizedProgress:"Progress from 1.0 (full) to 0.0 (expired). Useful for driving progress bars.",

  // ── Broadcasts ────────────────────────────────────────────────
  Subscribe:         "Register a handler for incoming broadcast messages of this type.",
  Unsubscribe:       "Remove a previously registered broadcast handler.",
  BroadcastAll:      "Send a broadcast to every connected client.",
  SendToServer:      "Send a broadcast from a client to the server only.",

  // ── Authentication ────────────────────────────────────────────
  GetClientPayload:  "Runs on the client. Build and return the credentials object to send to the server.",
  ValidateClientPayload: "Runs on the server. Inspect the payload and return Accept() or Deny(reason).",

  // ── PlayerID / Player registry ─────────────────────────────────
  PlayerID:          "Unique identifier assigned to each connected client by the server.",
  localPlayer:       "Static accessor for the local player instance. Returns null if not yet spawned.",
  allPlayers:        "Read-only list of every currently spawned player, sorted by join order.",
  playerID:          "The PlayerID assigned to this player object.",

  // ── Common patterns ───────────────────────────────────────────
  networkManager:    "Reference to the active PurrNet NetworkManager instance.",
  networkRules:      "The active NetworkRules asset that controls spawn/despawn/RPC authority.",
};
