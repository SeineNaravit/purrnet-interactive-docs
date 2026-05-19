import { codeToHtml } from "shiki";
import { CodeBlockClient } from "./CodeBlockClient";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  /** Map identifier names → tooltip description shown on hover */
  tooltips?: Record<string, string>;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function injectTooltips(html: string, tooltips: Record<string, string>): string {
  let out = html;
  for (const [name, tip] of Object.entries(tooltips)) {
    const safeTip = tip
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Wrap the inner text of any Shiki span whose full content is exactly `name`
    const re = new RegExp(`(<span[^>]*>)(${escapeRegex(name)})(</span>)`, "g");
    out = out.replace(
      re,
      `$1<span class="code-tip" data-tip="${safeTip}">$2</span>$3`
    );
  }
  return out;
}

export async function CodeBlock({
  code,
  language = "csharp",
  filename,
  className,
  tooltips,
}: Props) {
  let html: string;
  try {
    html = await codeToHtml(code, { lang: language, theme: "catppuccin-mocha" });
  } catch {
    // Unknown language: fall back to escaped plain text
    const esc = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = `<pre style="background:#1e1e2e;color:#cdd6f4"><code>${esc}</code></pre>`;
  }

  if (tooltips && Object.keys(tooltips).length > 0) {
    html = injectTooltips(html, tooltips);
  }

  return (
    <CodeBlockClient
      html={html}
      code={code}
      filename={filename}
      language={language}
      className={cn(className)}
    />
  );
}
