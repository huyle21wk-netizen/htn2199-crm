"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Kanban,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/contacts", label: "Liên hệ", icon: Users },
  { href: "/kanban", label: "Kanban", icon: Kanban },
  { href: "/calendar", label: "Lịch", icon: CalendarDays, badge: 0 },
  { href: "/report", label: "Báo cáo", icon: BarChart3 },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <span
          className="text-xl font-bold"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          CRM
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          Bất động sản
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                active
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-xs font-semibold bg-destructive text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-2 border-t border-border mt-2">
          <Link
            href="/settings"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
              isActive("/settings")
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Cài đặt</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
        >
          <LogOut className="h-4 w-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 border-r border-border bg-card z-40">
        <NavContent />
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 border-b border-border bg-card">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-60">
            <NavContent onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span
          className="ml-3 text-lg font-bold"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          CRM
        </span>
      </div>
    </>
  );
}
