
'use server';
/**
 * @fileOverview An AI agent for analyzing and providing feedback on exam questions.
 *
 * - analyzeExam - A function that processes an exam draft and returns AI suggestions.
 * - AnalyzeExamInput - The input type for the analyzeExam function.
 * - AnalyzeExamOutput - The return type for the analyzeExam function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schemas for different question components, aligned with exam-types.ts

const GenkitOptionSchema = z.object({
  id: z.string().describe("Client-side unique identifier for the option."),
  text: z.string().describe("The text content of the option."),
  isCorrect: z.boolean().describe("Indicates if this option is the correct answer."),
});

const GenkitPairSchema = z.object({
  id: z.string().describe("Client-side unique identifier for the matching pair."),
  premise: z.string().describe("The premise part of the matching pair."),
  response: z.string().describe("The response part of the matching pair."),
});

const GenkitBaseQuestionSchema = z.object({
  id: z.string().describe("Client-side unique identifier for the question. This ID will be used to map feedback back to this question."),
  questionText: z.string().describe("The main text or instruction for the question."),
  points: z.number().describe("The number of points allocated to this question."),
});

const GenkitMultipleChoiceQuestionSchema = GenkitBaseQuestionSchema.extend({
  type: z.literal('multiple-choice').describe("Indicates a multiple-choice question type."),
  options: z.array(GenkitOptionSchema).describe("An array of options for the multiple-choice question."),
});

const GenkitTrueFalseQuestionSchema = GenkitBaseQuestionSchema.extend({
  type: z.literal('true-false').describe("Indicates a true/false question type."),
  correctAnswer: z.boolean().nullable().describe("The correct answer (true or false). Null if not set by the user."),
});

const GenkitMatchingTypeQuestionSchema = GenkitBaseQuestionSchema.extend({
  type: z.literal('matching').describe("Indicates a matching type question."),
  pairs: z.array(GenkitPairSchema).describe("An array of premise-response pairs for the matching question."),
});

const GenkitExamQuestionSchema = z.discriminatedUnion("type", [
  GenkitMultipleChoiceQuestionSchema,
  GenkitTrueFalseQuestionSchema,
  GenkitMatchingTypeQuestionSchema,
]).describe("A single exam question, which can be multiple-choice, true/false, or matching type.");


const GenkitExamBlockSchema = z.object({
  id: z.string().describe("Client-side unique identifier for the block of questions."),
  blockType: z.enum(['multiple-choice', 'true-false', 'matching']).describe("The common type of questions within this block."),
  blockTitle: z.string().optional().describe("Optional title or specific instructions for this block of questions."),
  questions: z.array(GenkitExamQuestionSchema).describe("An array of questions contained within this block."),
});

export const AnalyzeExamInputSchema = z.object({
  examTitle: z.string().describe("The overall title of the exam being analyzed."),
  examDescription: z.string().optional().describe("An optional description for the exam."),
  examBlocks: z.array(GenkitExamBlockSchema).describe("An array of question blocks that constitute the exam content."),
});
export type AnalyzeExamInput = z.infer<typeof AnalyzeExamInputSchema>;

export const QuestionSuggestionSchema = z.object({
  questionId: z.string().describe("The ID of the question this feedback pertains to. This MUST match one of the input question IDs."),
  feedback: z.string().describe("Specific, constructive feedback regarding the question's clarity, correctness of the answer, potential ambiguities, grammar, spelling, and overall quality. If the question is well-formed and the answer correct, state this. If issues are found, explain them and suggest improvements."),
  hasIssue: z.boolean().describe("Set to true if a significant potential issue (e.g., factually incorrect answer, critical ambiguity, major grammatical error affecting meaning) was identified. Set to false if the question and answer seem generally correct and clear, even if minor stylistic suggestions are made."),
});
export type QuestionSuggestion = z.infer<typeof QuestionSuggestionSchema>;


export const AnalyzeExamOutputSchema = z.object({
  suggestions: z.array(QuestionSuggestionSchema).describe("An array of feedback entries, one for each question analyzed from the input."),
});
export type AnalyzeExamOutput = z.infer<typeof AnalyzeExamOutputSchema>;


export async function analyzeExam(input: AnalyzeExamInput): Promise<AnalyzeExamOutput> {
  // Handle case with no questions to avoid unnecessary LLM call / potential error
  if (!input.examBlocks.some(block => block.questions.length > 0)) {
    return { suggestions: [] };
  }
  return analyzeExamFlow(input);
}

const analyzeExamPrompt = ai.definePrompt({
  name: 'analyzeExamPrompt',
  input: { schema: AnalyzeExamInputSchema },
  output: { schema: AnalyzeExamOutputSchema },
  prompt: `You are an expert AI exam reviewer and educational content analyst.
Your goal is to review an exam draft, structured according to the AnalyzeExamInputSchema, and provide feedback for each question.
The exam draft details (title, description, blocks, questions, types, answers) are all provided in the input.

Exam Title: {{examTitle}}
{{#if examDescription}}Exam Description: {{examDescription}}{{/if}}

For each question in the \`examBlocks\`, you MUST generate an object containing:
- \`questionId\`: The ID of the question (e.g., "question-xyz-123"). This MUST match an ID from the input question.
- \`feedback\`: Specific, constructive feedback. Address clarity, correctness of the provided answer, potential ambiguities, grammar, spelling, and overall quality. If the question is good, say so. If there are issues, explain them clearly and suggest improvements. Be concise yet thorough.
- \`hasIssue\`: \`true\` if you found any significant issue (e.g., incorrect answer, major ambiguity, typo that changes meaning), \`false\` otherwise. Minor stylistic suggestions can have \`hasIssue: false\`.

Consider the following for different question types based on the input data:
- Multiple Choice questions (type: 'multiple-choice'):
  - Is the \`isCorrect\` flag accurate for each option in the \`options\` array?
  - Is there a single best, unambiguously correct answer among the options?
  - Are the distractor options plausible yet clearly incorrect?
- True/False questions (type: 'true-false'):
  - Is the \`correctAnswer\` field (which can be true, false, or null if not set by the user) accurate?
  - Is the statement in \`questionText\` unambiguously true or false?
- Matching questions (type: 'matching'):
  - Do the premise-response \`pairs\` form logical and correct associations?
  - Are the premises and responses clearly worded?

Input exam content to review:
{{#each examBlocks}}
Block (ID: {{this.id}}, Type: {{this.blockType}}):
{{#if this.blockTitle}}  Block-level Instructions: {{this.blockTitle}}{{/if}}
  {{#each this.questions}}
  - Question (ID: {{this.id}}):
    Text: "{{this.questionText}}" (Points: {{this.points}})
    Type: {{this.type}}
    {{#if this.options}}
    Options (Multiple Choice):
      {{#each this.options}}
      * "{{this.text}}" (Is Marked Correct: {{this.isCorrect}}) (Option ID: {{this.id}})
      {{/each}}
    {{/if}}
    {{#if (isTruthy this.correctAnswer)}}
    Correct Answer (True/False): {{this.correctAnswer}}
    {{else}}
      {{#if (eq (typeOf this.correctAnswer) "boolean")}}
    Correct Answer (True/False): {{this.correctAnswer}} 
      {{else}}
        {{#if (is_null this.correctAnswer)}}
    Correct Answer (True/False): Not set by user
        {{/if}}
      {{/if}}
    {{/if}}
    {{#if this.pairs}}
    Pairs (Matching):
      {{#each this.pairs}}
      * Premise: "{{this.premise}}" (Pair ID: {{this.id}}) --- Response: "{{this.response}}"
      {{/each}}
    {{/if}}
  --- End of Question {{this.id}} details ---
  {{/each}}
{{/each}}

Please process all questions found in the \`examBlocks\` of the input.
Your entire response MUST be a JSON object strictly conforming to the AnalyzeExamOutputSchema.
If there are no questions in any block, return an empty \`suggestions\` array.
`,
  // Register necessary Handlebars helpers
  handlebarsHelpers: {
    is_null: (value: any) => value === null,
    eq: (a: any, b: any) => a === b,
    isTruthy: (value: any) => !!value, // Checks for truthiness, careful with `false`
    typeOf: (value: any) => typeof value,
  }
});


const analyzeExamFlow = ai.defineFlow(
  {
    name: 'analyzeExamFlow',
    inputSchema: AnalyzeExamInputSchema,
    outputSchema: AnalyzeExamOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeExamPrompt(input);
    if (!output) {
        // This case should ideally be handled by the prompt ensuring JSON output,
        // but as a fallback, return empty suggestions.
        console.error("AI analysis returned no output. Input:", JSON.stringify(input));
        return { suggestions: [] };
    }
    // Ensure suggestions array exists, even if empty, to match schema
    return { suggestions: output.suggestions || [] };
  }
);
