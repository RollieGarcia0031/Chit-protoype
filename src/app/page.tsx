import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 text-center">
      <div className="relative w-full max-w-2xl aspect-[2/1] rounded-lg overflow-hidden shadow-xl">
        <Image 
          src="https://picsum.photos/800/400" 
          alt="Abstract technology background"
          layout="fill"
          objectFit="cover"
          priority
          data-ai-hint="abstract tech"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col items-center justify-end p-8">
           <h1 className="text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl md:text-6xl">
            Welcome to <span className="text-primary drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">ViteStart</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-primary-foreground/90 sm:text-xl">
            Your Next.js starting point for building amazing applications, scaffolded with professional design and best practices.
          </p>
        </div>
      </div>

      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Get Started Quickly</CardTitle>
          <CardDescription>
            Follow our simple instructions to get your project up and running in no time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This template provides a base structure with routing and a clean UI to kickstart your development.
            Explore the features and customize it to fit your needs.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/instructions">
              View Instructions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
