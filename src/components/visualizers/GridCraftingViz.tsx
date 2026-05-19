"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive grid showing host-world placement and per-player progress.
 *
 * Left — Item palette: select a placeable item (1×1 or 2×1).
 * Center — 8×5 grid: click to place selected item. Multi-cell items (2×1)
 *   occupy two adjacent cells. Right-click / second-click on occupied cell
 *   removes the item. Occupied cells show a colored block with item name.
 * Right — "Host World" panel: shows synced state + "New / Returning Player"
 *   indicator with a join simulation button.
 *
 * Items: Wood (1×1 brown), Stone (1×1 gray), Sofa (2×1 orange), Table (2×1 teal).
 * Placement broadcast simulated via "SyncDictionary updated" badge on place/remove.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid, Database, User, UserPlus } from "lucide-react";

const COLS = 8;
const ROWS = 5;

interface Item {
  id: number;
  name: string;
  w: number; // grid width (1 or 2)
  h: number; // grid height (1 or 2)
  color: string;
  border: string;
  text: string;
}

const ITEMS: Item[] = [
  { id: 1, name: "Wood",  w: 1, h: 1, color: "bg-amber-800/70",  border: "border-amber-600", text: "text-amber-200" },
  { id: 2, name: "Stone", w: 1, h: 1, color: "bg-slate-500/70",  border: "border-slate-400", text: "text-slate-200" },
  { id: 3, name: "Sofa",  w: 2, h: 1, color: "bg-orange-600/70", border: "border-orange-400", text: "text-orange-100" },
  { id: 4, name: "Table", w: 2, h: 1, color: "bg-teal-700/70",   border: "border-teal-400",   text: "text-teal-100" },
];

type GridCell = { itemId: number; anchor: boolean } | null;

function cellKey(col: number, row: number) { return row * COLS + col; }

