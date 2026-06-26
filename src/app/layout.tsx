
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import '@/ai/genkit';

export const metadata: Metadata = {
  title: 'Lonkind',
  description: 'Connect with friends and family, anytime, anywhere.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Lonkind" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#3B82F6" />
      </head>

      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FirebaseErrorListener />

          {/* 🔥 THIS IS THE FIX */}
          <div className="min-h-screen flex flex-col">
            <main className="flex-1 flex justify-center">
              <div className="w-full max-w-6xl px-4">
                {children}
              </div>
            </main>
          </div>

          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}