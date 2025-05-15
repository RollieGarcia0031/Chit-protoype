
// src/app/(protected)/students/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center">
            <Users className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Students
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Manage your students and their progress here. (Feature coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Student Management Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground">
              This section will allow you to add students, track their exam attempts, and view their performance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
