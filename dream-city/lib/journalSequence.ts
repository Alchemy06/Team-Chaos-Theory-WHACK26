// Leave a slot after every question, even when its answer is skipped.
export function questionSequence(index: number): number {
  if (!Number.isInteger(index) || index < 0) throw new Error("Invalid question index");
  return index * 2 + 1;
}

export function answerSequence(question: number): number {
  if (!Number.isInteger(question) || question < 1 || question % 2 !== 1) {
    throw new Error("Invalid question sequence. Apply migration 002_journal_message_order.sql.");
  }
  return question + 1;
}
