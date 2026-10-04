import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, Server, RefreshCw, ArrowLeft, Mail, FileText, UserCheck, CreditCard, Trash2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyContent() {
  const lastUpdated = 'October 4, 2026';

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
            At Lonkind, your privacy and data security are our top priorities. This Privacy Policy details how we collect, use, store, disclose, and safeguard your personal information when you visit or use our platform at lonkind.com.
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
          
          {/* Section 1: Overview & Scope */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Globe className="h-6 w-6 text-blue-500" />
              </div>
              1. Overview & Scope
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Lonkind ("we", "us", "our", or "Platform") provides real-time social networking, live streaming, interactive gifting, and messaging services via lonkind.com and associated applications. This Privacy Policy applies to all users worldwide and governs all data processing activities conducted by Lonkind. By accessing or using Lonkind, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>

          {/* Section 2: Information We Collect */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                <Eye className="h-6 w-6 text-indigo-500" />
              </div>
              2. Information We Collect
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-6">
              We collect information to provide, maintain, and optimize our services. The categories of information we collect include:
            </p>
            
            <div className="space-y-6">
              <div className="border-l-4 border-primary pl-4 py-1">
                <h3 className="text-lg font-bold text-foreground mb-1">A. Account & Profile Data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  When you register an account, we collect your display name, username (@handle), email address, phone number, password, profile photo, and optional bio information.
                </p>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4 py-1">
                <h3 className="text-lg font-bold text-foreground mb-1">B. Google Account Data (Google OAuth)</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  If you sign up or log in using Google OAuth, we collect your basic Google profile details, including your primary email address, full name, profile picture URL, and Google user identifier. We only request basic authentication scope permissions and do not access or store private Google Drive files, contacts, or calendar data.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4 py-1">
                <h3 className="text-lg font-bold text-foreground mb-1">C. Financial & Creator Payout Information</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  When you purchase Lonkind Coins or withdraw earned creator balances, we collect transaction logs, currency amounts, and payout settlement details (such as bank name, account number, and account holder name). Credit/debit card numbers and sensitive banking credentials are handled directly by PCI-DSS compliant payment gateways (Paystack & Flutterwave) and are never stored on Lonkind servers.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4 py-1">
                <h3 className="text-lg font-bold text-foreground mb-1">D. User Content & Real-time Communications</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We store posts, images, audio clips, comments, direct messages, live stream video/audio metadata, virtual gifts sent/received, and social connections (followers/following).
                </p>
              </div>

              <div className="border-l-4 border-amber-500 pl-4 py-1">
                <h3 className="text-lg font-bold text-foreground mb-1">E. Technical, Device & Analytics Data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We automatically collect standard technical information including IP address, browser type, operating system version, system language, push notification tokens (Firebase Cloud Messaging), and app interaction analytics.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Google API Limited Use Disclosure */}
          <div className="bg-card border border-blue-500/30 rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md bg-blue-500/5">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-blue-500/20 rounded-xl">
                <UserCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              3. Google OAuth & API Limited Use Disclosure
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-4">
              Lonkind strictly adheres to Google's API Services User Data Policy:
            </p>
            <div className="p-6 bg-background/80 rounded-2xl border border-blue-500/20 space-y-4 text-muted-foreground text-sm leading-relaxed">
              <p className="font-semibold text-foreground">
                Lonkind's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>We do not sell Google user data to third parties, data brokers, or advertising networks.</li>
                <li>We do not use Google user data to serve personalized advertisements.</li>
                <li>We do not transfer Google user data to third parties unless necessary to provide or improve app functionality, comply with applicable laws, or as part of a merger or acquisition.</li>
                <li>We do not use Google user data for training generalized AI or machine learning models.</li>
              </ul>
            </div>
          </div>

          {/* Section 4: How We Use Your Data */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-green-500/10 rounded-xl">
                <Lock className="h-6 w-6 text-green-500" />
              </div>
              4. How We Use Your Information
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-6">
              We process your personal information strictly for legitimate service purposes:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                'Authenticating users & protecting accounts',
                'Delivering live streaming & real-time messaging',
                'Processing coin purchases & creator payouts',
                'Preventing fraud, spam, and security breaches',
                'Sending system verifications & SMS/email alerts',
                'Providing customer support & resolving appeals',
                'Maintaining platform performance & reliability',
                'Enforcing our Terms of Service & guidelines'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-muted/50 p-4 rounded-2xl border border-border/50">
                  <div className="h-2 w-2 rounded-full bg-primary/60"></div>
                  <span className="text-muted-foreground font-medium text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Third-Party Service Providers */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-purple-500/10 rounded-xl">
                <CreditCard className="h-6 w-6 text-purple-500" />
              </div>
              5. Data Sharing & Sub-Processors
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-4">
              We do NOT sell, rent, or trade your personal data. We share data only with verified infrastructure providers who process data strictly under our instructions:
            </p>
            <ul className="space-y-4 text-muted-foreground list-none pl-0">
              <li className="p-4 bg-muted/40 rounded-2xl border">
                <strong className="text-foreground">Google Cloud Platform & Firebase:</strong> Provides secure cloud infrastructure, user authentication, Firestore database, file storage, and hosting.
              </li>
              <li className="p-4 bg-muted/40 rounded-2xl border">
                <strong className="text-foreground">Paystack & Flutterwave:</strong> Licensed payment gateways that process coin purchases and creator bank account payouts.
              </li>
              <li className="p-4 bg-muted/40 rounded-2xl border">
                <strong className="text-foreground">Termii:</strong> Telecommunications gateway used for sending SMS one-time verification passwords (OTP).
              </li>
            </ul>
          </div>

          {/* Section 6: Data Security & Retention */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-orange-500/10 rounded-xl">
                <Server className="h-6 w-6 text-orange-500" />
              </div>
              6. Data Security & Storage
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-4">
              We enforce industry-standard technical and organizational security controls to safeguard your data against unauthorized access, loss, or misuse:
            </p>
            <ul className="list-disc pl-5 space-y-3 text-muted-foreground text-sm">
              <li>All web traffic is transmitted via mandatory HTTPS/TLS end-to-end encryption.</li>
              <li>Data at rest is stored in Google Cloud Firestore with AES-256 server-side encryption.</li>
              <li>Administrative access to backend infrastructure is restricted via multi-factor authentication and role-based permissions.</li>
              <li>Personal account information is retained for as long as your account remains active. Transaction logs are retained as required by financial regulations.</li>
            </ul>
          </div>

          {/* Section 7: Your Rights & Account Deletion */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-6">
              <div className="p-2.5 bg-red-500/10 rounded-xl">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              7. Your Rights & Account Deletion
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-4">
              Regardless of your location, you have the following data rights under applicable data protection laws (including GDPR, CCPA, and NDPA):
            </p>
            <ul className="list-disc pl-5 space-y-3 text-muted-foreground text-sm mb-6">
              <li><strong>Right to Access:</strong> You can request a copy of your personal data stored on Lonkind.</li>
              <li><strong>Right to Rectification:</strong> You can edit your profile information directly inside your app settings.</li>
              <li><strong>Right to Erasure (Account Deletion):</strong> You can permanently delete your account and all associated data at any time.</li>
            </ul>
            
            <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
              <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                How to Request Data / Account Deletion
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                To delete your account and remove all personal information, posts, and media from our systems:
              </p>
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                <li>Go to <strong>Settings</strong> within the Lonkind app and click <strong>Delete Account</strong>, OR</li>
                <li>Send an email request to <a href="mailto:privacy@lonkind.com" className="text-primary font-medium hover:underline">privacy@lonkind.com</a> with the subject line "Account Deletion Request".</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-3">
                Once requested, your account and all associated personal data will be permanently deleted from active databases within 30 days.
              </p>
            </div>
          </div>

          {/* Section 8: Children's Privacy */}
          <div className="bg-card border rounded-3xl p-8 md:p-10 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-2xl md:text-3xl mt-0 flex items-center gap-4 text-foreground mb-4">
              8. Children's Privacy
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Lonkind is not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided personal data to us, please contact us immediately at privacy@lonkind.com so we can promptly delete the data.
            </p>
          </div>

          {/* Section 9: Contact Us */}
          <div className="pt-8 border-t border-border/50">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3 text-foreground">
              <Mail className="h-7 w-7 text-primary" />
              9. Contact Us
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-6">
              If you have any questions, concerns, or privacy requests regarding this Privacy Policy or our data practices, please contact our Data Protection Officer at:
            </p>
            <div className="bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow space-y-2">
              <p className="font-bold text-foreground">Lonkind Support & Privacy Team</p>
              <p className="text-muted-foreground text-sm">Website: <a href="https://lonkind.com" className="text-primary hover:underline">https://lonkind.com</a></p>
              <p className="text-muted-foreground text-sm">Privacy Email: <a href="mailto:privacy@lonkind.com" className="text-primary font-bold hover:underline">privacy@lonkind.com</a></p>
              <p className="text-muted-foreground text-sm">Support Email: <a href="mailto:support@lonkind.com" className="text-primary font-bold hover:underline">support@lonkind.com</a></p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}