import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

export function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "$10",
      period: "/ month",
      description: "Perfect for getting started",
      features: [
        "Monitor 10 Keywords",
        "Track 10 Subreddits",
        "Real-time Email Alerts",
        "Basic Analytics",
        "Email Support",
      ],
      popular: false,
    },
    {
      name: "Growth",
      price: "$20",
      period: "/ month",
      description: "For growing businesses",
      features: [
        "Monitor 20 Keywords",
        "Track 20 Subreddits",
        "Slack & Discord Integration",
        "Advanced Analytics",
        "Priority Email Support",
        "Custom Notifications",
      ],
      popular: true,
    },
    {
      name: "Unlimited",
      price: "$39",
      period: "/ month",
      description: "For power users",
      features: [
        "Unlimited Keywords",
        "Unlimited Subreddits",
        "All Integrations",
        "Full Analytics Dashboard",
        "Priority Support",
        "Custom Integrations",
        "Dedicated Account Manager",
      ],
      popular: false,
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-background">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Start with a 7-day free trial. No credit card required. Cancel anytime.
          </p>
          <p className="text-sm text-muted-foreground">
            (Note: You will not be charged until your 7-day trial ends.)
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3 place-items-stretch">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`flex flex-col border-2 w-full relative transition-all duration-300 hover:shadow-xl bg-card ${
                plan.popular
                  ? "border-primary shadow-lg scale-105 md:scale-110"
                  : "hover:border-primary/50"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl mb-2 text-foreground">{plan.name}</CardTitle>
                <div className="flex items-baseline justify-center gap-1 mt-4">
                  <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-lg">{plan.period}</span>
                </div>
                <CardDescription className="mt-3 text-base text-muted-foreground">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                      <span className="text-sm leading-relaxed text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <Link href="/login?redirectTo=/dashboard" className="w-full">
                  <Button
                    className={`w-full ${plan.popular ? "" : "variant-outline"}`}
                    size="lg"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include a 7-day free trial with full access to features.</p>
        </div>
      </div>
    </section>
  );
}
