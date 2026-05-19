"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-layer rendering to guarantee labels are always readable:
 *
 *   Layer 1 – SVG (z=0, pointer-events:none)
 *     All edge strokes + arrowhead markers.
 *     Lines pass BEHIND node cards naturally.
 *
 *   Layer 2 – Node cards (z=10, HTML divs)
 *     Hover target. Spring-scale on hover.
 *
 *   Layer 3 – Edge labels (z=20, HTML spans, pointer-events:none)
 *     Absolutely positioned at the bezier point `labelT` (default 0.5).
 *     For pairs with two edges between the same nodes, labelT=0.3 pushes
 *     each label toward its source node → guaranteed separation.
 *
 * Bidirectional event edges (subscribe + fire) are a single double-headed
 * arrow to eliminate redundant per-pair edges entirely.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeKind =
  | "gameobject"
  | "networkbehaviour"
  | "monobehaviour"
  | "scriptableobject"
  | "struct"
  | "builtin";

interface MapNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: NodeKind;
  x: number; // % of CW
  y: number; // % of CH
}

type EdgeKind =
  | "syncvar"
  | "serverrpc"
  | "observersrpc"
  | "event"
  | "dataref"
  | "calls";

interface MapEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
  /** Perpendicular offset for bezier control point (positive = left of direction). */
  curve?: number;
  /** t ∈ [0,1] where the label sits along the curve. Default 0.5. */
  labelT?: number;
  /** Draw arrowhead at both ends (for subscription ↔ fire pairs). */
  bidirectional?: boolean;
}

interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  height: number; // px
}

// ── Colour palettes ───────────────────────────────────────────────────────────

const kindStyle: Record<
  NodeKind,
  { bg: string; border: string; badge: string; badgeText: string; text: string }
> = {
  gameobject:       { bg: "bg-slate-800",   border: "border-slate-500",  badge: "bg-slate-600",   badgeText: "text-slate-200", text: "text-white" },
  networkbehaviour: { bg: "bg-indigo-950",  border: "border-indigo-400", badge: "bg-indigo-500",  badgeText: "text-white",     text: "text-indigo-100" },
  monobehaviour:    { bg: "bg-emerald-950", border: "border-emerald-400",badge: "bg-emerald-500", badgeText: "text-white",     text: "text-emerald-100" },
  scriptableobject: { bg: "bg-amber-950",   border: "border-amber-400",  badge: "bg-amber-500",   badgeText: "text-white",     text: "text-amber-100" },
  struct:           { bg: "bg-purple-950",  border: "border-purple-400", badge: "bg-purple-500",  badgeText: "text-white",     text: "text-purple-100" },
  builtin:          { bg: "bg-cyan-950",    border: "border-cyan-400",   badge: "bg-cyan-600",    badgeText: "text-white",     text: "text-cyan-100" },
};

const kindLabel: Record<NodeKind, string> = {
  gameobject:       "GameObject",
  networkbehaviour: "NetworkBehaviour",
  monobehaviour:    "MonoBehaviour",
  scriptableobject: "ScriptableObject",
  struct:           "struct",
  builtin:          "Built-in (PurrNet)",
};

const edgeColor: Record<EdgeKind, string> = {
  syncvar:      "#818cf8",
  serverrpc:    "#f87171",
  observersrpc: "#fb923c",
  event:        "#34d399",
  dataref:      "#fbbf24",
  calls:        "#64748b",
};

const edgeLegend: { kind: EdgeKind; label: string }[] = [
  { kind: "syncvar",      label: "SyncVar" },
  { kind: "serverrpc",    label: "ServerRpc" },
  { kind: "observersrpc", label: "ObserversRpc" },
  { kind: "event",        label: "Event (↔ = subscribe + fire)" },
  { kind: "dataref",      label: "Data reference" },
  { kind: "calls",        label: "Method / component ref" },
];

// ── Map data ──────────────────────────────────────────────────────────────────

