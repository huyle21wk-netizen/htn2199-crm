import { Sidebar } from "@/components/sidebar";
import { EndOfDayWidget } from "@/components/end-of-day-widget";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Desktop: offset for sidebar */}
      <main className="md:ml-60 min-h-screen">
        {/* Mobile: offset for top bar */}
        <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-7xl animate-in fade-in-0 duration-150">
          <EndOfDayWidget />
          {children}
        </div>
      </main>
    </div>
  );
}