export function GridCraftingViz() {
  const [selectedItem, setSelectedItem] = useState<Item>(ITEMS[0]);
  const [grid, setGrid] = useState<Record<number, GridCell>>({});
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [playerMode, setPlayerMode] = useState<"new" | "returning">("returning");

  const flashSync = (msg: string) => {
    setLastSync(msg);
    setTimeout(() => setLastSync(null), 1500);
  };

  const handleCellClick = (col: number, row: number) => {
    const key = cellKey(col, row);
    const existing = grid[key];

    if (existing) {
      // Remove — find all cells this item occupies
      setGrid((prev) => {
        const next = { ...prev };
        Object.entries(next).forEach(([k, v]) => {
          if (v && (Number(k) === key || (v.itemId === existing.itemId && !v.anchor))) {
            delete next[Number(k)];
          }
        });
        // Find anchor and remove its row
        Object.entries(next).forEach(([k, v]) => {
          if (v && v.itemId === existing.itemId) delete next[Number(k)];
        });
        return next;
      });
      flashSync(`SyncDictionary: remove (${col},${row})`);
      return;
    }

    const item = selectedItem;
    // Validate all cells are free
    const cells: [number, number][] = [];
    for (let dc = 0; dc < item.w; dc++) {
      for (let dr = 0; dr < item.h; dr++) {
        const c = col + dc, r = row + dr;
        if (c >= COLS || r >= ROWS) return;
        if (grid[cellKey(c, r)]) return;
        cells.push([c, r]);
      }
    }

    const stamp = Date.now();
    setGrid((prev) => {
      const next = { ...prev };
      cells.forEach(([c, r], i) => {
        next[cellKey(c, r)] = { itemId: stamp, anchor: i === 0 };
      });
      return next;
    });
    flashSync(`SyncDictionary: place ${item.name} (${col},${row})`);
  };

  const itemCount = Object.values(grid).filter((v) => v?.anchor).length;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
      <div className="border-b border-slate-700/50 px-5 py-3 flex items-center gap-3">
        <Grid className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Grid World — Host Synced</span>
        <div className="ml-auto flex items-center gap-2">
          <AnimatePresence>
            {lastSync && (
              <motion.span
                key={lastSync}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-emerald-300 bg-emerald-900/40 border border-emerald-500/30 rounded-full px-2 py-0.5 font-mono"
              >
                {lastSync}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-xs text-slate-600">{itemCount} placed</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Palette */}
        <div className="flex md:flex-col gap-2 md:w-28 shrink-0">
          <div className="text-xs text-slate-500 mb-1 hidden md:block">Item palette</div>
          {ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-all text-xs ${
                selectedItem.id === item.id
                  ? `${item.border} ${item.color} ${item.text}`
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              <div className={`flex gap-0.5`}>
                {Array.from({ length: item.w }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-sm ${item.color} border ${item.border}`} />
                ))}
              </div>
              <span>{item.name}</span>
              <span className="text-slate-500">{item.w}×{item.h}</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-x-auto">
          <div
            className="inline-grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${COLS}, 36px)` }}
          >
            {Array.from({ length: ROWS }).map((_, row) =>
              Array.from({ length: COLS }).map((_, col) => {
                const key = cellKey(col, row);
                const cell = grid[key];
                const item = cell ? ITEMS.find((it) => {
                  // find item by checking dimensions against anchor
                  const anchorKey = Object.entries(grid).find(([, v]) => v?.itemId === cell.itemId && v?.anchor)?.[0];
                  if (!anchorKey) return false;
                  return it.id <= 4; // just check any item — we match by anchor below
                }) : null;

                // Simpler: find item by matching grid content
                const matchedItem = cell
                  ? ITEMS.find((it) => {
                      const anchorEntry = Object.entries(grid).find(
                        ([, v]) => v?.itemId === cell.itemId && v?.anchor
                      );
                      if (!anchorEntry) return false;
                      const anchorCol = Number(anchorEntry[0]) % COLS;
                      const anchorRow = Math.floor(Number(anchorEntry[0]) / COLS);
                      return col >= anchorCol && col < anchorCol + it.w &&
                             row >= anchorRow && row < anchorRow + it.h;
                    })
                  : null;

                return (
                  <motion.div
                    key={key}
                    onClick={() => handleCellClick(col, row)}
                    whileTap={{ scale: 0.92 }}
                    className={`w-9 h-9 rounded-sm border cursor-pointer flex items-center justify-center transition-colors ${
                      cell
                        ? `${matchedItem?.color ?? "bg-slate-600/60"} ${matchedItem?.border ?? "border-slate-500"}`
                        : "bg-slate-800/40 border-slate-700/50 hover:border-slate-500 hover:bg-slate-700/40"
                    }`}
                  >
                    {cell?.anchor && (
                      <span className={`text-[9px] font-bold leading-none ${matchedItem?.text ?? "text-white"}`}>
                        {matchedItem?.name?.slice(0, 2) ?? ""}
                      </span>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
          <div className="text-xs text-slate-600 mt-2">Click to place · Click occupied cell to remove</div>
        </div>

        {/* Host info panel */}
        <div className="md:w-36 shrink-0 space-y-3">
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-slate-400 font-semibold">Host World</span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Grid: <span className="text-slate-300">{COLS}×{ROWS}</span></div>
              <div>Items: <span className="text-emerald-400">{itemCount}</span></div>
              <div className="text-slate-600 text-[10px]">SyncDictionary&lt;Vector2Int,int&gt;</div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <User className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-slate-400 font-semibold">Player</span>
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setPlayerMode("returning")}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  playerMode === "returning"
                    ? "bg-blue-900/40 border-blue-500/40 text-blue-300"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                Returning
              </button>
              <button
                onClick={() => setPlayerMode("new")}
                className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                  playerMode === "new"
                    ? "bg-violet-900/40 border-violet-500/40 text-violet-300"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                <UserPlus className="w-2.5 h-2.5" />
                New
              </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-600">
              {playerMode === "returning"
                ? "Loads saved progress from host"
                : "Starts fresh on this world"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
