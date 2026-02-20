
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, UserCheck, UploadCloud, TrendingUp, AlertTriangle, Database, Image as ImageIcon, Smartphone, FileText, FlaskConical } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';

export default function RulesPage() {
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
      <main className="container py-12 space-y-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-4xl font-extrabold tracking-tight">App Policies</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Welcome to Lonkind! To ensure a great experience, please review our purpose and policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6 text-lg">
             <Link href="#guidelines" className="block p-6 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <h3 className="text-2xl font-bold flex items-center mb-2"><UserCheck className="text-primary mr-3 h-6 w-6" /> Community Guidelines</h3>
                <p className="text-muted-foreground">The dos and don'ts for interacting within the Lonkind community.</p>
             </Link>
             <Link href="/terms" className="block p-6 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <h3 className="text-2xl font-bold flex items-center mb-2"><FileText className="text-primary mr-3 h-6 w-6" /> Terms of Service</h3>
                <p className="text-muted-foreground">The legal agreement between you and Lonkind.</p>
             </Link>
          </CardContent>
        </Card>
        
        <Separator />

        <Card id="status">
            <CardHeader>
                <CardTitle className="text-4xl font-extrabold tracking-tight">Platform Information</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                    Here's a look at how Lonkind is built.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 text-lg">
                <div className="space-y-4">
                    <h3 className="text-2xl font-bold flex items-center"><Smartphone className="text-green-500 mr-3 h-6 w-6" /> Platform: Progressive Web App (PWA)</h3>
                    <p>Lonkind is built for the modern web. It runs in any up-to-date web browser on **desktop, iOS, and Android**. For the best experience on mobile, you can "install" the app to your home screen directly from your browser. This provides an app-like feel, faster loading, and offline capabilities.</p>
                </div>
            </CardContent>
        </Card>

        <Separator />

        <Card id="guidelines">
          <CardHeader>
            <CardTitle className="text-4xl font-extrabold tracking-tight">What Lonkind is For</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Our mission is to connect people around the world in a positive and authentic way. Please follow these guidelines.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 text-lg">
            <div className="space-y-4">
                <h3 className="text-2xl font-bold flex items-center"><UserCheck className="text-green-500 mr-3 h-6 w-6" /> Be Authentic and Respectful</h3>
                <p>Connect with friends, family, and new people in a genuine way. Treat everyone with respect. We do not tolerate harassment, bullying, or hate speech. We encourage positive conversations and connections.</p>
            </div>

            <div className="space-y-4">
                <h3 className="text-2xl font-bold flex items-center"><ShieldCheck className="text-green-500 mr-3 h-6 w-6" /> Protect Your Account</h3>
                <p>Your account's safety is your responsibility. We provide tools to protect your account, like identity confirmation for sign-in. Do not share your password or access codes with anyone.</p>
            </div>
            
            <div className="space-y-4">
                <h3 className="text-2xl font-bold flex items-center"><UploadCloud className="text-green-500 mr-3 h-6 w-6" /> Share Content Responsibly</h3>
                <p>You can share text, images, and videos. Only upload content that you own or have the right to share. Do not post harmful, explicit, or misleading content. All content should be appropriate for a global audience.</p>
            </div>

            <div className="space-y-4">
                <h3 className="text-2xl font-bold flex items-center"><CheckCircle className="text-green-500 mr-3 h-6 w-6" /> Follow the Law</h3>
                <p>Respect all applicable local and international laws. Do not use Lonkind for any illegal activities, including buying or selling regulated goods.</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
            <CardHeader>
                <CardTitle className="text-4xl font-extrabold tracking-tight">Usage Limits & Scaling</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                    This app is currently running on Firebase's free "Spark" plan, which has usage limits.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 text-lg">
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-900">
                    <h3 className="font-bold flex items-center"><AlertTriangle className="h-5 w-5 mr-2" /> Note on Free Plan Limits</h3>
                    <p className="text-base mt-2">Lonkind is in a development phase on a free plan, which is great for building but has hard limits. If these limits are exceeded, some features may temporarily stop working until the next day. This ensures we can offer a free service while developing.</p>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="p-4 rounded-lg bg-muted">
                        <h4 className="font-bold flex items-center gap-2"><Database className="text-primary" /> Firestore Database</h4>
                        <ul className="list-disc pl-5 mt-2 text-base space-y-1">
                            <li><span className="font-semibold">Storage:</span> 1 GiB total</li>
                            <li><span className="font-semibold">Reads:</span> 50,000 / day</li>
                            <li><span className="font-semibold">Writes:</span> 20,000 / day</li>
                        </ul>
                    </div>
                     <div className="p-4 rounded-lg bg-muted">
                        <h4 className="font-bold flex items-center gap-2"><ImageIcon className="text-primary" /> Cloud Storage</h4>
                         <ul className="list-disc pl-5 mt-2 text-base space-y-1">
                            <li><span className="font-semibold">Storage:</span> 5 GiB total</li>
                            <li><span className="font-semibold">Downloads:</span> 1 GB / day</li>
                            <li><span className="font-semibold">Uploads:</span> 20,000 / day</li>
                        </ul>
                    </div>
                     <div className="p-4 rounded-lg bg-muted">
                        <h4 className="font-bold flex items-center gap-2"><Smartphone className="text-primary" /> Authentication</h4>
                         <ul className="list-disc pl-5 mt-2 text-base space-y-1">
                            <li><span className="font-semibold">New Users:</span> 10,000 / month</li>
                            <li><span className="font-semibold">Phone Auth:</span> 10 verifications / day</li>
                        </ul>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-green-50 border border-green-300 text-green-900">
                    <h3 className="font-bold flex items-center"><TrendingUp className="h-5 w-5 mr-2" /> Scaling for Production</h3>
                    <p className="text-base mt-2">For a production app with real users, the project would be upgraded to a pay-as-you-go plan. This model has no hard limits, ensuring the app never goes offline due to high traffic and can scale from a few users to millions affordably.</p>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
