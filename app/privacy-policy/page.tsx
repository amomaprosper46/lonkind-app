import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, Server, RefreshCw, ArrowLeft, Mail, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Privacy Policy | Lonkind',
  description: 'Our commitment to protecting your privacy and personal data.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'May 28, 2026';

  return (
    <main className="min-h-screen bg-background selection:bg-primary/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-primary/5 py-16 md:py-24 border-b border-primary/10">
        <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom dark:border-b dark:border-slate-100/5"></div>
        <div className="container relative max-w-4xl mx-auto px-6 lg:px-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-8 -ml-3 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-5 mb-6">
            <div className="p-3.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            At Lonkind, we believe in radical transparency. This policy outlines exactly how we collect, use, and fiercely protect your personal information when you use our platform.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground/80 bg-background/50 w-fit px-4 py-1.5 rounded-full border border-primary/10 backdrop-blur-sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Last Updated: {lastUpdated}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container max-w-4xl mx-auto px-6 lg:px-8 py-16 md:py-24">
        <div className="prose prose-slate dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight max-w-none space-y-12">
          
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
              Information We Collect
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              When you use Lonkind, we collect information that you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information includes:
            </p>
            <ul className="space-y-4 mt-6 text-muted-foreground">
              <li className="flex gap-3"><strong className="text-foreground min-w-[140px]">Identity Data:</strong> <span>Name, email address, profile picture, and chosen username.</span></li>
              <li className="flex gap-3"><strong className="text-foreground min-w-[140px]">Financial Data:</strong> <span>Bank account details and transaction history (processed securely via Paystack) to facilitate payouts and coin purchases.</span></li>
              <li className="flex gap-3"><strong className="text-foreground min-w-[140px]">User Content:</strong> <span>Posts, stories, messages, and interactions with other users.</span></li>
              <li className="flex gap-3"><strong className="text-foreground min-w-[140px]">Device Data:</strong> <span>IP address, browser type, operating system, and device identifiers to optimize your experience.</span></li>
            </ul>
          </div>

          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-green-500/10 rounded-xl">
                <Lock className="h-6 w-6 text-green-500" />
              </div>
              How We Use Your Data
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-6">
              We use the information we collect strictly to provide, maintain, and improve our services. Specifically, we use your data to:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                'Secure your Lonkind account',
                'Process Paystack transactions',
                'Improve community matchmaking',
                'Send critical security alerts',
                'Provide customer service support',
                'Analyze usage trends safely'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-muted/50 p-4 rounded-2xl border border-border/50">
                  <div className="h-2 w-2 rounded-full bg-primary/60"></div>
                  <span className="text-muted-foreground font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-purple-500/10 rounded-xl">
                <Server className="h-6 w-6 text-purple-500" />
              </div>
              Data Security & Storage
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              We take the security of your data seriously. We implement robust, industry-standard security measures (including end-to-end encryption protocols for sensitive data) to protect your personal information from unauthorized access, alteration, disclosure, or destruction. 
            </p>
            <div className="mt-8 p-6 bg-purple-500/5 rounded-2xl border border-purple-500/10">
              <p className="text-muted-foreground font-medium m-0 flex items-center gap-3">
                <Shield className="h-5 w-5 text-purple-500 flex-shrink-0" />
                All financial transactions are handled by our secure payment partner (Paystack). We do not store your full credit card details on our servers. Your data is hosted on highly secure cloud infrastructure provided by Google Cloud.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-foreground flex items-center gap-3">
              <FileText className="h-7 w-7 text-primary" />
              Your Rights & Choices
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              You have the right to access, update, or delete your personal information at any time. You can manage your account settings directly within the Lonkind app. If you wish to permanently delete your account and all associated data, please contact our support team.
            </p>

            <h2 className="text-2xl md:text-3xl font-bold mt-16 mb-6 flex items-center gap-3 text-foreground">
              <Mail className="h-7 w-7 text-primary" />
              Contact Us
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-6">
              If you have any questions or concerns about this Privacy Policy or our data practices, please reach out to our privacy team at:
            </p>
            <div className="bg-card p-6 rounded-2xl inline-block border shadow-sm hover:shadow-md transition-shadow">
              <a href="mailto:privacy@lonkind.com" className="text-primary font-bold text-lg hover:underline flex items-center gap-2">
                privacy@lonkind.com
              </a>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
