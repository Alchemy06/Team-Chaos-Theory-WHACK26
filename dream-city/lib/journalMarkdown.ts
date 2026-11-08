type Message = {
  id: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  reply_to_id: string | null;
};

// (added) Build the final document from saved messages, keeping each answer with its question.
export function journalDocument(createdAt: string, messages: Message[]) {
  const ordered = [...messages].sort((a, b) => a.sequence - b.sequence);
  const dream = ordered.find((m) => m.role === "user" && !m.reply_to_id);
  if (!dream) throw new Error("The journal has no saved dream.");
  const date = new Date(createdAt).toISOString().slice(0, 10);
  const titleDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(createdAt));
  const followUps = ordered.filter((m) => m.role === "assistant").map((question) => ({
    q: question.content,
    a: ordered.find((m) => m.role === "user" && m.reply_to_id === question.id)?.content ?? "",
  }));
  const sections = [`# Dream Journal — ${titleDate}`, `## User\n\n${dream.content}`];
  for (const pair of followUps) {
    sections.push(`## Assistant\n\n${pair.q}`);
    if (pair.a) sections.push(`## User\n\n${pair.a}`);
  }
  return {
    markdown: `${sections.join("\n\n")}\n`,
    entry: { date, transcript: dream.content, followUps },
  };
}
