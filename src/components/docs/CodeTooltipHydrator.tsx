"use client";
import { useEffect } from "react";
import { PURRNET_API } from "@/lib/purrnetApi";

/**
 * Runs once after hydration and scans every .shiki-wrapper on the page.
 * For any leaf <span> whose exact text matches a key in PURRNET_API,
 * it injects class="code-tip" and data-tip="description" so the
 * CodeBlockClient tooltip listener can pick it up — no per-page config needed.
 */
export function CodeTooltipHydrator() {
  useEffect(() => {
    const wrappers = document.querySelectorAll<HTMLElement>(".shiki-wrapper");

    wrappers.forEach((wrapper) => {
      wrapper.querySelectorAll<HTMLElement>("span").forEach((span) => {
        // Skip non-leaf spans (container lines, etc.)
        if (span.querySelector("span")) return;
        // Skip already annotated spans
        if (span.dataset.tip) return;

        const text = span.textContent ?? "";
        const tip = PURRNET_API[text];
        if (!tip) return;

        span.classList.add("code-tip");
        span.dataset.tip = tip;
      });
    });
  }, []);

  return null;
}
