
import { InstructionsComponent } from "@/components/instructions-component";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quick Start Instructions - ViteStart',
  description: 'Learn how to get started with the ViteStart Next.js template.',
};

export default function InstructionsPage() {
  return (
    <div>
      <InstructionsComponent />
    </div>
  );
}
