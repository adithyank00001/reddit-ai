import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Marketing Director",
      company: "TechStart Inc.",
      content: "LeadRabbit AI has completely transformed our lead generation. We're getting 3x more qualified leads than before, and it's all automated!",
      rating: 5,
    },
    {
      name: "Michael Chen",
      role: "Founder",
      company: "SaaS Solutions",
      content: "The AI filtering is incredible. We only get notified about high-intent leads, which saves us so much time. Best investment we've made this year.",
      rating: 5,
    },
    {
      name: "Emily Rodriguez",
      role: "Sales Manager",
      company: "Growth Co.",
      content: "I love how easy it is to set up. Within minutes, we were monitoring keywords and getting alerts. Our conversion rate has improved significantly.",
      rating: 5,
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            What Our Customers Say
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Join hundreds of satisfied customers who are generating more leads
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="border-2 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-base leading-relaxed mb-4 italic">
                  "{testimonial.content}"
                </p>
                <div className="border-t pt-4">
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
