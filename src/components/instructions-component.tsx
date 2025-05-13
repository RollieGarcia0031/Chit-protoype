import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FolderKanban, PlaySquare, FilePlus, Palette, ExternalLink } from "lucide-react";

const InstructionItem = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <li className="flex items-start gap-4 py-3">
    <div className="flex-shrink-0 text-primary pt-1">{icon}</div>
    <div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <div className="text-muted-foreground text-sm">{children}</div>
    </div>
  </li>
);

export function InstructionsComponent() {
  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">Quick Start Guide</CardTitle>
        <CardDescription className="text-md">
          Follow these steps to understand and start using your ViteStart Next.js template.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4 divide-y divide-border">
          <InstructionItem icon={<FolderKanban className="h-6 w-6" />} title="Project Structure">
            <p>Familiarize yourself with the key directories:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
              <li><strong><code>src/app</code></strong>: Contains all your routes, pages, and layouts (App Router).</li>
              <li><strong><code>src/components</code></strong>: Shared UI components. Organized further into <code>ui</code> (ShadCN) and <code>layout</code>.</li>
              <li><strong><code>src/lib</code></strong>: Utility functions, e.g., <code>cn</code> for classnames.</li>
              <li><strong><code>public</code></strong>: Static assets like images or fonts.</li>
              <li><strong><code>src/app/globals.css</code></strong>: Global styles and Tailwind CSS theme customization.</li>
            </ul>
          </InstructionItem>

          <InstructionItem icon={<PlaySquare className="h-6 w-6" />} title="Running the Development Server">
            <p>To start the local development server:</p>
            <pre className="mt-2 p-3 bg-secondary rounded-md text-sm text-secondary-foreground overflow-x-auto"><code>npm run dev</code></pre>
            <p className="mt-1">Your app will be available at <a href="http://localhost:9002" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">http://localhost:9002</a> (or the port specified in your <code>package.json</code>).</p>
          </InstructionItem>

          <InstructionItem icon={<FilePlus className="h-6 w-6" />} title="Adding New Pages">
            <p>Create new pages using the Next.js App Router:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1 pl-2">
              <li>Create a new folder inside <code>src/app</code> (e.g., <code>src/app/about</code>).</li>
              <li>Inside this folder, create a <code>page.tsx</code> file (e.g., <code>src/app/about/page.tsx</code>).</li>
              <li>This will automatically create a route at <code>/about</code>.</li>
            </ol>
          </InstructionItem>

          <InstructionItem icon={<Palette className="h-6 w-6" />} title="Customizing Styles">
            <p>Styles are managed primarily with Tailwind CSS and ShadCN UI components:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
              <li>Modify <strong><code>src/app/globals.css</code></strong> to update the base theme (colors, fonts, etc.). The HSL variables define the color palette.</li>
              <li>Use Tailwind utility classes directly in your components for styling.</li>
              <li>Leverage pre-built components from <strong><code>src/components/ui</code></strong>.</li>
              <li>For more on ShadCN components, visit their documentation.
                <a href="https://ui.shadcn.com/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline ml-1">
                   ShadCN Docs <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </li>
            </ul>
          </InstructionItem>
          
          <InstructionItem icon={<CheckCircle className="h-6 w-6" />} title="Next Steps">
            <p>You're all set to start building!</p>
             <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                <li>Begin by modifying <code>src/app/page.tsx</code> or creating new routes.</li>
                <li>Explore the existing components and add your own.</li>
                <li>Refer to Next.js and Tailwind CSS documentation for advanced features.</li>
            </ul>
          </InstructionItem>
        </ul>
      </CardContent>
    </Card>
  );
}
