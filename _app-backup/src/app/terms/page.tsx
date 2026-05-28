import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-secondary">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Lonkind Logo" width={32} height={32} />
            <span className="text-xl font-bold">Lonkind</span>
          </Link>
          <Link href="/" passHref>
             <Button>Back to App</Button>
          </Link>
        </div>
      </header>
      <main className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-4xl font-extrabold tracking-tight">Terms and Conditions</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Last updated: July 27, 2024
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-base prose prose-sm max-w-none">
            <p>Welcome to Lonkind! These terms and conditions outline the rules and regulations for the use of Lonkind's Website, located at this domain.</p>

            <p>By accessing this website we assume you accept these terms and conditions. Do not continue to use Lonkind if you do not agree to take all of the terms and conditions stated on this page.</p>

            <h3 className="text-2xl font-bold">1. Accounts</h3>
            <p>When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.</p>
            <p>You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service.</p>
            
            <h3 className="text-2xl font-bold">2. Content</h3>
            <p>Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.</p>
            <p>By posting Content to the Service, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the Service. You retain any and all of your rights to any Content you submit, post or display on or through the Service and you are responsible for protecting those rights.</p>

            <h3 className="text-2xl font-bold">3. Intellectual Property</h3>
            <p>The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of Lonkind and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.</p>

            <h3 className="text-2xl font-bold">4. Links To Other Web Sites</h3>
            <p>Our Service may contain links to third-party web sites or services that are not owned or controlled by Lonkind. Lonkind has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third party web sites or services.</p>

            <h3 className="text-2xl font-bold">5. Termination</h3>
            <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.</p>

            <h3 className="text-2xl font-bold">6. Limitation Of Liability</h3>
            <p>In no event shall Lonkind, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
            
            <h3 className="text-2xl font-bold">7. Governing Law</h3>
            <p>These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.</p>
            
            <h3 className="text-2xl font-bold">8. Changes</h3>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</p>
            
            <h3 className="text-2xl font-bold">Contact Us</h3>
            <p>If you have any questions about these Terms, please contact us via the support section in the app settings.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
