"use client";

/*
 * VISUAL MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Side-by-side bit comparison: raw C# type width vs BitPacker packed width.
 *
 * Five tabs: Int (0-500), Float (quantized), Bool, Enum (4 values), Struct.
 *
 * Layout:
 *   Left  — "Without BitPacker": squares representing full type width (32 bits).
 *   Right — "With BitPacker":    only the bits actually required.
 *
 * Each square = 1 bit. Colored = used. Gray outline = wasted/unused.
 * Squares fill left-to-right with a stagger animation on tab change.
 * Savings badge shows "X bits saved · Y% smaller".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DataType {
  label: string;
  rawBits: number;
  packedBits: number;
  rawLabel: string;
  packedLabel: string;
  description: string;
  code: string;
}

const dataTypes: DataType[] = [
  {
    label: "Int (0-500)",
    rawBits: 32,
    packedBits: 9,
    rawLabel: "int (32 bits)",
    packedLabel: "9 bits  (2⁹ = 512 ≥ 500)",
    description: "An integer in range 0–500 only needs 9 bits. Without BitPacker the full 32-bit int is sent.",
    code: "packer.PackInt(ref damage, 0, 500);  // 9 bits",
  },
  {
    label: "Float (angle)",
    rawBits: 32,
    packedBits: 8,
    rawLabel: "float (32 bits)",
    packedLabel: "8 bits  (256 steps across range)",
    description: "A direction component from −1..1 quantized to 8 bits gives 256 steps — plenty for smooth movement.",
    code: "packer.PackFloat(ref dx, -1f, 1f, 8);  // 8 bits",
  },
  {
    label: "Bool",
    rawBits: 8,
    packedBits: 1,
    rawLabel: "bool (8 bits / 1 byte)",
    packedLabel: "1 bit",
    description: "A bool in C# occupies a full byte. BitPacker collapses it to 1 bit — 8× smaller.",
    code: "packer.PackBool(ref isCritical);  // 1 bit",
  },
  {
    label: "Enum (4 vals)",
    rawBits: 32,
    packedBits: 2,
    rawLabel: "enum (32 bits by default)",
    packedLabel: "2 bits  (2² = 4 values)",
    description: "An enum with 4 declared values needs only 2 bits. Default C# enum sends 4 bytes.",
    code: "packer.PackEnum(ref location);  // 2 bits",
  },
  {
    label: "Damage Struct",
    rawBits: 48,
    packedBits: 14,
    rawLabel: "~160 raw bits (6 fields)",
    packedLabel: "~46 bits packed  (71% smaller)",
    description: "A struct with damage(int), direction(float×3), 3 bools, 1 enum. Manual IPacked saves ~71%.",
    code: `// Pack: 9 + 8 + 8 + 8 + 1 + 1 + 1 + 2 = 38 bits
packer.PackInt(ref damage, 0, 500);
packer.PackFloat(ref dx, -1f, 1f, 8);
packer.PackFloat(ref dy, -1f, 1f, 8);
packer.PackFloat(ref dz, -1f, 1f, 8);
packer.PackBool(ref isCritical);
packer.PackBool(ref isPenetrating);
packer.PackBool(ref isHeadshot);
packer.PackEnum(ref location);`,
  },
];

// Scale bits to a max of 32 squares for display
const MAX_SQUARES = 32;

function BitRow({
  total,
  filled,
  color,
  label,
}: {
  total: number;
  filled: number;
  color: string;
  label: string;
}) {
  const displayTotal = Math.min(total, MAX_SQUARES);
  const scale = displayTotal / total;
  const displayFilled = Math.round(filled * scale);

  return (
    <div>
      <div className="text-xs text-slate-500 mb-1.5 font-mono">{label}</div>
      <div className="flex flex-wrap gap-0.5">
        {Array.from({ length: displayTotal }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-3.5 h-3.5 rounded-sm border ${
              i < displayFilled
                ? `${color} border-transparent`
                : "bg-transparent border-slate-700"
            }`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.015, duration: 0.2 }}
          />
        ))}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {filled} bit{filled !== 1 ? "s" : ""} used
      </div>
    </div>
  );
}

export function BitPackerVisualizer() {
  const [selected, setSelected] = useState(0);
  const dt = dataTypes[selected];
  const saved = dt.rawBits - dt.packedBits;
  const pct = Math.round((saved / dt.rawBits) * 100);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-700/50 scrollbar-none">
        {dataTypes.map((d, i) => (
          <button
            key={d.label}
            onClick={() => setSelected(i)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              i === selected
                ? "text-violet-400 border-violet-400 bg-slate-800/60"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* Description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={selected}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-slate-300 mb-5 leading-relaxed"
          >
            {dt.description}
          </motion.p>
        </AnimatePresence>

        {/* Bit comparison */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {/* Raw */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-orange-500/20">
              <div className="text-xs font-semibold text-orange-400 mb-3 uppercase tracking-wide">
                Without BitPacker
              </div>
              <BitRow
                total={dt.rawBits}
                filled={dt.rawBits}
                color="bg-orange-500"
                label={dt.rawLabel}
              />
            </div>

            {/* Packed */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wide">
                With BitPacker
              </div>
              <BitRow
                total={dt.rawBits}
                filled={dt.packedBits}
                color="bg-emerald-500"
                label={dt.packedLabel}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Savings badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="mt-4 flex items-center gap-3"
          >
            <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-500/30 rounded-full px-4 py-1.5">
              <span className="text-emerald-400 font-bold text-sm">{saved} bits saved</span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-emerald-300 text-sm font-semibold">{pct}% smaller</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Code snippet */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="mt-4 bg-slate-800/80 rounded-xl border border-slate-700/60 p-4"
          >
            <div className="text-xs text-slate-500 mb-2 font-mono">C# — Pack method</div>
            <pre className="text-xs text-violet-300 font-mono whitespace-pre-wrap">{dt.code}</pre>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
