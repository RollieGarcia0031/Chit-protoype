
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

const PoolOptionSchema = z.object({ // For choice pools in PooledChoices blocks
  id: z.string(),
  text: z.string().describe("The text content of an option in the choice pool."),
});

const PairSchema = z.object({
  id: z.string(),
  premise: z.string().describe("The premise part of a matching pair."),
  response: z.string().describe("The response part of a matching pair."),
  responseLetter: z.string().optional().describe("The letter assigned to the response for matching."),
});

const ExamQuestionSchema = z.object({
  id: z.string().describe("Unique identifier for the question."),
  questionText: z.string().describe("The main text or instruction for the question."),
  points: z.number().describe("Points awarded for this question."),
  type: z.enum(['multiple-choice', 'true-false', 'matching', 'pooled-choices']).describe("The type of the question."),
  options: z.array(OptionSchema).optional().describe("List of options for multiple-choice questions. Required if type is 'multiple-choice'."),
  correctAnswer: z.boolean().nullable().optional().describe("The correct answer for true/false questions (true or false). Null if not set. Required if type is 'true-false'."),
  pairs: z.array(PairSchema).optional().describe("List of premise-response pairs for matching questions. Required if type is 'matching'."),
  correctAnswersFromPool: z.array(z.string()).optional().describe("For 'pooled-choices' questions, an array of strings representing the text of the correct answers selected from the block's choice pool. Required if type is 'pooled-choices'."),
});