const monsterMap: MapData = {
  height: 460,
  nodes: [
    { id: "go",         label: "Monster",           sublabel: "Prefab (GameObject)",  kind: "gameobject",       x: 50, y: 10 },
    { id: "health",     label: "MonsterHealth",     sublabel: "NetworkBehaviour",     kind: "networkbehaviour", x: 50, y: 40 },
    { id: "hiteffect",  label: "MonsterHitEffect",  sublabel: "NetworkBehaviour",     kind: "networkbehaviour", x: 17, y: 73 },
    { id: "controller", label: "MonsterController", sublabel: "NetworkBehaviour",     kind: "networkbehaviour", x: 83, y: 73 },
    { id: "data",       label: "MonsterData",       sublabel: "ScriptableObject",     kind: "scriptableobject", x: 50, y: 91 },
  ],
  edges: [
    { from: "go",         to: "health",     kind: "calls",        label: "has component" },
    { from: "go",         to: "hiteffect",  kind: "calls",        label: "has component" },
    { from: "go",         to: "controller", kind: "calls",        label: "has component" },
    // Bidirectional event: one arrow covers subscribe + fire for hiteffect↔health
    { from: "health",     to: "hiteffect",  kind: "event",        label: "onHealthChanged", curve: 0.3, bidirectional: true },
    // Two edges between health↔controller — labelT:0.3 pushes each label near its source
    { from: "health",     to: "controller", kind: "event",        label: "onDied ↔",        curve: 0.5, labelT: 0.3, bidirectional: true },
    { from: "controller", to: "health",     kind: "serverrpc",    label: "CmdTakeDamage()", curve: -0.2, labelT: 0.3 },
    { from: "health",     to: "data",       kind: "dataref",      label: "[SerializeField]" },
    { from: "hiteffect",  to: "data",       kind: "dataref",      label: "HitColor / Duration", curve: 0.2 },
    { from: "controller", to: "controller", kind: "observersrpc", label: "RpcPlayDeath()" },
  ],
};

const inventoryMap: MapData = {
  height: 520,
  nodes: [
    { id: "go",       label: "Player",          sublabel: "Prefab (GameObject)",    kind: "gameobject",       x: 50, y:  7 },
    { id: "pinv",     label: "PlayerInventory", sublabel: "NetworkBehaviour",       kind: "networkbehaviour", x: 38, y: 32 },
    { id: "item",     label: "InventoryItem",   sublabel: "struct · IPackedAuto",   kind: "struct",           x: 84, y: 32 },
    { id: "slotui",   label: "InventorySlotUI", sublabel: "MonoBehaviour",          kind: "monobehaviour",    x: 12, y: 62 },
    { id: "invui",    label: "InventoryUI",     sublabel: "MonoBehaviour",          kind: "monobehaviour",    x: 60, y: 62 },
    { id: "itemdb",   label: "ItemDatabase",    sublabel: "ScriptableObject",       kind: "scriptableobject", x: 76, y: 87 },
    { id: "itemdata", label: "ItemData",        sublabel: "ScriptableObject",       kind: "scriptableobject", x: 22, y: 87 },
  ],
  edges: [
    { from: "go",     to: "pinv",    kind: "calls",     label: "has component" },
    { from: "go",     to: "slotui",  kind: "calls",     label: "has component", curve: -0.05 },
    { from: "go",     to: "invui",   kind: "calls",     label: "has component", curve:  0.05 },
    { from: "pinv",   to: "item",    kind: "dataref",   label: "SyncList<InventoryItem>" },
    { from: "slotui", to: "pinv",    kind: "serverrpc", label: "CmdMoveItem / CmdEquip" },
    // Single bidirectional arrow replaces two separate subscribe+fire edges
    { from: "pinv",   to: "invui",   kind: "event",     label: "onInventoryChanged", curve: 0.3, bidirectional: true },
    { from: "invui",  to: "slotui",  kind: "calls",     label: "instantiates slots" },
    { from: "slotui", to: "itemdb",  kind: "dataref",   label: "ItemDatabase.Get()" },
    { from: "itemdb", to: "itemdata",kind: "dataref",   label: "lookup → ItemData" },
    { from: "pinv",   to: "itemdb",  kind: "dataref",   label: "server validation", curve: 0.22 },
  ],
};

