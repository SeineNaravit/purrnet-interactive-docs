"use client";
import { useNetworkSim } from "@/lib/store/networkSimStore";
import { Pause, Play } from "lucide-react";

export function SimControls() {
  const { latencyMs, packetLoss, isPlaying, setLatency, setPacketLoss, toggle } = useNetworkSim();

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card/60 backdrop-blur text-sm">
      <button
        onClick={toggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition-opacity"
      >
        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {isPlaying ? "Pause" : "Play"}
      </button>
      <label className="flex items-center gap-2 text-muted-foreground">
        <span className="shrink-0">Latency</span>
        <input
          type="range" min={0} max={500} value={latencyMs}
          onChange={(e) => setLatency(Number(e.target.value))}
          className="w-24 accent-primary"
        />
        <span className="font-mono text-foreground w-14">{latencyMs} ms</span>
      </label>
      <label className="flex items-center gap-2 text-muted-foreground">
        <span className="shrink-0">Packet Loss</span>
        <input
          type="range" min={0} max={50} value={packetLoss}
          onChange={(e) => setPacketLoss(Number(e.target.value))}
          className="w-20 accent-primary"
        />
        <span className="font-mono text-foreground w-10">{packetLoss}%</span>
      </label>
    </div>
  );
}
