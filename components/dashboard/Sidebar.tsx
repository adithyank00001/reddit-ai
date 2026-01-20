"use client";

import Link from "next/link";
import { Home, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

/**
 * Sidebar Component
 * Navigation component for dashboard pages
 */
export function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 bg-card border-r border-border">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-card-foreground">Dashboard</h2>
        <nav className="mt-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive("/dashboard")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/settings"
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive("/dashboard/settings")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
