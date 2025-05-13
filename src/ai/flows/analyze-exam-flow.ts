
'use server';
/**
 * @fileOverview An AI agent for analyzing exam content and providing suggestions.
 *
 * - analyzeExamFlow - A function that handles the exam analysis process.
 * - AnalyzeExamInput - The input type for the analyzeExamFlow function.
 * - AnalyzeExamOutput - The return type for the analyzeExamFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Zod Schemas mirroring src/types/exam-types.ts for validation and AI prompting
const OptionSchema = z.object({
  id: z.string(),
  text: z.string().describe("The text content of the multiple-choice option."),
  isCorrect: z.boolean().describe("Indicates if this option is the correct answer."),
});

const PairSchema = z.object({
  id: z.string(),
  premise: z.string().describe("The premise part of a matching pair."),
  response: z.string().describe("The response part of a matching pair."),
});

const ExamQuestionSchema = z.object({
  id: z.string().describe("Unique identifier for the question."),
  questionText: z.string().describe("The main text or instruction for the question."),
  points: z.number().describe("Points awarded for this question."),
  type: z.enum(['multiple-choice', 'true-false', 'matching']).describe("The type of the question."),
  options: z.array(OptionSchema).optional().describe("List of options for multiple-choice questions. Required if type is 'multiple-choice'."),
  correctAnswer: z.boolean().nullable().optional().describe("The correct answer for true/false questions (true or false). Null if not set. Required if type is 'true-false'."),
  pairs: z.array(PairSchema).optional().describe("List of premise-response pairs for matching questions. Required if type is 'matching'."),
});

const ExamBlockSchema = z.object({
  id: z.string().describe("Unique identifier for the block."),
  blockType: z.enum(['multiple-choice', 'true-false', 'matching']).describe("The type of questions in this block."),
  blockTitle: z.string().optional().describe("Optional title or instructions for the entire block."),
  questions: z.array(ExamQuestionSchema).describe("List of questions within this block."),
});

const AnalyzeExamInputSchema = z.object({
  examTitle: z.string().describe("The overall title of the exam."),
  examDescription: z.string().optional().describe("The overall description or instructions for the exam."),
  examBlocks: z.array(ExamBlockSchema).describe("An array of question blocks that make up the exam."),
});
export type AnalyzeExamInput = z.infer<typeof AnalyzeExamInputSchema>;

const SuggestionSchema = z.object({
  blockId: z.string().optional().describe("The ID of the block this suggestion pertains to, if applicable."),
  questionId: z.string().optional().describe("The ID of the question this suggestion pertains to, if applicable."),
  suggestionText: z.string().describe("The detailed suggestion or feedback provided by the AI."),
  severity: z.enum(['error', 'warning', 'info']).default('info').optional().describe("Severity of the suggestion (e.g., error, warning, info)."),
  elementPath: z.string().optional().describe("A dot-notation path to the specific element the suggestion refers to (e.g., 'examTitle', 'examBlocks[0].blockTitle', 'examBlocks[0].questions[1].questionText', 'examBlocks[0].questions[1].options[0].text')."),
});

const AnalyzeExamOutputSchema = z.object({
  suggestions: z.array(SuggestionSchema).describe("A list of suggestions for improving the exam content and structure. Response should be a bulleted list of suggestions."),
});
export type AnalyzeExamOutput = z.infer<typeof AnalyzeExamOutputSchema>;


const analyzeExamPrompt = ai.definePrompt({
  name: 'analyzeExamPrompt',
  input: { schema: AnalyzeExamInputSchema },
  output: { schema: AnalyzeExamOutputSchema },
  prompt: `You are an expert exam reviewer and AI assistant. Your task is to analyze the provided exam content and offer constructive suggestions for improvement.
Focus on identifying potential issues such as:
- Ambiguous or unclear question phrasing.
- Grammatical errors or typos.
- Incorrect information in questions or answers.
- Issues with the difficulty level (if inferable).
- Problems with the structure or format of questions.
- For multiple-choice questions: Plausibility of distractors, clarity of the correct answer, presence of exactly one correct answer. Ensure options are distinct and not too similar or tricky.
- For true-false questions: Unambiguous statements that are clearly true or false. Avoid double negatives or overly complex sentences. The 'correctAnswer' field in the input data (true, false, or null if not set) indicates the intended answer for true/false questions.
- For matching questions: Clear and distinct premises and responses. Ensure a logical and fair matching is possible.

Exam Details:
Title: {{{examTitle}}}
{{#if examDescription}}Description: {{{examDescription}}}{{/if}}

Exam Blocks:
{{#each examBlocks}}
Block ID: {{this.id}} (Type: {{this.blockType}})
{{#if this.blockTitle}}Block Instructions: {{{this.blockTitle}}}{{/if}}
  Questions:
  {{#each this.questions}}
  - Question ID: {{this.id}} (Type: {{this.type}}, Points: {{this.points}})
    Text: {{{this.questionText}}}
    {{#if this.options}}
    Options:
      {{#each this.options}}
      - Opt ID {{this.id}}: "{{this.text}}" (Correct: {{this.isCorrect}})
      {{/each}}
    {{/if}}
    {{! The 'correctAnswer' field (true, false, or null) for true/false questions is available in the input data based on the schema. }}
    {{! The AI should use the 'type' field and the 'correctAnswer' value from the input data. }}
    {{#if this.pairs}}
    Matching Pairs:
      {{#each this.pairs}}
      - Pair ID {{this.id}}: Premise: "{{this.premise}}" --- Response: "{{this.response}}"
      {{/each}}
    {{/if}}
  {{/each}}
--------------------
{{/each}}

Based on your analysis, provide a list of suggestions as a bulleted list under the 'suggestionText' field of each suggestion object. 
For each suggestion:
- Include 'suggestionText' with your feedback (as a bulleted list if multiple points for one suggestion).
- Optionally include 'blockId' and 'questionId' if the suggestion is specific to a block or question.
- Optionally include 'severity' ('error', 'warning', 'info'). Default to 'info'.
- Optionally include 'elementPath' to pinpoint the exact field. Examples:
  - 'examTitle'
  - 'examBlocks[INDEX].blockTitle'
  - 'examBlocks[INDEX].questions[INDEX].questionText'
  - 'examBlocks[INDEX].questions[INDEX].options[INDEX].text'
  - 'examBlocks[INDEX].questions[INDEX].correctAnswer'
  - 'examBlocks[INDEX].questions[INDEX].pairs[INDEX].premise'
  (Replace INDEX with the actual zero-based index).

Return your entire response as a single, valid JSON object matching the specified output schema. If no suggestions, return an empty "suggestions" array.
`,
config: {
    temperature: 0.3, // Lower temperature for more factual and less creative suggestions
    safetySettings: [ // Relax safety settings if needed for educational content review, but be cautious
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  },
});

const analyzeExamFlowInstance = ai.defineFlow(
  {
    name: 'analyzeExamFlowInstance',
    inputSchema: AnalyzeExamInputSchema,
    outputSchema: AnalyzeExamOutputSchema,
  },
  async (input) => {
    // Basic validation: Ensure there's something to analyze
    if (!input.examTitle && input.examBlocks.length === 0) {
      return { suggestions: [{ suggestionText: "Exam content is empty. Please add a title or some questions to analyze.", severity: "warning" }] };
    }
    if (input.examBlocks.every(block => block.questions.length === 0) && input.examBlocks.length > 0) {
        return { suggestions: [{ suggestionText: "All question blocks are empty. Add questions to get feedback.", severity: "warning" }] };
    }


    const {output} = await analyzeExamPrompt(input);
    if (!output) {
      // This case should ideally be handled by the prompt ensuring JSON output,
      // but as a fallback, return an error suggestion.
      return { suggestions: [{ suggestionText: "AI analysis failed to produce output. Please try again.", severity: "error" }] };
    }
    // Ensure suggestions array exists, even if empty, to match schema
    return { suggestions: output.suggestions || [] };
  }
);

export async function analyzeExamFlow(input: AnalyzeExamInput): Promise<AnalyzeExamOutput> {
  return analyzeExamFlowInstance(input);
}

