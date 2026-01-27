import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">LeadRabbit AI</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/contact">
            <Button variant="ghost">Contact Us</Button>
          </Link>
          <Link href="/login?redirectTo=/dashboard">
            <Button>Start Free Trial</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
