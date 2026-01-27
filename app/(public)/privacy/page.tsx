import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | LeadRabbit AI",
  description: "Privacy Policy for LeadRabbit AI",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: January 27, 2026</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p>
            <strong>LeadRabbit AI</strong> is committed to protecting your privacy.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Data:</strong> We collect your email and name to manage your login.</li>
              <li><strong>Configuration Data:</strong> We store the keywords and subreddits you choose to monitor.</li>
              <li><strong>Payment Data:</strong> We do not store your credit card details. All payment information is securely handled by our Merchant of Record, Dodo Payments.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide the monitoring service.</li>
              <li>To process payments and send invoices.</li>
              <li>To prevent fraud and abuse of our API.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Third-Party Sharing</h2>
            <p>
              We do not sell your personal data. We only share data with service providers essential to our operation (e.g., Dodo Payments for billing, AWS for hosting).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Contact Us</h2>
            <p>
              For privacy concerns, contact: <a href="mailto:support@tryleadrabbit.com" className="text-primary hover:underline">support@tryleadrabbit.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
