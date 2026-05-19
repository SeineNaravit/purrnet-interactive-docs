"use client";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Lightbulb, XCircle, CheckCircle } from "lucide-react";

type CalloutType = "info" | "tip" | "warning" | "danger" | "success";

const config: Record<CalloutType, { icon: React.ElementType; color: string; label: string }> = {
  info:    { icon: Info,         color: "border-blue-400/50 bg-blue-500/8 text-blue-700 dark:text-blue-300",   label: "Info" },
  tip:     { icon: Lightbulb,    color: "border-emerald-400/50 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300", label: "Tip" },
  warning: { icon: AlertTriangle,color: "border-amber-400/50 bg-amber-500/8 text-amber-700 dark:text-amber-300",  label: "Warning" },
  danger:  { icon: XCircle,      color: "border-red-400/50 bg-red-500/8 text-red-700 dark:text-red-300",       label: "Danger" },
  success: { icon: CheckCircle,  color: "border-green-400/50 bg-green-500/8 text-green-700 dark:text-green-300", label: "Success" },
};

interface Props {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = "info", title, children }: Props) {
  const { icon: Icon, color, label } = config[type];
  return (
    <div className={cn("rounded-lg border px-4 py-3 my-4 flex gap-3", color)}>
      <Icon className="mt-0.5 size-4 shrink-0 opacity-80" />
      <div className="text-sm leading-relaxed">
        {title && <p className="font-semibold mb-1">{title || label}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