const topDownMap: MapData = {
  height: 460,
  nodes: [
    { id: "go",       label: "Player",             sublabel: "Prefab (GameObject)", kind: "gameobject",       x: 50, y: 10 },
    { id: "movement", label: "TopDownMovement",    sublabel: "NetworkBehaviour",   kind: "networkbehaviour", x: 50, y: 40 },
    { id: "input",    label: "PlayerInputHandler", sublabel: "MonoBehaviour",      kind: "monobehaviour",    x: 15, y: 72 },
    { id: "animator", label: "TopDownAnimator",    sublabel: "MonoBehaviour",      kind: "monobehaviour",    x: 82, y: 72 },
    { id: "chardata", label: "CharacterData",      sublabel: "ScriptableObject",   kind: "scriptableobject", x: 50, y: 91 },
  ],
  edges: [
    { from: "go",       to: "movement", kind: "calls",     label: "has component" },
    { from: "go",       to: "input",    kind: "calls",     label: "has component" },
    { from: "go",       to: "animator", kind: "calls",     label: "has component" },
    { from: "input",    to: "movement", kind: "serverrpc", label: "CmdMove / CmdStop / CmdJump" },
    { from: "movement", to: "animator", kind: "event",     label: "onMovementChanged", curve: 0.35, bidirectional: true },
    { from: "movement", to: "chardata", kind: "dataref",   label: "MoveSpeed / JumpForce" },
    { from: "animator", to: "chardata", kind: "dataref",   label: "animation thresholds", curve: 0.22 },
  ],
};

const thirdPersonMap: MapData = {
  height: 500,
  nodes: [
    { id: "go",       label: "Player",              sublabel: "Prefab (GameObject)", kind: "gameobject",       x: 50, y:  8 },
    { id: "movement", label: "ThirdPersonMovement", sublabel: "NetworkBehaviour",   kind: "networkbehaviour", x: 30, y: 35 },
    { id: "nettf",    label: "NetworkTransform",    sublabel: "Built-in (PurrNet)", kind: "builtin",          x: 74, y: 35 },
    { id: "input",    label: "PlayerInputHandler",  sublabel: "MonoBehaviour",      kind: "monobehaviour",    x: 12, y: 66 },
    { id: "animator", label: "ThirdPersonAnimator", sublabel: "MonoBehaviour",      kind: "monobehaviour",    x: 82, y: 66 },
    { id: "chardata", label: "ThirdPersonData",     sublabel: "ScriptableObject",   kind: "scriptableobject", x: 50, y: 90 },
  ],
  edges: [
    { from: "go",       to: "movement", kind: "calls",        label: "has component" },
    { from: "go",       to: "nettf",    kind: "calls",        label: "has component" },
    { from: "go",       to: "input",    kind: "calls",        label: "has component" },
    { from: "go",       to: "animator", kind: "calls",        label: "has component" },
    { from: "input",    to: "movement", kind: "serverrpc",    label: "CmdMove / CmdJump" },
    { from: "movement", to: "nettf",    kind: "calls",        label: "drives position & rotation" },
    { from: "movement", to: "animator", kind: "event",        label: "onStateChanged", curve: 0.35, bidirectional: true },
    { from: "movement", to: "chardata", kind: "dataref",      label: "WalkSpeed / RunSpeed" },
    { from: "animator", to: "chardata", kind: "dataref",      label: "blend thresholds", curve: 0.22 },
    { from: "nettf",    to: "nettf",    kind: "observersrpc", label: "auto-syncs all clients" },
  ],
};

