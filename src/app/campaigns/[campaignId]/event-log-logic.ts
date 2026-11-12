import type { AuditEntry } from "@/app/campaigns/[campaignId]/useCampaignStream";
import type { CharacterEvent } from "@/lib/db/character-events";
import type { ClockTurn } from "@/lib/db/clock-moves";
import type { TurnChangeView } from "@/lib/db/turn-changes";
import { quietTick } from "@/lib/sheet-audit-logic";
import { translate } from "@/lib/messages-logic";
import { COPPER_PER_GOLD, formatPrice } from "@/lib/srd/currency";

// What the event log lists and which turns it offers to revert. Pure, so a
// suite reads it without a browser (scripts/test-event-log-logic.mjs). The
// clock turns (src/lib/db/clock-moves.ts) come from the campaign snapshot
// and the clock_changed event; an older host sends none, and the log keeps
// its old rule. So do the other things a turn kept for its revert (issue
// 685, src/lib/db/turn-changes.ts), from the snapshot's turnChanges and the
// turn_changed event.

export type FeedItem =
  | { type: "audit"; seq: number; entry: AuditEntry }
  // A run of changes that only counted time down, from one turn.
  | { type: "ticks"; seq: number; turnId: string; entries: AuditEntry[] }
  | { type: "time"; seq: number; move: ClockTurn }
  // A prepared event that fired, a test die forced, a card resolved as
  // played: what else the turn's revert takes back.
  | { type: "change"; seq: number; change: TurnChangeView }
  | { type: "milestone"; seq: number; event: CharacterEvent };

// Rows the trail keeps for the engine's own reading, which change no sheet:
// the moment of a death (src/lib/dm/revival.ts), which a revival spell
// times its window from. The death itself is its death_state row.
export const BOOKKEEPING_KINDS: ReadonlySet<string> = new Set(["death_moment"]);

// Newest first: the sheet changes, the milestones and the time the turns
// moved on, with each run of one turn's quiet ticks (src/lib/
// sheet-audit-logic.ts) folded into one item: the turn's revert puts them
// back, but none is news.
export function buildFeed(
  auditLog: AuditEntry[],
  characterEvents: CharacterEvent[],
  clockTurns: ClockTurn[] = [],
  turnChanges: TurnChangeView[] = [],
): FeedItem[] {
  const items: FeedItem[] = [
    ...auditLog.filter((entry) => !BOOKKEEPING_KINDS.has(entry.kind)).map((entry) => ({ type: "audit" as const, seq: entry.seq, entry })),
    ...characterEvents.map((event) => ({ type: "milestone" as const, seq: event.seq, event })),
    ...clockTurns.map((move) => ({ type: "time" as const, seq: move.seq, move })),
    // A seed's run of dice says nothing of its own: it counts toward the
    // turn's revert without a row.
    ...turnChanges.filter((change) => change.line).map((change) => ({ type: "change" as const, seq: change.seq, change })),
  ].sort((a, b) => b.seq - a.seq);
  const feed: FeedItem[] = [];
  for (const item of items) {
    if (item.type !== "audit" || !quietTick(item.entry)) {
      feed.push(item);
      continue;
    }
    const turnId = item.entry.turnId ?? "";
    const last = feed.at(-1);
    if (last?.type === "ticks" && last.turnId === turnId) {
      last.entries.push(item.entry);
      continue;
    }
    feed.push({ type: "ticks", seq: item.seq, turnId, entries: [item.entry] });
  }
  return feed;
}

// The turn an item belongs to, if any.
export function turnOfItem(item: FeedItem): string | null {
  if (item.type === "audit") {
    return item.entry.turnId ?? null;
  }
  if (item.type === "ticks") {
    return item.turnId || null;
  }
  if (item.type === "change") {
    return item.change.turnId;
  }
  return item.type === "time" ? item.move.turnId : null;
}

