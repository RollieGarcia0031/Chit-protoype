
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { AppFooter } from '@/components/layout/footer';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopBar } from '@/components/layout/app-top-bar';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar';

export const metadata: Metadata = {
  title: 'Chit',
  description: 'Smart Exam Creation Made Simple', // Updated description
  manifest: '/manifest.json', // Link to your PWA manifest file
  icons: {
    icon: '/favicon.ico', // Standard favicon
    apple: '/apple-touch-icon.png', // Apple touch icon
    // You can add more specific icons here if needed, e.g., for different sizes
    // PWA icons (e.g., 192x192, 512x512) are typically defined in manifest.json
  },
  themeColor: '#19A0A6', // Sets the browser theme color for PWA on mobile
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <SidebarProvider defaultOpen={true}> {/* Desktop sidebar initially open */}
            <AppSidebar />
            {/* This div is the main content area to the right of the sidebar */}
            <div className="flex flex-col flex-1 min-h-screen md:ml-[var(--sidebar-width)] data-[sidebar-collapsed=true]:md:ml-[var(--sidebar-width-icon)] group-[.is-mobile]/sidebar-provider:ml-0 transition-[margin-left] duration-300 ease-in-out">
              <AppTopBar />
              <main className="flex-grow">
                <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
                  {children}
                </div>
              </main>
              <AppFooter />
            </div>
          </SidebarProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
