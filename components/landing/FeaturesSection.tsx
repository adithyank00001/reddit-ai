import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Brain, Bell, Shield, BarChart3, Sparkles } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      icon: Monitor,
      title: "Real-Time Monitoring",
      description: "Track keywords across thousands of Subreddits instantly. Never miss an opportunity with our 24/7 monitoring system that scans millions of posts in real-time.",
    },
    {
      icon: Brain,
      title: "AI Intent Filtering",
      description: "Our advanced AI ignores spam and only alerts you to high-intent buying signals. Get quality leads, not noise. Our machine learning models understand context and buying intent.",
    },
    {
      icon: Bell,
      title: "Instant Notifications",
      description: "Get alerts via Email or Slack the second a relevant post goes live. Customize notification preferences and never miss a hot lead again.",
    },
    {
      icon: Shield,
      title: "Privacy & Security",
      description: "Your data is encrypted and secure. We only monitor public Reddit posts and never store sensitive information. GDPR compliant and privacy-focused.",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Track your lead generation performance with detailed analytics. See which keywords perform best, monitor conversion rates, and optimize your strategy.",
    },
    {
      icon: Sparkles,
      title: "Smart Filtering",
      description: "Advanced filters help you find exactly what you're looking for. Filter by subreddit, post age, engagement level, and more to get the most relevant leads.",
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
            Powerful Features for Lead Generation
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything you need to turn Reddit conversations into qualified leads
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 place-items-stretch">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-2 hover:shadow-lg transition-all duration-300 hover:border-primary/50 group bg-card">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl text-foreground">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
