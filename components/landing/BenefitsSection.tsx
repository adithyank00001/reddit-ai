import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export function BenefitsSection() {
  const benefits = [
    "Save hours per week on manual lead research",
    "Get leads when they're actively looking for solutions",
    "Never miss a potential customer opportunity",
    "Scale your lead generation without hiring more staff",
    "Access to millions of Reddit discussions",
    "Higher conversion rates with intent-based leads",
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-4xl">
        <Card className="border-2 shadow-lg bg-card">
          <CardContent className="p-8 md:p-12">
            <div className="text-center space-y-6 mb-8">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
                Why Choose LeadRabbit AI?
              </h2>
              <p className="text-lg text-muted-foreground">
                Transform your lead generation process with automated monitoring and AI-powered filtering
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span className="text-base leading-relaxed text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
