"use client";
import { create } from "zustand";

interface NetworkSimState {
  latencyMs: number;
  packetLoss: number;
  tickRate: number;
  isPlaying: boolean;
  setLatency: (ms: number) => void;
  setPacketLoss: (pct: number) => void;
  setTickRate: (hz: number) => void;
  setPlaying: (v: boolean) => void;
  toggle: () => void;
}

export const useNetworkSim = create<NetworkSimState>((set) => ({
  latencyMs: 80,
  packetLoss: 0,
  tickRate: 20,
  isPlaying: true,
  setLatency: (ms) => set({ latencyMs: ms }),
  setPacketLoss: (pct) => set({ packetLoss: pct }),
  setTickRate: (hz) => set({ tickRate: hz }),
  setPlaying: (v) => set({ isPlaying: v }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
}));
