
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-12 text-center">
      {/* Hero Section */}
      <div className="relative w-full max-w-4xl aspect-[16/9] sm:aspect-[2/1] md:aspect-[16/7] rounded-lg overflow-hidden shadow-xl">
        <Image
          src="https://placehold.co/1280x500.png"
          alt="Abstract background representing smart exam creation"
          layout="fill"
          objectFit="cover"
          priority
          data-ai-hint="education technology"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent flex flex-col items-center justify-center p-6 sm:p-8 text-primary-foreground">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Welcome to <span className="text-primary drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Chit</span> — Smart Exam Creation Made Simple
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg md:text-xl text-primary-foreground/90">
            Effortlessly create, store, and share exams in minutes.
            Focus on teaching, let us handle the formatting.
          </p>
          <p className="mt-2 max-w-xl text-sm sm:text-md font-semibold text-primary-foreground/80 italic">
            From Idea to Exam, Faster Than Ever.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/signup">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Value Proposition Section */}
      <section className="w-full max-w-3xl py-8 px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3 text-foreground">
          Designed for Teachers, Built for Simplicity.
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground">
          Chit streamlines exam creation with an intuitive interface and smart automation.
          Create, manage, and distribute exams directly from your browser — all backed by secure cloud storage.
        </p>
      </section>

      {/* Features Highlights Section */}
      <section className="w-full max-w-4xl py-8 px-4 sm:px-6 bg-card rounded-lg shadow-md">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-6 text-card-foreground">Features Highlights</h2>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center p-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
            <h3 className="text-lg sm:text-xl font-medium mb-1 text-card-foreground">Instant Exam Creation</h3>
            <p className="text-sm text-muted-foreground">Draft structured exams in a few clicks.</p>
          </div>
          <div className="flex flex-col items-center p-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
            <h3 className="text-lg sm:text-xl font-medium mb-1 text-card-foreground">Download or Share</h3>
            <p className="text-sm text-muted-foreground">Generate polished DOCX files, ready to print or send.</p>
          </div>
          <div className="flex flex-col items-center p-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
            <h3 className="text-lg sm:text-xl font-medium mb-1 text-card-foreground">Smart AI Suggestions</h3>
            <p className="text-sm text-muted-foreground">Get AI-powered feedback to enhance your exam questions.</p>
          </div>
          <div className="flex flex-col items-center p-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
            <h3 className="text-lg sm:text-xl font-medium mb-1 text-card-foreground">Secure & Accessible</h3>
            <p className="text-sm text-muted-foreground">Exams stored safely, accessible anytime.</p>
          </div>
        </div>
      </section>

      {/* Why Chit? Section */}
      <section className="w-full max-w-3xl py-8 px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3 text-foreground">
          Why Chit?
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground mb-4">
          Say goodbye to clunky tools and messy documents.
          Chit is your all-in-one exam creation workspace.
        </p>
        <p className="text-base sm:text-lg text-muted-foreground">
         Seamlessly get AI suggestions for smarter exams, while keeping your data safe with Firebase&apos;s secure platform.
        </p>
      </section>

      {/* Call to Action Section */}
      <section className="w-full max-w-3xl py-12 px-4 sm:px-6 bg-primary/10 rounded-lg shadow-inner">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3 text-primary">
          Try Chit Today.
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground mb-6">
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
