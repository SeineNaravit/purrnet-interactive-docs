"use client";
import { useI18nStore } from "@/i18n";
import { type ReactNode } from "react";

export function BilingualContent({ en, th }: { en: ReactNode; th: ReactNode }) {
  const locale = useI18nStore((s) => s.locale);
  return <>{locale === "th" ? th : en}</>;
}