const cityPhaseMap: MapData = {
  height: 540,
  nodes: [
    { id: "go",    label: "City Scene",      sublabel: "Manager GameObject",  kind: "gameobject",       x: 50, y:  8 },
    { id: "gsm",   label: "GameStateManager",sublabel: "NetworkBehaviour",    kind: "networkbehaviour", x: 50, y: 34 },
    { id: "dsel",  label: "DungeonSelector", sublabel: "NetworkBehaviour",    kind: "networkbehaviour", x: 17, y: 64 },
    { id: "vc",    label: "VoteController",  sublabel: "NetworkBehaviour",    kind: "networkbehaviour", x: 82, y: 64 },
    { id: "mapui", label: "MapUI",           sublabel: "MonoBehaviour",       kind: "monobehaviour",    x: 17, y: 90 },
    { id: "dd",    label: "DungeonData",     sublabel: "ScriptableObject",    kind: "scriptableobject", x: 82, y: 90 },
  ],
  edges: [
    { from: "go",    to: "gsm",   kind: "calls",        label: "has component" },
    { from: "go",    to: "dsel",  kind: "calls",        label: "has component", curve: -0.1 },
    { from: "go",    to: "vc",    kind: "calls",        label: "has component", curve:  0.1 },
    { from: "mapui", to: "dsel",  kind: "serverrpc",    label: "CmdProposeDungeon()" },
    { from: "dsel",  to: "vc",    kind: "calls",        label: "StartVote()" },
    { from: "dsel",  to: "dd",    kind: "dataref",      label: "dungeon config" },
    { from: "vc",    to: "mapui", kind: "event",        label: "onVoteChanged", curve: 0.35, bidirectional: true },
    { from: "vc",    to: "gsm",   kind: "calls",        label: "vote pass → ChangeState()", curve: 0.22 },
    { from: "gsm",   to: "mapui", kind: "event",        label: "onStateChanged", curve: 0.32, bidirectional: true },
    { from: "gsm",   to: "gsm",   kind: "observersrpc", label: "RpcLoadScene()" },
  ],
};

const dungeonPhaseMap: MapData = {
  height: 540,
  nodes: [
    { id: "go",  label: "Dungeon Scene",       sublabel: "Manager GameObject", kind: "gameobject",       x: 50, y:  8 },
    { id: "dsm", label: "DungeonStateManager", sublabel: "NetworkBehaviour",  kind: "networkbehaviour", x: 50, y: 32 },
    { id: "vc",  label: "VoteController",      sublabel: "NetworkBehaviour",  kind: "networkbehaviour", x: 14, y: 62 },
    { id: "dui", label: "DungeonUI",           sublabel: "MonoBehaviour",     kind: "monobehaviour",    x: 50, y: 62 },
    { id: "fc",  label: "FightController",     sublabel: "NetworkBehaviour",  kind: "networkbehaviour", x: 86, y: 62 },
    { id: "dd",  label: "DungeonData",         sublabel: "ScriptableObject",  kind: "scriptableobject", x: 50, y: 90 },
  ],
  edges: [
    { from: "go",  to: "dsm",  kind: "calls",        label: "has component" },
    { from: "go",  to: "vc",   kind: "calls",        label: "has component", curve: -0.2 },
    { from: "go",  to: "fc",   kind: "calls",        label: "has component", curve:  0.2 },
    { from: "dsm", to: "vc",   kind: "event",        label: "vote sessions", curve: 0.3, bidirectional: true },
    { from: "dsm", to: "dui",  kind: "event",        label: "onPhaseChanged", curve: 0.2, bidirectional: true },
    { from: "vc",  to: "dui",  kind: "event",        label: "onVoteChanged", curve: 0.2, bidirectional: true },
    // Two edges dsm↔fc: labelT:0.3 pushes each label near its source node
    { from: "dsm", to: "fc",   kind: "calls",        label: "activate Fight phase", curve:  0.32, labelT: 0.3 },
    { from: "fc",  to: "dsm",  kind: "serverrpc",    label: "CmdReportFightEnd()", curve: -0.32, labelT: 0.3 },
    { from: "dsm", to: "dd",   kind: "dataref",      label: "phase config" },
    { from: "fc",  to: "dd",   kind: "dataref",      label: "fight config", curve: 0.2 },
  ],
};

// ── Constants & geometry ──────────────────────────────────────────────────────

const CW = 680;
const NODE_W = 148;
const NODE_H = 54;

function px(pct: number, total: number) {
  return (pct / 100) * total;
}

interface EdgeGeom {
  d: string;
  labelX: number;
  labelY: number;
}

/** Quadratic bezier path + label position at parameter t. */
function edgeGeometry(
  fromX: number, fromY: number,
  toX:   number, toY:   number,
  curve  = 0,
  labelT = 0.5,
): EdgeGeom {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const cx = (fromX + toX) / 2 + dy * curve;
  const cy = (fromY + toY) / 2 - dx * curve;

  const t  = labelT;
  const mt = 1 - t;
  return {
    d:      `M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`,
    labelX: mt * mt * fromX + 2 * mt * t * cx + t * t * toX,
    labelY: mt * mt * fromY + 2 * mt * t * cy + t * t * toY,
  };
}

