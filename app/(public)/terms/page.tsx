import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | LeadRabbit AI",
  description: "Terms of Service for LeadRabbit AI",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: January 27, 2026</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing <strong>LeadRabbit AI</strong>, you agree to be bound by these terms. If you do not agree, do not use our services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Description of Service</h2>
            <p>
              <strong>LeadRabbit AI</strong> is a social listening tool that aggregates publicly available data from Reddit for market research purposes. We are not affiliated with Reddit Inc.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Billing and Free Trials</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Trial Terms:</strong> By signing up for a free trial, you authorize us to charge your payment method the subscription fee automatically after the trial period ends, unless cancelled.</li>
              <li><strong>Subscription Renewal:</strong> Your subscription will automatically renew at the end of each billing cycle unless you cancel it.</li>
              <li><strong>Price Changes:</strong> We reserve the right to change pricing with 30 days notice.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. User Conduct (Anti-Abuse)</h2>
            <p>You agree NOT to use our service to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Spam, harass, or solicit users on Reddit in violation of Reddit's Content Policy.</li>
              <li>Use the data for unauthorized surveillance or illegal activities.</li>
            </ul>
            <p>
              Violation of this section will result in immediate account termination without refund.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Limitation of Liability</h2>
            <p>
              <strong>LeadRabbit AI</strong> shall not be liable for any indirect, incidental, or consequential damages resulting from your use of the service. We do not guarantee the accuracy of data retrieved from third-party platforms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
