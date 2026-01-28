import { MessageCircle, User } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FounderContactCard() {
  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <User className="h-6 w-6 text-emerald-700" />
        </div>

        <div className="space-y-1">
          <CardTitle className="text-xl">Talk to the Founder</CardTitle>
          <CardDescription className="text-sm">
            Skip the email queue. I am available on WhatsApp to solve your
            issues personally and listen to your suggestions. Let&apos;s connect.
          </CardDescription>
          <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Report a bug</li>
            <li>Need help</li>
            <li>Request a feature</li>
          </ul>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-sm text-muted-foreground">
          I&apos;m the person behind LeadRabbit. Reach out any time — I usually respond quickly.
        </p>

        <Button
          asChild
          className="bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-500"
          size="lg"
        >
          <a
            href="https://wa.me/918891993882?text=hey"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat on WhatsApp
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}


