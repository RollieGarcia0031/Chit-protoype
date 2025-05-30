
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, UserCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 sm:space-y-12 text-center">
      {/* Hero Section */}
      <div className="relative w-full max-w-4xl aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/9] lg:aspect-[2/1] rounded-lg overflow-hidden shadow-xl">
        <Image
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1280&h=500&fit=crop"
          alt="Modern desk setup with laptop and monitor"
          layout="fill"
          objectFit="cover"
          priority
          data-ai-hint="desk workspace"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 py-10 sm:p-8 sm:py-12 md:p-10 md:py-16 bg-black/60 text-primary-foreground rounded-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
            Welcome to <span className="text-primary drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)] dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Chit</span> — Smart Exam Creation Made Simple
          </h1>
          <p className="mt-3 sm:mt-4 max-w-xl sm:max-w-2xl text-sm sm:text-base md:text-lg text-primary-foreground/90">
            Effortlessly create, store, and share exams in minutes.
            Focus on teaching, let us handle the formatting.
          </p>
          <p className="mt-2 max-w-lg sm:max-w-xl text-xs sm:text-sm font-semibold text-primary-foreground/80 italic">
            From Idea to Exam, Faster Than Ever. <br className="sm:hidden"/>No more templates. No more formatting struggles.
          </p>
          <Button asChild size="lg" className="mt-6 sm:mt-8">
            <Link href="/signup">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Value Proposition Section */}
      <section className="w-full max-w-3xl py-6 sm:py-8 px-4 sm:px-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-2 sm:mb-3 text-foreground">
          Designed for Teachers, Built for Simplicity.
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
          Chit streamlines exam creation with an intuitive interface and smart automation.
          Create, manage, and distribute exams directly from your browser — all backed by secure cloud storage.
        </p>
      </section>

      {/* Features Highlights Section */}
      <section className="w-full max-w-4xl py-6 sm:py-8 px-4 sm:px-6 bg-card rounded-lg shadow-md">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-4 sm:mb-6 text-card-foreground">Features Highlights</h2>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center p-3 sm:p-4 text-center">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2 sm:mb-3" />
            <h3 className="text-md sm:text-lg font-medium mb-1 text-card-foreground">Instant Exam Creation</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Draft structured exams in a few clicks.</p>
          </div>
          <div className="flex flex-col items-center p-3 sm:p-4 text-center">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2 sm:mb-3" />
            <h3 className="text-md sm:text-lg font-medium mb-1 text-card-foreground">Download or Share with Ease</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Generate polished DOCX files, ready to print or send.</p>
          </div>
          <div className="flex flex-col items-center p-3 sm:p-4 text-center">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2 sm:mb-3" />
            <h3 className="text-md sm:text-lg font-medium mb-1 text-card-foreground">Smart AI Suggestions</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Get AI-powered feedback to enhance your exam questions.</p>
          </div>
          <div className="flex flex-col items-center p-3 sm:p-4 text-center">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2 sm:mb-3" />
            <h3 className="text-md sm:text-lg font-medium mb-1 text-card-foreground">Secure & Always Accessible</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">All your exams, stored safely in the cloud, accessible anytime.</p>
          </div>
        </div>
      </section>

      {/* Why Chit? Section */}
      <section className="w-full max-w-3xl py-6 sm:py-8 px-4 sm:px-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-2 sm:mb-3 text-foreground">
          Why Chit?
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-3 sm:mb-4">
          Say goodbye to clunky tools and messy documents.
          Chit is your all-in-one exam creation workspace.
        </p>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
         Seamlessly get AI suggestions for smarter exams, while keeping your data safe with Firebase&apos;s secure platform.
        </p>
      </section>

      {/* Founder Section */}
      <section className="w-full max-w-3xl py-6 sm:py-8 px-4 sm:px-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 text-foreground">
          Meet the Founder
        </h2>
        <Link 
          href="https://angelo-rollie.vercel.app/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow group"
        >
          <UserCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-primary group-hover:text-primary/80 transition-colors" />
          <div className="text-center sm:text-left">
            <h3 className="text-lg sm:text-xl font-medium text-card-foreground group-hover:text-primary transition-colors">
              Rollie Garcia
            </h3>
            <p className="text-sm text-muted-foreground">
              Creator of Chit
            </p>
          </div>
        </Link>
      </section>

      {/* Call to Action Section */}
      <section className="w-full max-w-3xl py-8 sm:py-12 px-4 sm:px-6 bg-primary/10 rounded-lg shadow-inner">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-2 sm:mb-3 text-primary">
          Try Chit Today.
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-4 sm:mb-6">
          Save hours. Create smarter exams. Empower your classroom.
        </p>
        <Button asChild size="lg">
          <Link href="/signup">
            Sign Up for Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