// The turns the log offers "Revert this turn" for, with how many live sheet
// changes each would undo: two or more, as before; or any number (none
// included) when the turn moved the clock and the time is not back yet,
// since an undo of one change never moves the clock (issue #622); or when it
// kept something else for its revert (issue 685), which no undo of one sheet
// change takes back.
export function revertableTurns(auditLog: AuditEntry[], clockTurns: ClockTurn[] = [], turnChanges: TurnChangeView[] = []): Map<string, number> {
  const live = new Map<string, number>();
  for (const entry of auditLog) {
    if (entry.turnId && entry.undoable && !entry.revertedAt && entry.kind !== "undo") {
      live.set(entry.turnId, (live.get(entry.turnId) ?? 0) + 1);
    }
  }
  const timed = new Set([...clockTurns.map((move) => move.turnId), ...turnChanges.map((change) => change.turnId)]);
  const turns = new Map<string, number>();
  for (const [turnId, count] of live) {
    if (count >= 2 || timed.has(turnId)) {
      turns.set(turnId, count);
    }
  }
  for (const turnId of timed) {
    if (!turns.has(turnId)) {
      turns.set(turnId, 0);
    }
  }
  return turns;
}

// ---- what each change says ----
//
// One sentence per audit row, in plain words, from what the row stores.
// Every kind the server writes is named here (scripts/test-event-log-logic.mjs
// scans src for them and fails on one that is not): a lead deciding what to
// revert used to read raw ids such as "Corra Venn: death_state" (issue #622).
// Each reads what it can and says less, never "undefined", when a field is
// missing (an older row, another writer's shape).
//
// The sentences live in the dictionaries (table.log.*); like composerGate,
// the reading takes the translator from the component that draws it, so a
// language switch rewords the log with everything else.

type Delta = Record<string, unknown>;

// The translator a caller binds to its own locale (useT in a component).
type Say = (key: string, vars?: Record<string, string | number>) => string;

// English, for the callers that carry no translator (the test suite, an old
// reader): the same words the dictionaries hold.
const enT: Say = (key, vars) => translate("en", key, vars);

// A caller either hands (t, entry, name) t-first, or the older (entry, name)
// shape that reads English; both land on the same words.
function sayOf(t: Say | { kind: string; delta: Delta }, entry?: { kind: string; delta: Delta } | string, name?: string): [Say, { kind: string; delta: Delta }, string] {
  if (typeof t === "function") {
    return [t, entry as { kind: string; delta: Delta }, name ?? ""];
  }
  return [enT, t, (entry as string) ?? ""];
}

const word = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const amount = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const words = (value: unknown): string[] => (Array.isArray(value) ? value.map(word).filter((entry): entry is string => entry !== null) : []);
const times = (qty: number | null) => (qty !== null && qty > 1 ? ` x${qty}` : "");
const gold = (t: Say, copper: number) => t("table.log.goldAmount", { amount: Math.round(copper) / 100 });

function deathState(t: Say, name: string, delta: Delta): string {
  const revived = word(delta.revived);
  if (revived) {
    return t("table.log.revived", { name, by: revived });
  }
  const track = delta.deathSaves as { successes?: unknown; failures?: unknown; stable?: unknown; dead?: unknown } | null | undefined;
  if (!track || typeof track !== "object") {
    const hp = amount(delta.currentHp);
    if (hp !== null && hp > 0) {
      return t("table.log.backOnFeet", { name, hp });
    }
    return "deathSaves" in delta ? t("table.log.notDying", { name }) : t("table.log.deathSavesChange", { name });
  }
  if (track.dead === true) {
    return t("table.log.dies", { name });
  }
  if (track.stable === true) {
    return t("table.log.stable", { name });
  }
  const successes = amount(track.successes) ?? 0;
  const failures = amount(track.failures) ?? 0;
  if (!successes && !failures) {
    return t("table.log.dying", { name });
  }
  return t("table.log.deathSaves", {
    name,
    successes: t("table.log.saveSuccess", { count: successes }),
    failures: t("table.log.saveFailure", { count: failures }),
  });
}

// The sentence for a kind the server writes, or null for one it does not
// know (a row from an older or newer version). Public in both shapes: t-first
// (the components' own locale) or plain (entry, name), which reads English.
export function describeKnownEntry(
  t: Say | { kind: string; delta: Delta },
  entry?: { kind: string; delta: Delta } | string,
  name?: string,
): string | null {
  const [say, row, who] = sayOf(t, entry, name);
  return knownEntryText(say, row, who);
}

