import { Sidebar } from "@/components/sidebar";

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
        <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