const ExamBlockSchema = z.object({
  id: z.string().describe("Unique identifier for the block."),
  blockType: z.enum(['multiple-choice', 'true-false', 'matching', 'pooled-choices']).describe("The type of questions in this block."),
  blockTitle: z.string().optional().describe("Optional title or instructions for the entire block."),
  choicePool: z.array(PoolOptionSchema).optional().describe("For 'pooled-choices' blocks, this is the shared list of answer options available to all questions in this block. Required if blockType is 'pooled-choices'."),
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
  suggestionText: z.string().describe("The detailed suggestion or feedback provided by the AI. Should refer to items by their 1-based number (e.g., 'Block 1, Question 2')."),
  severity: z.enum(['error', 'warning', 'info']).default('info').optional().describe("Severity of the suggestion (e.g., error, warning, info)."),
  elementPath: z.string().optional().describe("A dot-notation path to the specific element the suggestion refers to (e.g., 'examTitle', 'examBlocks[0].blockTitle', 'examBlocks[0].questions[1].questionText', 'examBlocks[0].questions[1].options[0].text', 'examBlocks[0].questions[1].correctAnswer', 'examBlocks[0].questions[1].pairs[0].premise', 'examBlocks[0].choicePool[0].text', 'examBlocks[0].questions[0].correctAnswersFromPool[0]'). Uses zero-based indexing."),
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
- For matching questions: Clear and distinct premises and responses. Ensure a logical and fair matching is possible. Check for unique response letters within a block.
- For pooled-choices questions: Clarity and distinctness of options in the 'choicePool'. Ensure 'correctAnswersFromPool' for each question accurately reference items from the 'choicePool'. Check if questions make sense given they select from a fixed pool.

Exam Details:
Title: {{{examTitle}}}
{{#if examDescription}}Description: {{{examDescription}}}{{/if}}

Exam Blocks:
{{#each examBlocks as |block blockIndex|}}
Block (Index: {{blockIndex}}) - ID: {{block.id}}, Type: {{block.blockType}}
{{#if block.blockTitle}}Block Instructions: {{{block.blockTitle}}}{{/if}}
{{#if block.choicePool}}
  Choice Pool for Block {{blockIndex}} (ID: {{block.id}}):
  {{#each block.choicePool as |poolOpt poolOptIndex|}}
  - Pool Option (Index: {{poolOptIndex}}) ID {{poolOpt.id}}: "{{poolOpt.text}}"
  {{/each}}
{{/if}}
  Questions:
  {{#each block.questions as |question questionIndex|}}
  - Question (Index: {{questionIndex}} in Block {{blockIndex}}) - ID: {{question.id}}, Type: {{question.type}}, Points: {{question.points}}
    Text: {{{question.questionText}}}
    {{#if question.options}}
    Options (for Question at index {{questionIndex}} in Block {{blockIndex}}):
      {{#each question.options as |option optionIndex|}}
      - Option (Index: {{optionIndex}}) ID {{option.id}}: "{{option.text}}" (Correct: {{option.isCorrect}})
      {{/each}}
    {{/if}}
    Value for 'correctAnswer' field (used for True/False questions, where 'null' or empty means not set): {{{question.correctAnswer}}}
    {{#if question.pairs}}
    Matching Pairs (for Question at index {{questionIndex}} in Block {{blockIndex}}):
      {{#each question.pairs as |pair pairIndex|}}
      - Pair (Index: {{pairIndex}}) ID {{pair.id}}: Premise: "{{pair.premise}}" --- Response: "{{pair.response}}" (Letter: {{pair.responseLetter}})
      {{/each}}
    {{/if}}
    {{#if question.correctAnswersFromPool}}
    Correct Answers from Pool (for Question at index {{questionIndex}} in Block {{blockIndex}}):
      {{#each question.correctAnswersFromPool as |ans answerIndex|}}
      - Answer {{answerIndex}}: "{{ans}}"
      {{/each}}
    {{/if}}
  {{/each}}
--------------------
{{/each}}

Based on your analysis, provide a list of suggestions as a bulleted list under the 'suggestionText' field of each suggestion object.
For each suggestion:
- In 'suggestionText', refer to blocks and questions by their 1-based numbers. For example, if the input shows "Block (Index: 0)", refer to it as "Block 1". If it shows "Question (Index: 1 in Block 0)", refer to it as "Question 2 in Block 1".
- Make the 'suggestionText' clear and easy for a non-technical user to understand where the issue is located. For instance, "In Block 1, Question 2, the phrasing is ambiguous..." or "The title for Block 2 could be more specific."
- Optionally include 'blockId' and 'questionId' if the suggestion is specific to a block or question (use the actual IDs from the input).
- Optionally include 'severity' ('error', 'warning', 'info'). Default to 'info'.
- Optionally include 'elementPath' to pinpoint the exact field using zero-based indices for programmatic use. Examples:
  - 'examTitle'
  - 'examBlocks[0].blockTitle'
  - 'examBlocks[0].choicePool[1].text'
  - 'examBlocks[0].questions[1].questionText'
  - 'examBlocks[0].questions[1].options[0].text'
  - 'examBlocks[0].questions[1].correctAnswer'
  - 'examBlocks[0].questions[1].pairs[0].premise'
  - 'examBlocks[0].questions[1].correctAnswersFromPool[0]'
  (Replace INDEX with the actual zero-based index from the input, e.g., if input says "Block (Index: 2)", the path uses \`examBlocks[2]\`).

Return your entire response as a single, valid JSON object matching the specified output schema. If no suggestions, return an empty "suggestions" array.
`,
config: {
    temperature: 0.3, 
    safetySettings: [ 
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
    if (!input.examTitle && input.examBlocks.length === 0) {
      return { suggestions: [{ suggestionText: "Exam content is empty. Please add a title or some questions to analyze.", severity: "warning" }] };
    }
    if (input.examBlocks.every(block => block.questions.length === 0) && input.examBlocks.length > 0) {
        return { suggestions: [{ suggestionText: "All question blocks are empty. Add questions to get feedback.", severity: "warning" }] };
    }

    const {output} = await analyzeExamPrompt(input);
    if (!output) {
      return { suggestions: [{ suggestionText: "AI analysis failed to produce output. Please try again.", severity: "error" }] };
    }
    return { suggestions: output.suggestions || [] };
  }
);

export async function analyzeExamFlow(input: AnalyzeExamInput): Promise<AnalyzeExamOutput> {
  return analyzeExamFlowInstance(input);
}
