
// src/components/exam/TotalPointsDisplay.tsx
'use client';

import { useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';

interface TotalPointsDisplayProps {
  totalPoints: number;
}

export function TotalPointsDisplay({ totalPoints }: TotalPointsDisplayProps) {
  const { state: sidebarState } = useSidebar();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Badge
        variant="secondary"
        className="fixed top-[calc(theme(spacing.14)_+_0.5rem)] right-4 z-50 shadow-lg text-xs sm:text-sm py-1.5 sm:py-2 px-2 sm:px-3" // Positioned below a h-14 top bar
      >
        <Coins className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Points: {totalPoints}
      </Badge>
    );
  }

  // Only show on desktop if the sidebar is collapsed
  if (sidebarState === 'collapsed' && !isMobile) {
    return (
      <Badge
        variant="secondary"
        className="fixed top-1/2 z-50 shadow-lg transform -translate-y-1/2 transition-all duration-300 ease-in-out text-xs sm:text-sm py-1.5 sm:py-2 px-2 sm:px-3"
        style={{ left: 'calc(var(--sidebar-width-icon) + 1rem)' }} // Position next to the collapsed sidebar
      >
        <Coins className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Total Points: {totalPoints}
      </Badge>
    );
  }

  return null; // Hidden on desktop when sidebar is expanded or if not mobile and sidebar not collapsed
}
