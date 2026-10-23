const ABBREVIATIONS = new Set([
  "ltd",
  "pte",
  "inc",
  "co",
  "corp",
  "plc",
  "llc",
  "est",
  "mr",
  "mrs",
  "ms",
  "dr",
  "st",
  "vs",
  "jr",
  "sr",
  "etc",
  "fig",
  "vol",
  "approx",
  "no",
  "nos",
]);

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function wordBefore(text: string, index: number) {
  let cursor = index - 1;
  while (cursor >= 0 && /[A-Za-z]/.test(text[cursor] ?? "")) cursor -= 1;
  return text.slice(cursor + 1, index);
}

/** A period that ends a clause, not an initial, abbreviation, decimal, or ellipsis. */
function isSentenceDot(text: string, index: number) {
  const before = text[index - 1];
  if (!before || /\d/.test(before)) return false;
  const after = text[index + 1];
  if (after && !/\s/.test(after)) return false;
  if (before === ")") return true;
  const word = wordBefore(text, index);
  if (!word || word.length === 1) return false;
  return !ABBREVIATIONS.has(word.toLowerCase());
}

function cutIndexes(text: string) {
  const indexes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text.startsWith(" (", index) || text[index] === ";") indexes.push(index);
    else if (text[index] === "." && isSentenceDot(text, index)) indexes.push(index);
  }
  return indexes;
}

function isCleanPhrase(phrase: string) {
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  const open = phrase.match(/\(/g)?.length ?? 0;
  const close = phrase.match(/\)/g)?.length ?? 0;
  return open === close;
}

/**
 * First clause of a company description for a kanban card.
 * Splits at the earliest ';' , '.' or ' (' that leaves a clean phrase.
 * Empty input returns null so the card can omit the line.
 */
export function cardSummary(description: string | null | undefined): string | null {
  if (description == null) return null;
  const text = collapse(description);
  if (!text) return null;
  for (const index of cutIndexes(text)) {
    const phrase = text.slice(0, index).trim();
    if (isCleanPhrase(phrase)) return phrase;
  }
  return text;
}
