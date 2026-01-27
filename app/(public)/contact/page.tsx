import type { Metadata } from "next";
import { Mail, CreditCard, MapPin } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact Us | LeadRabbit AI",
  description: "Contact LeadRabbit AI for support and inquiries",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-lg text-muted-foreground">
            We are here to help!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 place-items-center md:place-items-stretch">
          <Card className="w-full">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Support Inquiries</CardTitle>
              <CardDescription>
                For help with your account, billing, or technical issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <strong>Email:</strong>{" "}
                <a href="mailto:support@tryleadrabbit.com" className="text-primary hover:underline">
                  support@tryleadrabbit.com
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Response Time:</strong> We aim to reply within 24 hours.
              </p>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Billing Support</CardTitle>
              <CardDescription>
                For questions regarding charges or your free trial status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please include your email address in the subject line when contacting us about billing matters.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Business Address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Kasaragod, Kerala, India
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
