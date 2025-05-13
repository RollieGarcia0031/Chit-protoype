
// src/app/(protected)/exams/page.tsx
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";

// Mock data for exams - replace with actual data fetching
const mockExams = [
  { id: "1", title: "Midterm Mathematics", dateCreated: "2024-07-15", status: "Published", questions: 25 },
  { id: "2", title: "History 101 Final", dateCreated: "2024-07-10", status: "Draft", questions: 50 },
  { id: "3", title: "Physics Quiz 3", dateCreated: "2024-06-28", status: "Published", questions: 10 },
  { id: "4", title: "Literature Essay Exam", dateCreated: "2024-05-12", status: "Archived", questions: 5 },
];

export default function ViewExamsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Exams</h1>
            <p className="text-muted-foreground">Manage and review your created exams.</p>
        </div>
        <Button asChild>
            <Link href="/create-exam">Create New Exam</Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Exam List</CardTitle>
          <CardDescription>
            A list of all exams you have created. You can edit, view results, or delete them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mockExams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{exam.dateCreated}</TableCell>
                    <TableCell>
                      <Badge variant={exam.status === 'Published' ? 'default' : exam.status === 'Draft' ? 'secondary' : 'outline'}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{exam.questions}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" aria-label="Edit Exam">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" aria-label="View Exam Results" className="text-primary hover:text-primary">
                         <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" aria-label="Delete Exam">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-lg">No exams created yet.</p>
              <Button asChild className="mt-4">
                <Link href="/create-exam">Create Your First Exam</Link>
              </Button>
            </div>
          )}
        </CardContent>
        {mockExams.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
                Showing {mockExams.length} exams.
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
