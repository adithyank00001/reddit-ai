"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative inline-flex h-7 w-12 items-center rounded-full bg-muted/80 transition-colors">
        <Sun className="absolute left-1.5 h-3.5 w-3.5 text-muted-foreground/70" />
        <Moon className="absolute right-1.5 h-3.5 w-3.5 text-muted-foreground/70" />
        <div className="absolute left-0.5 h-6 w-6 rounded-full bg-background shadow-sm transition-transform" />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <SwitchPrimitive.Root
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      className={cn(
        "peer relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-0 bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <Sun className="absolute left-1.5 h-3.5 w-3.5 text-muted-foreground/70 transition-opacity z-10" style={{ opacity: isDark ? 0.4 : 1 }} />
      <Moon className="absolute right-1.5 h-3.5 w-3.5 text-muted-foreground/70 transition-opacity z-10" style={{ opacity: isDark ? 1 : 0.4 }} />
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-6 w-6 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
          "data-[state=checked]:translate-x-[calc(100%+0.125rem)] data-[state=unchecked]:translate-x-0.5"
        )}
      />
      <span className="sr-only">Toggle theme</span>
    </SwitchPrimitive.Root>
  );
}