/** Offset the start/end of an edge to the node boundary using the straight-line angle. */
function nodeEdgePoints(
  from: { x: number; y: number },
  to:   { x: number; y: number },
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    fx: from.x + cos * (NODE_W / 2 + 2),
    fy: from.y + sin * (NODE_H / 2 + 2),
    tx: to.x   - cos * (NODE_W / 2 + 7),
    ty: to.y   - sin * (NODE_H / 2 + 7),
  };
}

// ── Pre-computation ───────────────────────────────────────────────────────────

interface ComputedEdge {
  edge:    MapEdge;
  color:   string;
  d:       string;
  labelX:  number;
  labelY:  number;
  isSelf:  boolean;
  dimmed:  boolean;
  isActive:boolean;
}

function computeEdges(
  data:    MapData,
  CH:      number,
  nodePos: Record<string, { x: number; y: number }>,
  hovered: string | null,
): ComputedEdge[] {
  return data.edges.map((edge) => {
    const from = nodePos[edge.from];
    const to   = nodePos[edge.to];
    const isSelf   = edge.from === edge.to;
    const color    = edgeColor[edge.kind];
    const isActive = hovered === edge.from || hovered === edge.to;
    const dimmed   = hovered !== null && !isActive;

    let d = "";
    let labelX = 0;
    let labelY = 0;

    if (!from || !to) return { edge, color, d, labelX, labelY, isSelf, dimmed, isActive };

    if (isSelf) {
      // Arc loop above the node
      const ox = from.x + NODE_W / 2 - 10;
      const oy = from.y - NODE_H / 2;
      const r  = 24;
      d      = `M ${ox} ${oy} a ${r} ${r} 0 1 1 0.01 0`;
      labelX = ox + r * 1.6;
      labelY = oy - r * 0.7;
    } else {
      const ep  = nodeEdgePoints(from, to);
      const geom = edgeGeometry(ep.fx, ep.fy, ep.tx, ep.ty, edge.curve ?? 0, edge.labelT ?? 0.5);
      d      = geom.d;
      labelX = geom.labelX;
      labelY = geom.labelY;
    }

    return { edge, color, d, labelX, labelY, isSelf, dimmed, isActive };
  });
}

// ── MindMap component ─────────────────────────────────────────────────────────

interface MindMapProps {
  data:   MapData;
  title?: string;
}

