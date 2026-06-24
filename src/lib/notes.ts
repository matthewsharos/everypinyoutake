/**
 * Strip the trailing PinPics "set roster" from a pin note — the
 * "<Name> #<id>, <Name> #<id>, …" / "Set: …" / "Series N: …" tail that was
 * scraped onto the end of the real description — while keeping the description.
 *
 * Dependency-free + non-destructive: safe to use at display time (raw data
 * stays intact) and to reuse later for a permanent one-off DB pass.
 */
export function cleanNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  let s = notes.replace(/\s+/g, ' ').trim();

  // The roster always carries PinPics ids (#1234+). Cut from there back to the
  // last sentence end, so we drop the roster name that precedes the first id too.
  const idMatch = s.match(/#\s*\d{3,}/);
  if (idMatch && idMatch.index !== undefined) {
    let head = s.slice(0, idMatch.index);
    const sentence = head.match(/^(.*[.!?”"])\s+\S/);
    if (sentence && sentence[1].length > 20) head = sentence[1];
    s = head;
  }

  // tidy any dangling label / connector / punctuation left behind
  s = s.replace(/\s*(Set|Series\s*\d*)\s*:\s*$/i, '');
  s = s.replace(/[\s,|–-]+$/g, '').trim();
  return s || null;
}
