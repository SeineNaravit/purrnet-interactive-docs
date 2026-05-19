"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n";

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside className="w-64 shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto border-r border-border bg-sidebar">
      <nav className="px-3 py-5 space-y-6">
        {navSections.map((section) => (
          <div key={section.titleKey}>
            <p className="flex items-center gap-1.5 px-2 mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span>{section.icon}</span>{" "}
              {t(section.titleKey, section.title)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all",
                        active
                          ? "bg-primary/12 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {t(item.titleKey, item.title)}
                      {item.badge && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