function MindMap({ data, title }: MindMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const CH = data.height;

  const nodePos = Object.fromEntries(
    data.nodes.map((n) => [n.id, { x: px(n.x, CW), y: px(n.y, CH) }]),
  );

  const edges = computeEdges(data, CH, nodePos, hovered);

  const connectedTo = new Set<string>();
  if (hovered) {
    data.edges.forEach((e) => {
      if (e.from === hovered) connectedTo.add(e.to);
      if (e.to   === hovered) connectedTo.add(e.from);
    });
  }

  // Unique colours for SVG marker defs
  const markerColors = [...new Set(Object.values(edgeColor))];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 overflow-x-auto">
      {title && (
        <p className="text-[11px] text-slate-500 mb-3">
          {title} —{" "}
          <span className="text-slate-400">hover a node to highlight its connections</span>
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key="map"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="relative"
          style={{ width: CW, height: CH }}
        >
          {/* ── Layer 1: SVG paths (z=0) ────────────────────────────────── */}
          <svg
            width={CW}
            height={CH}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0, overflow: "visible" }}
          >
            <defs>
              {/* Unidirectional markers */}
              {markerColors.map((c) => (
                <marker
                  key={`uni-${c}`}
                  id={`arr-${c.slice(1)}`}
                  markerWidth="7" markerHeight="7"
                  refX="5" refY="3.5"
                  orient="auto"
                >
                  <path d="M0,0 L0,7 L7,3.5 z" fill={c} />
                </marker>
              ))}
              {/* Bidirectional markers (auto-start-reverse flips it at the source end) */}
              {markerColors.map((c) => (
                <marker
                  key={`bi-${c}`}
                  id={`arr-bi-${c.slice(1)}`}
                  markerWidth="7" markerHeight="7"
                  refX="5" refY="3.5"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L0,7 L7,3.5 z" fill={c} />
                </marker>
              ))}
            </defs>

            {edges.map((e, i) => {
              if (!e.d) return null;
              const markerId = e.edge.bidirectional
                ? `arr-bi-${e.color.slice(1)}`
                : `arr-${e.color.slice(1)}`;
              return (
                <path
                  key={i}
                  d={e.d}
                  fill="none"
                  stroke={e.color}
                  strokeWidth={e.isActive ? 2.2 : 1.6}
                  strokeDasharray={e.edge.kind === "calls" ? "5 3" : undefined}
                  markerEnd={`url(#${markerId})`}
                  markerStart={e.edge.bidirectional ? `url(#${markerId})` : undefined}
                  opacity={e.dimmed ? 0.07 : 0.88}
                />
              );
            })}
          </svg>

          {/* ── Layer 2: Node cards (z=10) ──────────────────────────────── */}
          {data.nodes.map((node) => {
            const s  = kindStyle[node.kind];
            const cx = px(node.x, CW);
            const cy = px(node.y, CH);
            const isActive = hovered === node.id;
            const dimmed   = hovered !== null && !isActive && !connectedTo.has(node.id);

            return (
              <motion.div
                key={node.id}
                className={`absolute select-none cursor-pointer rounded-lg border-2 ${s.bg} ${s.border} px-3 py-2 shadow-lg`}
                style={{
                  left:    cx - NODE_W / 2,
                  top:     cy - NODE_H / 2,
                  width:   NODE_W,
                  opacity: dimmed ? 0.18 : 1,
                  zIndex:  10,
                }}
                animate={{ scale: isActive ? 1.07 : 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className={`text-[8px] font-bold uppercase tracking-wider rounded px-1 mb-0.5 inline-block ${s.badge} ${s.badgeText}`}
                >
                  {kindLabel[node.kind]}
                </div>
                <div className={`text-[11px] font-semibold leading-tight ${s.text}`}>
                  {node.label}
                </div>
                {node.sublabel && (
                  <div className="text-[9px] text-slate-400 leading-tight mt-0.5">
                    {node.sublabel}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* ── Layer 3: Edge labels (z=20) — always on top ─────────────── */}
          {edges.map((e, i) => {
            if (!e.d) return null;
            return (
              <div
                key={`lbl-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left:      e.labelX,
                  top:       e.labelY,
                  transform: "translate(-50%, -50%)",
                  zIndex:    20,
                  opacity:   e.dimmed ? 0.07 : 1,
                }}
              >
                <span
                  style={{
                    display:         "inline-block",
                    fontSize:        9,
                    fontFamily:      "ui-monospace, monospace",
                    lineHeight:      1.4,
                    color:           e.color,
                    backgroundColor: "#0f172a",
                    border:          `0.75px solid ${e.color}80`,
                    padding:         "1px 5px",
                    borderRadius:    3,
                    whiteSpace:      "nowrap",
                  }}
                >
                  {e.edge.label}
                </span>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-700/60">
        {edgeLegend.map(({ kind, label }) => (
          <div key={kind} className="flex items-center gap-1.5">
            <div className="w-5 h-[2px] rounded" style={{ backgroundColor: edgeColor[kind] }} />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {(Object.keys(kindLabel) as NodeKind[])
          .filter((k) => k !== "gameobject")
          .map((kind) => (
            <div key={kind} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-sm border ${kindStyle[kind].border} ${kindStyle[kind].bg}`} />
              <span className="text-[10px] text-slate-400">{kindLabel[kind]}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Named exports ─────────────────────────────────────────────────────────────

export function MonsterStatusMindMap() {
  return <MindMap data={monsterMap} title="Monster Status System — component map" />;
}

export function InventoryMindMap() {
  return <MindMap data={inventoryMap} title="Inventory System — component map" />;
}

export function TopDownMindMap() {
  return <MindMap data={topDownMap} title="Top Down Controller — component map" />;
}

export function ThirdPersonMindMap() {
  return <MindMap data={thirdPersonMap} title="3rd Person Controller — component map" />;
}

export function CityPhaseMindMap() {
  return <MindMap data={cityPhaseMap} title="City Phase — component map" />;
}

export function DungeonPhaseMindMap() {
  return <MindMap data={dungeonPhaseMap} title="Dungeon Phase — component map" />;
}
