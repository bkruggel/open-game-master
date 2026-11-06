// How a creature lying at 0 hit points waiting to regenerate reads on the
// table's screens (src/lib/dm/regeneration.ts has the rule: SRD 5.1 troll,
// "dies only if it starts its turn with 0 hit points and doesn't
// regenerate"). One wording for the encounter panel, the Hand's target chips
// and the board's condition chip. Pure.

// The shape of a translator, as the pure sentence builders take it: the
// surface that shows the words passes its own.
type T = (key: string, vars?: Record<string, string | number>) => string;

export function regeneratingNote(t: T, stopped: boolean): string {
  return stopped
    ? t("board.regen.stopped")
    : t("board.regen.waiting");
}
