
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 text-center">
      <div className="relative w-full max-w-3xl aspect-[16/9] rounded-lg overflow-hidden shadow-xl">
        <Image 
          src="https://picsum.photos/1280/720" 
          alt="Social connection abstract background"
          layout="fill"
          objectFit="cover"
          priority
          data-ai-hint="social connection"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex flex-col items-center justify-center p-8">
           <h1 className="text-5xl font-bold tracking-tight text-primary-foreground sm:text-6xl md:text-7xl">
            Welcome to <span className="text-primary drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">Chit</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/90 sm:text-xl">
            Your new platform to connect, share, and discover. Join the conversation today!
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/signup">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      <section className="w-full max-w-3xl py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col items-center p-6 bg-card rounded-lg shadow-md text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users-round mb-4"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="4"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-10 0c-2 1.5-4 4.63-4 8"/></svg>
            <h3 className="text-xl font-semibold mb-2">Connect with Others</h3>
            <p className="text-muted-foreground">Find and connect with people who share your interests. Build your community on Chit.</p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card rounded-lg shadow-md text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-share mb-4"><path d="M21 12v3a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h7.5"/><path d="M16 3h5v5"/><path d="m16 8 5-5"/></svg>
            <h3 className="text-xl font-semibold mb-2">Share Your Moments</h3>
            <p className="text-muted-foreground">Post updates, photos, and thoughts. Let your voice be heard and engage with your followers.</p>
          </div>
        </div>
      </section>
      
    </div>
  );
}