function knownEntryText(t: Say, entry: { kind: string; delta: Delta }, name: string): string | null {
  const delta = entry.delta ?? {};
  const item = word(delta.name) ?? word(delta.item) ?? t("table.log.anItem");
  const qty = amount(delta.qty);
  switch (entry.kind) {
    case "apply_damage": {
      // Wild Shape: the blow landed on the beast form, not the druid.
      const form = word(delta.form);
      if (form) {
        const carryover = amount(delta.carryover) ?? 0;
        if (delta.reverted) {
          return carryover > 0 ? t("table.log.wildBreakCarry", { name, form, carryover }) : t("table.log.wildBreak", { name, form });
        }
        const beastHp = amount(delta.beastHp);
        return beastHp !== null
          ? t("table.log.wildHit", { name, form, amount: amount(delta.amount) ?? t("table.log.someHealed"), hp: beastHp })
          : t("table.log.wildHitPlain", { name, form, amount: amount(delta.amount) ?? t("table.log.someHealed") });
      }
      if (delta.relentlessEndurance) return t("table.log.relentlessEndurance", { name });
      if (delta.undyingSentinel) return t("table.log.undyingSentinel", { name });
      if (delta.strengthOfTheGrave) return t("table.log.strengthOfTheGrave", { name });
      if (delta.blazingRevival) return t("table.log.blazingRevival", { name });
      if (delta.relentlessRage) return t("table.log.relentlessRage", { name });
      if (delta.deathWard) return t("table.log.deathWard", { name });
      const type = word(delta.type);
      const hp = amount(delta.currentHp);
      const dmg = amount(delta.amount);
      const line = dmg !== null ? t("table.log.damage", { name, amount: dmg }) : t("table.log.damageSome", { name });
      return `${line}${type ? t("table.log.damageType", { type }) : ""}${hp !== null ? t("table.log.damageHp", { hp }) : ""}`;
    }
    case "heal": {
      const form = word(delta.form);
      const healed = amount(delta.amount);
      if (form) {
        const beastHp = amount(delta.beastHp);
        const taken = healed ?? t("table.log.someHealed");
        return beastHp !== null ? t("table.log.wildHeal", { name, form, amount: taken, hp: beastHp }) : t("table.log.wildHealPlain", { name, form, amount: taken });
      }
      const hp = amount(delta.newHp);
      return healed !== null ? `${t("table.log.heals", { name, amount: healed })}${hp !== null ? t("table.log.damageHp", { hp }) : ""}` : t("table.log.isHealed", { name });
    }
    case "grant_temp_hp": {
      const temp = amount(delta.tempHp);
      return temp !== null ? t("table.log.tempHp", { name, temp }) : t("table.log.tempHpPlain", { name });
    }
    // An effect's move of the hit point maximum (Aid, a drain), with the hit
    // points it carried along (src/lib/db/active-effects.ts).
    case "set_effect": {
      const max = amount(delta.maxHp);
      const hp = amount(delta.currentHp);
      return max !== null ? `${name}'s hit point maximum is now ${max}${hp !== null ? ` (${hp} HP)` : ""}` : `${name}'s hit point maximum changes`;
    }
    case "award_xp": {
      const xp = amount(delta.amount);
      const total = amount(delta.newXp);
      return xp !== null ? `${t("table.log.xpGain", { name, xp })}${total !== null ? t("table.log.xpTotal", { total }) : ""}` : t("table.log.xpPlain", { name });
    }
    case "modify_gold": {
      const change = amount(delta.delta);
      const copper = amount(delta.copper);
      const purse = amount(delta.purseCopper);
      const held = purse !== null ? formatPrice(purse) : amount(delta.gold) !== null ? `${amount(delta.gold)} gp` : null;
      const after = held ? t("table.log.goldNoteAny", { purse: held }) : "";
      // Five silver spent was "gains 0 gold": the whole-gold figure rounds a
      // part of a gold piece away, and the copper it came from is recorded.
      if (copper !== null && copper % COPPER_PER_GOLD !== 0) {
        return copper >= 0
          ? t("table.log.copperGain", { name, amount: formatPrice(Math.abs(copper)), after })
          : t("table.log.copperLose", { name, amount: formatPrice(Math.abs(copper)), after });
      }
      if (change === null) return t("table.log.purseChanges", { name });
      return `${change >= 0 ? t("table.log.goldGain", { name, amount: Math.abs(change) }) : t("table.log.goldLose", { name, amount: Math.abs(change) })}${after}`;
    }
    case "grant_item":
      return t("table.log.receives", { name, item, times: times(qty) });
    case "remove_item":
      return t("table.log.loses", { name, item, times: times(amount(delta.removed)) });
    case "reveal_item": {
      const from = word(delta.from);
      const to = word(delta.to);
      return from && to ? t("table.log.reveal", { name, from, to }) : t("table.log.revealPlain", { name });
    }
    // A pact's gift or its price (src/lib/dm/pact-fire.ts).
    case "item": {
      const added = word(delta.added);
      const removed = word(delta.removed);
      return added ? t("table.log.receives", { name, item: added, times: "" }) : removed ? t("table.log.givesUp", { name, item: removed }) : t("table.log.packChanges", { name });
    }
    case "trade": {
      const partner = word(delta.with);
      return partner ? t("table.log.tradesWith", { name, partner }) : t("table.log.trades", { name });
    }
    case "purchase": {
      const selling = delta.action === "sell";
      const count = qty ?? 1;
      const eachCp = amount(delta.priceCp);
      const eachGold = amount(delta.price);
      const price = eachCp !== null ? t("table.log.priceFor", { price: gold(t, eachCp * count) }) : eachGold !== null ? t("table.log.priceFor", { price: t("table.log.goldAmount", { amount: eachGold * count }) }) : "";
      return selling ? t("table.log.sells", { name, item, times: times(qty), price }) : t("table.log.buys", { name, item, times: times(qty), price });
    }
    case "gear": {
      if (typeof delta.equipped !== "boolean") return t("table.log.gearChanges", { name });
      return delta.equipped ? t("table.log.putsOn", { name, item }) : t("table.log.takesOff", { name, item });
    }
    case "hand_item": {
      const to = word(delta.to);
      const from = word(delta.from);
      return to
        ? t("table.log.handsTo", { name, item, times: times(qty), to })
        : from
          ? t("table.log.receivesFrom", { name, item, times: times(qty), from })
          : t("table.log.handsOver", { name, item });
    }
    case "drop_item":
      return t("table.log.drops", { name, item, times: times(amount(delta.dropped)) });
    // A net thrown, now on the ground (src/lib/dm/gear-ground.ts throwToGround).
    case "throw_item":
      return t("table.log.throws", { name, item });
    case "pick_up_item":
      return t("table.log.picksUp", { name, item, times: times(amount(delta.taken)) });
    case "use_item": {
      const used = word(delta.item);
      return used ? t("table.log.uses", { name, item: used }) : t("table.log.spendsCharges", { name });
    }
    case "dawn_recharge":
      return t("table.log.dawnRecharge", { name });
    case "set_condition": {
      if (delta.inspiration) return t("table.log.gainsInspiration", { name });
      // A swallowed creature's running count toward its swallower's
      // regurgitation save (src/lib/dm/swallow.ts noteBlowFromInside).
      const inside = amount(delta.hurtInside);
      if (inside !== null)
        return t("table.log.hurtInside", { name, who: word(delta.swallower) ?? t("table.log.swallowerUnknown"), amount: inside });
      const condition = word(delta.condition);
      return condition ? t("table.log.isCondition", { name, condition }) : t("table.log.gainsCondition", { name });
    }
    case "clear_condition": {
      const level = amount(delta.level);
      if (word(delta.condition) === "exhaustion" && level !== null) {
        return t("table.log.exhaustionFalls", { name, level });
      }
      const ended = word(delta.condition) ?? (words(delta.ended).join(" or ") || null);
      return ended ? t("table.log.noLonger", { name, ended }) : t("table.log.ridOfCondition", { name });
    }
    case "exhaustion": {
      const level = amount(delta.exhaustion);
      return level !== null ? t("table.log.exhaustionLevel", { name, level }) : t("table.log.exhaustionChanges", { name });
    }
    // What passing time did on its own (issue #622): written down so a turn's
    // revert can put it back with the hours.
    case "wild_shape":
      return t("table.log.backToForm", { name });
    case "condition_clock": {
      const ended = words(delta.ended);
      return ended.length ? t("table.log.noLonger", { name, ended: ended.join(" or ") }) : t("table.log.conditionsTick", { name });
    }
    case "concentration_clock":
      return t("table.log.spellTick", { name, spell: word(delta.spell) ?? t("table.log.aSpell") });
    case "concentration": {
      const spell = word(delta.concentratingOn);
      return spell ? t("table.log.concentrates", { name, spell }) : t("table.log.stopsConcentrating", { name });
    }
    case "supplies": {
      const level = amount(delta.exhaustion);
      return level !== null ? t("table.log.shortSupply", { name, level }) : t("table.log.eatsAndDrinks", { name });
    }
    case "training": {
      const subject = word(delta.subject);
      return subject ? t("table.log.learns", { name, subject }) : t("table.log.trainingDone", { name });
    }
    case "use_spell_slot": {
      const level = amount(delta.level);
      return level !== null ? t("table.log.spendsSlotLevel", { name, level }) : t("table.log.spendsSlot", { name });
    }
    // What a reaction itself did to the sheet (reaction-refund.ts reactionPatch).
    case "reaction": {
      const what = word(delta.reaction);
      return what ? `${name}: ${what}` : `${name} takes a reaction`;
    }
    case "use_resource": {
      const resource = word(delta.resource) ?? t("table.log.aFeature");
      const from = word(delta.from);
      if (from) return t("table.log.receivesFrom", { name, item: resource, times: "", from });
      const spent = amount(delta.spent) ?? 1;
      return spent > 1 ? t("table.log.spendsUses", { name, count: spent, resource }) : t("table.log.spendsResource", { name, resource });
    }
    case "learn_spell": {
      const spell = word(delta.spell) ?? t("table.log.anUnknownSpell");
      return delta.action === "remove" ? t("table.log.losesSpell", { name, spell }) : t("table.log.learnsSpell", { name, spell });
    }
    case "divine_intervention":
      return t("table.log.divineIntervention", { name });
    // The dying engine (src/lib/dm/death.ts), a revival spell (heal-spell.ts).
    case "death_state":
      return deathState(t, name, delta);
    case "death_moment":
      return t("table.log.deathMoment", { name });
    case "stabilize": {
      const healer = word(delta.healer);
      const woke = amount(delta.currentHp) === 1;
      return `${healer ? t("table.log.stabilizedBy", { healer, name }) : t("table.log.stabilized", { name })}${woke ? t("table.log.regainsOne") : ""}`;
    }
    case "rest_long":
      return t("table.log.restLong", { name });
    case "rest_short":
      return delta.hitDice ? t("table.log.restShortDice", { name }) : t("table.log.restShort", { name });
    case "attune":
      return t("table.log.attunes", { name });
    case "update_sheet": {
      const changed = Object.keys(delta);
      return t("table.log.sheetRewrite", { name, fields: changed.length ? t("table.log.fieldList", { fields: changed.join(", ") }) : "" });
    }
    case "undo":
      return t("table.log.undid", { name });
    case "lead_edit": {
      const changed = Object.keys(delta).filter((key) => key !== "reason");
      return t("table.log.leadEdit", { name, fields: changed.length ? t("table.log.fieldList", { fields: changed.join(", ") }) : "" });
    }
    case "player_adjust": {
      const changed = Object.keys(delta);
      return t("table.log.playerAdjust", { name, fields: changed.length ? t("table.log.fieldList", { fields: changed.join(", ") }) : "" });
    }
    default:
      return null;
  }
}

// The row as the event log reads it: a kind no version of this server knows
// still reads as words. Same two shapes as describeKnownEntry.
export function describeAuditEntry(
  t: Say | { kind: string; delta: Delta },
  entry?: { kind: string; delta: Delta } | string,
  name?: string,
): string {
  const [say, row, who] = sayOf(t, entry, name);
  return knownEntryText(say, row, who) ?? `${who}: ${row.kind.replace(/_/g, " ")}`;
}
