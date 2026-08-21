import type { Question, QuestionType } from "../types/test";

export function isAnswerKeyComplete(question: Question): boolean {
  switch (question.type) {
    case "single_choice":
      return Boolean(
        question.correctAnswer &&
          question.options.some((o) => o.id === question.correctAnswer),
      );
    case "multiple_choice":
      return Boolean(
        question.correctAnswers &&
          question.correctAnswers.length > 0 &&
          question.correctAnswers.every((id) =>
            question.options.some((o) => o.id === id),
          ),
      );
    case "matching":
      return Boolean(
        question.rows?.length &&
          question.correctAnswers &&
          question.rows.every(
            (row) =>
              question.correctAnswers?.[row.id] &&
              question.options.some(
                (o) => o.id === question.correctAnswers?.[row.id],
              ),
          ),
      );
    default:
      return false;
  }
}

export function keyedCount(questions: Question[]): number {
  return questions.filter(isAnswerKeyComplete).length;
}

export function nextQuestionId(questions: Question[]): number {
  return questions.reduce((max, q) => Math.max(max, q.id), 0) + 1;
}

export function createBlankQuestion(
  id: number,
  type: QuestionType = "single_choice",
): Question {
  const options = [
    { id: "A", label: "" },
    { id: "B", label: "" },
    { id: "C", label: "" },
    { id: "D", label: "" },
  ];
  if (type === "matching") {
    return {
      id,
      type,
      text: "",
      rows: [
        { id: "1", label: "" },
        { id: "2", label: "" },
      ],
      options,
      correctAnswers: {},
    };
  }
  if (type === "multiple_choice") {
    return { id, type, text: "", options, correctAnswers: [] };
  }
  return { id, type: "single_choice", text: "", options, correctAnswer: "" };
}

export function convertQuestionType(
  question: Question,
  type: QuestionType,
): Question {
  const base = {
    id: question.id,
    text: question.text,
    images: question.images,
    options: question.options.length
      ? question.options
      : [
          { id: "A", label: "" },
          { id: "B", label: "" },
          { id: "C", label: "" },
          { id: "D", label: "" },
        ],
  };

  if (type === "single_choice") {
    return {
      ...base,
      type,
      correctAnswer:
        question.type === "single_choice" ? question.correctAnswer ?? "" : "",
    };
  }

  if (type === "multiple_choice") {
    return {
      ...base,
      type,
      correctAnswers:
        question.type === "multiple_choice" ? question.correctAnswers ?? [] : [],
    };
  }

  return {
    ...base,
    type: "matching",
    rows:
      question.type === "matching" && question.rows.length
        ? question.rows
        : [
            { id: "1", label: "" },
            { id: "2", label: "" },
          ],
    correctAnswers:
      question.type === "matching" ? question.correctAnswers ?? {} : {},
  };
}
