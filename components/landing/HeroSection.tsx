import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="mx-auto max-w-5xl text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
            Turn Reddit Conversations into High-Quality Leads on Autopilot
          </h1>
          
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground sm:text-xl md:text-2xl leading-relaxed">
            Monitor specific keywords across millions of discussions. Get instant alerts when people are looking for your solution. Stop searching for customers—let them find you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/login?redirectTo=/dashboard">
              <Button size="lg" className="text-lg px-8 py-6 group">
                Start 7-Day Free Trial
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
