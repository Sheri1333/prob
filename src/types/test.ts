export type QuestionType = "single_choice" | "multiple_choice" | "matching";

export interface TestOption {
  id: string;
  label: string;
}

export interface MatchingRow {
  id: string;
  label: string;
}

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  text: string;
  images?: string[];
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: "single_choice";
  options: TestOption[];
  /** Absent while taking a test (server strips answers). */
  correctAnswer?: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: TestOption[];
  correctAnswers?: string[];
}

export interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  rows: MatchingRow[];
  options: TestOption[];
  correctAnswers?: Record<string, string>;
}

export type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | MatchingQuestion;

export interface TestDefinition {
  id: string;
  title: string;
  titleKz: string;
  section: string;
  examType: "ENT" | "OGE";
  subject: string;
  durationMinutes: number;
  questionCount: number;
  isFree: boolean;
  priceTenge?: number;
  questions: Question[];
}

export interface CatalogItem {
  id: string;
  title: string;
  titleKz: string;
  examType: "ENT" | "OGE";
  subject: string;
  section: string;
  durationMinutes: number;
  questionCount: number;
  isFree: boolean;
  priceTenge?: number;
  description: string;
}

export type AnswerValue = string | string[] | Record<string, string>;

export interface TestAttempt {
  testId: string;
  answers: Record<number, AnswerValue>;
  startedAt: string;
  finishedAt?: string;
  score?: number;
  maxScore?: number;
}
