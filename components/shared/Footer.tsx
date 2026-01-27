import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <span>|</span>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link href="/refund-policy" className="hover:text-foreground transition-colors">
              Refund Policy
            </Link>
            <span>|</span>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact Us
            </Link>
          </nav>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            Copyright © 2026 LeadRabbit AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
