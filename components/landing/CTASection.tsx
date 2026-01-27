import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 md:p-12 text-center shadow-2xl">
          <div className="relative space-y-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-primary-foreground">
              Ready to Transform Your Lead Generation?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-primary-foreground/90">
              Start monitoring Reddit conversations and get instant alerts when people are looking for your solution. No credit card required for the 7-day trial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/login?redirectTo=/dashboard">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-6 group bg-white text-primary hover:bg-gray-100 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                >
                  Start Free Trial Now
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6 bg-transparent border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground/50"
                >
                  Contact Sales
                </Button>
              </Link>
            </div>
            <p className="text-sm text-primary-foreground/80 pt-4">
              ✓ No credit card required • ✓ Cancel anytime • ✓ Full access during trial
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
