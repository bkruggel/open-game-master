import type { HandTargetChip } from "@/app/campaigns/[campaignId]/HandAimBar";
import type { TargetEdge } from "@/lib/battlemap/view-tactics";
import { effectiveMaxHp } from "@/lib/dm/condition-logic";
import type { PublicEncounter } from "@/lib/db/encounter-view";
import type { CharacterSheet } from "@/lib/schemas/sheet";

// Split from Hand.tsx, which offers these chips on the aim bar.
// The chips a raised card can be aimed at: the living enemies, with what the
// board says of each from this character (cover, flanking), and the party.
// Like composerGate, the reading takes the translator from the component that
// draws the chips (the notes are table.hand.target.*), so a language switch
// rewords them with everything else. Pure otherwise.
export function handTargets(
  t: (key: string, vars?: Record<string, string | number>) => string,
  enemies: PublicEncounter["enemies"],
  sheets: CharacterSheet[],
  selfId: string | undefined,
  edges: Record<string, TargetEdge> | undefined,
): HandTargetChip[] {
  const enemyChips: HandTargetChip[] = enemies
    .filter((enemy) => enemy.status === "alive")
    .map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      kind: "enemy",
      ac: enemy.ac,
      cr: enemy.cr,
      conditions: enemy.conditions,
      ...(edges?.[enemy.id] ? { edge: edges[enemy.id] } : {}),
      note: [
        enemy.knockedOut
          ? t("table.hand.target.knockedOut")
          : enemy.regenerating
            ? enemy.regenerating.stopped
              ? t("table.hand.target.downDies")
              : t("table.hand.target.downRegens")
            : enemy.health,
        edges?.[enemy.id]?.cover
          ? t(edges[enemy.id].cover === 2 ? "table.hand.target.coverHalf" : "table.hand.target.coverThreeQuarters")
          : null,
        edges?.[enemy.id]?.flanking ? t("table.hand.target.flanked") : null,
        ...enemy.conditions.slice(0, 2),
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  const party: HandTargetChip[] = sheets
    .filter((entry) => !entry.deathSaves?.dead)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: entry.id === selfId ? "self" : "ally",
      conditions: entry.conditions,
      note: t("table.hand.target.hpNote", { hp: entry.currentHp, max: effectiveMaxHp(entry) }),
    }));
  return [...enemyChips, ...party];
}
