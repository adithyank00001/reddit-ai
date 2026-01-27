"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How does the 7-day free trial work?",
      answer: "You can start your free trial immediately with no credit card required. During the trial, you'll have full access to all features. If you don't cancel before the trial ends, your subscription will automatically begin.",
    },
    {
      question: "What happens if I don't want to continue after the trial?",
      answer: "You can cancel anytime during the trial period from your dashboard or by emailing support@tryleadrabbit.com. If you cancel before the trial ends, you won't be charged anything.",
    },
    {
      question: "How accurate is the AI intent filtering?",
      answer: "Our AI uses advanced machine learning models trained on millions of Reddit posts. It achieves high accuracy in identifying high-intent buying signals, filtering out spam and irrelevant content automatically.",
    },
    {
      question: "Can I monitor multiple keywords and subreddits?",
      answer: "Yes! Depending on your plan, you can monitor multiple keywords and subreddits simultaneously. Our Unlimited plan offers unlimited keywords and subreddits for maximum flexibility.",
    },
    {
      question: "What integrations are available?",
      answer: "We currently support Email and Slack notifications. Discord integration is available on Growth and Unlimited plans. We're constantly adding new integrations based on customer feedback.",
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use industry-standard encryption and never store your payment information. All data is processed securely, and we're GDPR compliant. We only monitor public Reddit posts.",
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything you need to know about LeadRabbit AI
          </p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Card
              key={index}
              className="border-2 cursor-pointer hover:shadow-md transition-all bg-card"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2 text-foreground">{faq.question}</h3>
                    {openIndex === index && (
                      <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
