
// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CreateExamPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight">Create New Exam</CardTitle>
          <CardDescription>Fill in the details below to create a new exam.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="examTitle" className="text-base">Exam Title</Label>
              <Input id="examTitle" placeholder="e.g., Midterm Mathematics" className="text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examDescription" className="text-base">Description (Optional)</Label>
              <Textarea id="examDescription" placeholder="A brief description of the exam content or instructions." className="text-base min-h-[100px]" />
            </div>
            {/* Add more form fields for exam questions, settings, etc. later */}
            <div className="flex justify-end pt-4">
              <Button type="submit" size="lg">
                Save Exam
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* Placeholder for AI-powered question generation or other features */}
      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="text-xl">AI Tools</CardTitle>
            <CardDescription>Use AI to help generate questions or exam structures.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">AI features coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
