// The stock GM personalities' words in the interface's language.
//
// The stock presets are seeded into the database once with their English
// names (personalities.ts), so the name on the row is the only stable handle
// back to a preset. A render site asks for the message key that name maps to
// and reads it through its own translator, falling back to the row's own
// words for a personality a user wrote. Pure, so both the creator's wizard
// and the table's settings can import it.

const SLUGS: Record<string, string> = {
  "The Storyteller": "storyteller",
  "The Referee": "referee",
  "The Grim Chronicler": "grimChronicler",
  "The Trickster": "trickster",
  "The Courtier": "courtier",
};

// The message key for a stock preset's name or blurb, by the name the
// database keeps; null when the name is not one of the seeds.
export function personalityKey(kind: "name" | "blurb", name: string): string | null {
  const slug = SLUGS[name];
  return slug ? `creator.personality.${slug}.${kind}` : null;
}
