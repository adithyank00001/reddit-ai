import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, Bell, TrendingUp } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      icon: Search,
      title: "Set Your Keywords",
      description: "Add keywords related to your product or service. Our system will monitor these across Reddit automatically.",
    },
    {
      step: "02",
      icon: Filter,
      title: "AI Filters Intent",
      description: "Our AI analyzes posts to identify high-intent buying signals, filtering out spam and irrelevant content.",
    },
    {
      step: "03",
      icon: Bell,
      title: "Get Instant Alerts",
      description: "Receive real-time notifications via Email or Slack when relevant discussions are detected.",
    },
    {
      step: "04",
      title: "Convert Leads",
      icon: TrendingUp,
      description: "Engage with potential customers at the perfect moment when they're actively looking for solutions.",
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-background">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Get started in minutes. No technical knowledge required.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="relative">
                <Card className="border-2 h-full hover:shadow-lg transition-all duration-300 bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                        {step.step}
                      </div>
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl text-foreground">{step.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed mt-2 text-muted-foreground">
                      {step.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-primary">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
