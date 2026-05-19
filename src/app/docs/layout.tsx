import { Sidebar } from "@/components/docs/Sidebar";
import { CodeTooltipHydrator } from "@/components/docs/CodeTooltipHydrator";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 px-8 py-10 max-w-4xl">
        {children}
      </main>
      <CodeTooltipHydrator />
    </div>
  );
}
