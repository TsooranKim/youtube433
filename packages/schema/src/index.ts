import { z } from "zod";

export const quizSchema = z.object({
  question: z.string().trim(),
  choices: z.array(z.string().trim()).length(4),
  answer: z.number().int().min(1),
  explanation: z.string().trim().optional(),
});
export type Quiz = z.infer<typeof quizSchema>;

export const quizListSchema = quizSchema.array();
export type QuizList = z.infer<typeof quizListSchema>;

export const quizValidationSchema = z.object({
  issues: z.array(
    z.object({
      question: z.string(),
      choices: z.array(z.string()),
      answer: z.number(),
      explanation: z.string().optional(),
      details: z.object({
        "주제와 일치 여부": z.string(),
        난이도: z.string(),
        중복성: z.string(),
        "유사 문제": z.string(),
        자연스러움: z.string(),
        "규칙 준수 여부": z.string(),
      }),
      evaluation: z.enum(["적절함", "부적절함"]),
      종합부적합이유: z.string().optional(),
    }),
  ),
  overall_evaluation: z.enum(["적절함", "부적절함"]),
  invalid_questions: z.array(z.number()),
});
export type QuizValidation = z.infer<typeof quizValidationSchema>;
