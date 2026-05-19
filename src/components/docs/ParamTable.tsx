"use client";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export interface Param {
  name: string;
  type: string;
  default?: string;
  description: string;
  required?: boolean;
}

interface Props {
  params: Param[];
  className?: string;
}

export function ParamTable({ params, className }: Props) {
  const t = useT();

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border my-4", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/70 border-b border-border">
            <th className="text-left px-4 py-2.5 font-semibold w-[180px]">
              {t("paramTables.headers.parameter", "Parameter")}
            </th>
            <th className="text-left px-4 py-2.5 font-semibold w-[140px]">
              {t("paramTables.headers.type", "Type")}
            </th>
            <th className="text-left px-4 py-2.5 font-semibold w-[100px]">
              {t("paramTables.headers.default", "Default")}
            </th>
            <th className="text-left px-4 py-2.5 font-semibold">
              {t("paramTables.headers.description", "Description")}
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={p.name} className={i % 2 === 0 ? "" : "bg-muted/30"}>
              <td className="px-4 py-2.5 align-top">
                <code className="text-purr font-mono font-medium text-xs">{p.name}</code>
                {p.required && (
                  <span className="ml-1.5 text-[10px] font-semibold text-red-500 uppercase tracking-wide">
                    {t("paramTables.headers.required", "req")}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 align-top">
                <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">{p.type}</code>
              </td>
              <td className="px-4 py-2.5 align-top text-muted-foreground">
                {p.default ? (
                  <code className="text-xs">{p.default}</code>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 align-top text-muted-foreground leading-relaxed">
                {p.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
