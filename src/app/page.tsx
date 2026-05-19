"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Layers, GitBranch, RefreshCw, Radio } from "lucide-react";

const features = [
  { icon: Zap, label: "Zero Boilerplate", desc: "Instantiate() and Destroy() just work. No special spawn calls." },
  { icon: Shield, label: "Flexible Authority", desc: "Switch between client auth and server auth via Network Rules — no code changes." },
  { icon: Layers, label: "Modular Design", desc: "NetworkModules enable reusable network logic independent of MonoBehaviours." },
  { icon: GitBranch, label: "Per-Component Ownership", desc: "A single GameObject can have different owners per NetworkIdentity component." },
  { icon: RefreshCw, label: "Rich Sync Types", desc: "SyncVar, SyncList, SyncDictionary, SyncEvent, SyncTimer, SyncInput." },
  { icon: Radio, label: "RPC Superset", desc: "ServerRpc, ObserversRpc, TargetRpc — plus awaitable, generic, and static variants." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-400/30 bg-purple-500/8 text-purple-400 text-sm font-medium mb-6">
          <span>🐾</span> Free & Open Source · MIT License
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-5">
          Learn PurrNet
          <br />
          <span className="text-primary">visually &amp; fast.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
          Interactive animations for every command. Understand how multiplayer networking works—
          not just the API, but the <em>why</em> and <em>when</em>.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/docs/introduction"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Start Learning <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs/server-rpc"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border hover:bg-muted transition-colors font-medium"
          >
            Jump to RPCs
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="mt-16 mb-16 w-full max-w-lg rounded-2xl border border-border bg-card/60 p-6"
      >
        <MiniNetworkDiagram />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
            className="text-left p-5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <f.icon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold text-sm mb-1">{f.label}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MiniNetworkDiagram() {
  const pktVariants = {
    hidden: { opacity: 0 },
    visible: (custom: { from: number[]; to: number[]; delay: number }) => ({
      opacity: [0, 1, 1, 0],
      cx: [custom.from[0], custom.to[0]],
      cy: [custom.from[1], custom.to[1]],
      transition: { duration: 1, repeat: Infinity, repeatDelay: 2, delay: custom.delay, ease: "easeInOut" },
    }),
  };

  return (
    <svg viewBox="0 0 440 180" className="w-full" aria-hidden="true">
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="hsl(270 60% 65%)" />
        </marker>
      </defs>
      <rect x="180" y="20" width="80" height="50" rx="10" fill="hsl(270 60% 65% / 0.12)" stroke="hsl(270 60% 65%)" strokeWidth="1.5" />
      <text x="220" y="49" textAnchor="middle" fill="hsl(270 60% 65%)" fontSize="12" fontWeight="700">SERVER</text>
      <rect x="20" y="110" width="80" height="50" rx="10" fill="hsl(300 60% 65% / 0.1)" stroke="hsl(300 60% 65%)" strokeWidth="1.5" />
      <text x="60" y="139" textAnchor="middle" fill="hsl(300 60% 65%)" fontSize="11" fontWeight="600">Client A</text>
      <rect x="340" y="110" width="80" height="50" rx="10" fill="hsl(300 60% 65% / 0.1)" stroke="hsl(300 60% 65%)" strokeWidth="1.5" />
      <text x="380" y="139" textAnchor="middle" fill="hsl(300 60% 65%)" fontSize="11" fontWeight="600">Client B</text>
      <line x1="100" y1="135" x2="178" y2="58" stroke="hsl(270 60% 65% / 0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="262" y1="58" x2="340" y2="130" stroke="hsl(270 60% 65% / 0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
      <motion.circle
        r="6" fill="hsl(300 60% 65%)"
        initial={{ cx: 100, cy: 135 }}
        animate={{ cx: [100, 180], cy: [135, 58], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
      />
      <motion.circle
        r="6" fill="hsl(270 60% 65%)"
        initial={{ cx: 262, cy: 58 }}
        animate={{ cx: [262, 340], cy: [58, 130], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1, repeat: Infinity, repeatDelay: 2, delay: 1.2, ease: "easeInOut" }}
      />
      <text x="105" y="88" fill="hsl(270 60% 65%)" fontSize="9" opacity="0.6">ServerRpc</text>
      <text x="265" y="88" fill="hsl(270 60% 65%)" fontSize="9" opacity="0.6">ObserversRpc</text>
    </svg>
  );
}
