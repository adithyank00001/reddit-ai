import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | LeadRabbit AI",
  description: "Cancellation and refund policy for LeadRabbit AI",
};

export default function RefundPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Cancellation & Refund Policy</h1>
          <p className="text-muted-foreground">Last Updated: January 27, 2026</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p>
            At <strong>LeadRabbit AI</strong>, we are transparent about our billing. Please read this policy carefully before starting your trial.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. 7-Day Free Trial Policy</h2>
            <p>
              We provide a 7-day free trial for all new accounts so you can test the software fully before paying.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Requirement:</strong> Valid payment details are required to start the trial.</li>
              <li><strong>Charges:</strong> You will be charged $0.00 today.</li>
              <li><strong>Automatic Conversion:</strong> If you do not cancel before the 7-day period ends, your payment method will automatically be charged for the subscription plan you selected.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Strict No-Refund Policy</h2>
            <p>
              Because we offer a full-access free trial, all sales are final.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>We do not offer refunds once a charge has been processed.</li>
              <li>We do not offer pro-rated refunds for cancelled subscriptions.</li>
              <li>Since this is a digital SaaS product with immediate access to data and API resources, we cannot accept "returns."</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. How to Cancel to Avoid Charges</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can cancel your subscription at any time inside your user dashboard or by emailing <a href="mailto:support@tryleadrabbit.com" className="text-primary hover:underline">support@tryleadrabbit.com</a>.</li>
              <li>To avoid being charged, you must cancel before the 7th day of your trial ends.</li>
              <li>If you cancel during the trial, you will lose access immediately and will not be charged.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Merchant of Record</h2>
            <p>
              Our order process is conducted by our online reseller, Dodo Payments. Dodo Payments is the Merchant of Record for all our orders. All billing inquiries and disputes will be handled in accordance with their strict fraud protection protocols.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
