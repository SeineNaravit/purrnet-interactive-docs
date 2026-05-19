"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface TooltipState {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

interface Props {
  html: string;
  code: string;
  filename?: string;
  language?: string;
  className?: string;
}

export function CodeBlockClient({ html, code, filename, language = "csharp", className }: Props) {
  const [copied, setCopied] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const showTip = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (!target) {
        setTooltip(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const above = rect.top > 80;
      setTooltip({
        text: target.dataset.tip!,
        x: Math.max(120, Math.min(window.innerWidth - 120, centerX)),
        y: above ? rect.top : rect.bottom,
        below: !above,
      });
    };

    // mouseleave fires once when the mouse exits the whole container — reliable hide
    const hideTip = () => setTooltip(null);

    el.addEventListener("mouseover", showTip);
    el.addEventListener("mouseleave", hideTip);
    return () => {
      el.removeEventListener("mouseover", showTip);
      el.removeEventListener("mouseleave", hideTip);
    };
  }, []);

  return (
    <>
      <div
        ref={wrapperRef}
        className={cn("rounded-xl border border-border overflow-hidden my-4", className)}
        style={{ background: "#1e1e2e" }}
      >
        {/* macOS window chrome */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="size-3 rounded-full bg-red-500/70" />
              <div className="size-3 rounded-full bg-yellow-500/70" />
              <div className="size-3 rounded-full bg-green-500/70" />
            </div>
            {filename && (
              <span className="text-xs text-zinc-400 ml-2">{filename}</span>
            )}
            {!filename && (
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                {language}
              </span>
            )}
          </div>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-white/8"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Shiki-highlighted code */}
        <div
          className="shiki-wrapper overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Floating tooltip — fixed so it escapes all overflow clips */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="code-tooltip"
            initial={{ opacity: 0, scale: 0.92, y: tooltip.below ? -4 : 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: tooltip.x,
              ...(tooltip.below
                ? { top: tooltip.y + 8 }
                : { top: tooltip.y - 8, transform: "translateY(-100%)" }),
              transform: tooltip.below
                ? "translateX(-50%)"
                : "translateX(-50%) translateY(-100%)",
            }}
          >
            <div className="relative bg-zinc-900 border border-purple-500/40 text-zinc-100 text-xs px-3 py-2 rounded-lg shadow-2xl max-w-[240px] text-center leading-relaxed">
              {/* decorative type pill */}
              <span className="block text-purple-400/70 text-[10px] mb-0.5 font-mono uppercase tracking-wider">
                param
              </span>
              {tooltip.text}
              {/* Arrow */}
              {!tooltip.below && (
                <div
                  className="absolute left-1/2 top-full -translate-x-1/2"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "5px solid rgba(168,85,247,0.4)",
                  }}
                />
              )}
              {tooltip.below && (
                <div
                  className="absolute left-1/2 bottom-full -translate-x-1/2"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderBottom: "5px solid rgba(168,85,247,0.4)",
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
