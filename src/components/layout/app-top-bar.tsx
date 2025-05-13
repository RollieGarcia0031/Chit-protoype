
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { ChitLogo } from '@/components/icons/logo';
import Link from 'next/link';

export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center"> {/* Changed from md:hidden to always show trigger */}
          <SidebarTrigger />
        </div>
        <div className="flex items-center space-x-2 ml-2 md:hidden">
            <Link href="/" className="flex items-center gap-2" aria-label="Chit Home">
                <ChitLogo className="h-6 w-auto text-primary" />
            </Link>
        </div>
        <div className="hidden md:flex flex-1 items-center ml-4">
           {/* Placeholder for desktop top bar content like breadcrumbs or app section title */}
           {/* For instance, you could display the app name or current page title */}
           <h1 className="text-lg font-semibold text-foreground">Chit</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Future actions like theme toggle, notifications, etc. */}
        </div>
      </div>
    </header>
  );
}
