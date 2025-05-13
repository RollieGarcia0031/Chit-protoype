import Link from 'next/link';
import { ViteStartLogo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="ViteStart Home">
          <ViteStartLogo className="h-8 w-auto text-primary" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/instructions" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Instructions</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
