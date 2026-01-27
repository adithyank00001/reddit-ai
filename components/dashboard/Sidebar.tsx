"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Home, Settings, LogOut, Bell, MessageSquare, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User } from "@supabase/supabase-js";

/**
 * Sidebar Component
 * Navigation component for dashboard pages
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    async function fetchUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }

    fetchUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 flex-1">
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
                Scraper Settings
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/settings/notifications"
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive("/dashboard/settings/notifications")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Bell className="h-4 w-4" />
                Notifications
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/settings/reply-intelligence"
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive("/dashboard/settings/reply-intelligence")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Reply Intelligence
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/talk-to-founder"
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive("/dashboard/talk-to-founder")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                Talk to Founder
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* User info and sign out at bottom */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <ThemeToggle />
        </div>
        {user?.email && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">Logged in as</p>
            <p className="text-sm font-medium text-card-foreground truncate" title={user.email}>
              {user.email}
            </p>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
