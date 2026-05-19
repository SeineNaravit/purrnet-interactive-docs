"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getAdjacentPages } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n";

interface Props {
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  href: string;
  children: React.ReactNode;
}

export function DocPage({
  title,
  description,
  badge,
  badgeColor = "bg-primary/15 text-primary",
  href,
  children,
}: Props) {
  const { prev, next } = getAdjacentPages(href);
  const t = useT();

  return (
    <article className="prose max-w-none">
      <div className="mb-8 not-prose">
        {badge && (
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3 ${badgeColor}`}>
            {badge}
          </span>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">{title}</h1>
        <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
        <div className="mt-4 h-px bg-border" />
      </div>

      {children}

      {/* Pagination */}
      <div className="not-prose mt-12 pt-6 border-t border-border flex justify-between gap-4">
        {prev ? (
          <Link
            href={prev.href}
            className="group flex flex-col gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60 uppercase tracking-wider">
              <ArrowLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
              {t("pagination.previous", "Previous")}
            </span>
            <span className="font-medium">{t(prev.titleKey, prev.title)}</span>
          </Link>
        ) : (
          <div />
        )}
        {next && (
          <Link
            href={next.href}
            className="group flex flex-col gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-right"
          >
            <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground/60 uppercase tracking-wider">
              {t("pagination.next", "Next")}
              <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="font-medium">{t(next.titleKey, next.title)}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
