// The Hand: a player's combat options as cards, derived from the character
// sheet and the turn so far (docs/visual-overhaul-plan.md 5.2).
//
// Every number on a card comes from the same pure helpers the engine uses
// (weaponAttackProfile, combatRiders, spellSaveDcFor, the resource table), so
// a card never promises something pc_attack or the cast tools would refuse.
// Pure and database-free: scripts/test-hand.mjs drives every branch. What a
// card says once it is played lives next door in hand-play.ts.
import { racialNaturalWeapon } from "@/lib/srd/racial-weapons";
import { translate, type Locale } from "@/lib/messages-logic";

type T = (key: string, vars?: Record<string, string | number>) => string;
const enT: T = (key, vars) => translate("en", key, vars);
import { optionCards } from "@/lib/battlemap/hand-options";
import { maneuverDieFor, maneuverUse, type ManeuverUse } from "@/lib/dm/maneuver-rules";
import { weaponAttackProfile, weaponOf } from "@/lib/dm/attack-logic";
import { dualWields, handsRuling, offHandProblem } from "@/lib/dm/attack-rules";
import { shillelaghSwing } from "@/lib/dm/attack-features";
import { magicWeaponOfRow, type WeaponGear } from "@/lib/dm/gear-attack";
import { bonusRouteFor, kiLeft, usesLeft, type BonusRoute, type MoveAction } from "@/lib/dm/bonus-routes";
import { effectiveSpeed, exhaustionSpeed } from "@/lib/dm/condition-logic";
import { martialArtsApplies } from "@/lib/dm/pc-attack-options";
import { attackOptionsFor, bonusStrikeCards, fastHandsCards, kiCards } from "@/lib/battlemap/hand-class";
import { beastAttackIcon } from "@/lib/battlemap/attack-art";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { acBreakdownFor, computeSheetDerived } from "@/lib/srd";
import { ammoKindForWeapon, findAmmo, type AmmoKind } from "@/lib/srd/ammunition";
import { attackDamageLine, attackReach, attackRollLine } from "@/lib/battlemap/hand-attack-lines";
import { grappleHandsProblem } from "@/lib/dm/cast-rules";
import type { AttackProfile } from "@/lib/dm/attack-logic";
import { longRangeTilesOf } from "@/lib/dm/attack-rules";
import { combatRiders, type CombatRiders } from "@/lib/srd/feature-effects";
import { matchWeapon, type SrdWeapon } from "@/lib/srd/weapons";

import {
  FRESH_TURN,
  attackGate,
  costGate,
  gated,
  handsRulingReason,
  lowestSlot,
  offHandProblemReason,
  signed,
  slotLine,
  standingGate,
  budgetOf,
  type BasicActionId,
  type Gate,
  type HandCard,
  type HandCost,
  type HandOptions,
  type HandTarget,
  type HandTurn,
} from "@/lib/battlemap/hand-core";
import { featureCards, spellCards, spellNames } from "@/lib/battlemap/hand-spells";
import { itemSpellCards, itemSpellNames } from "@/lib/battlemap/hand-items";
import { ringSpellCards, ringSpellNames } from "@/lib/battlemap/hand-ring";
import { intimidatingPresenceCards, subclassSpendCards } from "@/lib/battlemap/hand-subclass";
import { spellHoldOf } from "@/lib/battlemap/hand-escape";
import { gearCards, undrawnGate } from "@/lib/battlemap/hand-gear";
import { grantedAttackCards } from "@/lib/battlemap/hand-granted";
import { textKey } from "@/lib/language/text-logic";
import { magicItemRiders } from "@/lib/srd/magic-items";

export * from "@/lib/battlemap/hand-core";

// ---- attacks ----

type Carried = { name: string; srd: SrdWeapon; qty: number; gear: WeaponGear | null };

// The ammunition words, keyed so the card's resource line reads in the
// table's language (AMMO_LABELS in src/lib/srd/ammunition.ts keeps the
// engine's own English labels for its own sentences).
const AMMO_KEY: Record<AmmoKind, string> = {
  arrows: "table.hand.ammo.arrows",
  bolts: "table.hand.ammo.bolts",
  bullets: "table.hand.ammo.bullets",
  needles: "table.hand.ammo.needles",
};


// Every carried row the engine would swing, resolved as resolveAttackWeapon
// resolves a named weapon: a homebrew block first, then a magic weapon's base
// item and riders (a Berserker Axe is a battleaxe with its +1 and its
// attunement judged), then the SRD table by name.
export function carriedWeapons(sheet: Pick<CharacterSheet, "equipment">): Carried[] {
  const seen = new Set<string>();
  const out: Carried[] = [];
  for (const item of sheet.equipment) {
    const own = weaponOf(item);
    const magic = magicWeaponOfRow(item);
    const srd = (magic.gear ? magic.srd : null) ?? own ?? matchWeapon(item);
    const key = textKey(item.name);
    if (!srd || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: item.name.trim(), srd, qty: item.qty, gear: magic.gear ?? null });
  }
  return out;
}

// The card's range line in the reader's words, from the same reading
// attackReach makes (hand-attack-lines.ts): melee feet, a bow's span out to
// its long range, a thrown weapon's reach then its span. The shot data the
// preview reads rides on the card from attackReach itself.
function weaponRange(profile: AttackProfile, t: T = enT): string {
  const reachFt = profile.reachTiles * 5;
  if (!profile.ranged && !profile.thrown) return t("table.hand.range.feet", { feet: reachFt });
  const normalFt = profile.rangeTiles * 5;
  const longFt = longRangeTilesOf(profile) * 5;
  const span = longFt > normalFt ? t("table.hand.range.beastRanged", { range: normalFt, long: longFt }) : t("table.hand.range.feet", { feet: normalFt });
  return profile.ranged ? span : t("table.hand.range.weaponThrownFt", { reach: reachFt, span });
}

function attackCards(sheet: CharacterSheet, turn: HandTurn, riders: CombatRiders, options: HandOptions, t: T = enT): HandCard[] {
  const derived = computeSheetDerived(sheet);
  const profs = sheet.proficiencies.weapons;
  const allowed = 1 + riders.extraAttacks;
  const standing = standingGate(sheet, turn, "attack");
  // Martial Arts only with no armor and no shield (the engine's own gate).
  const martialArts = martialArtsApplies(sheet);
  // A shield on the arm keeps a versatile weapon in one hand, whatever is
  // asked, and a two-handed weapon out of use (handsRuling in
  // src/lib/dm/attack-rules.ts). The off-hand swing of two-weapon fighting
  // has a weapon in each hand, so it is one-handed as well.
  const shieldName = acBreakdownFor(sheet).shieldName;
  const cards: HandCard[] = [];
  const base = {
    type: "attack" as const,
    cost: "action" as const,
    roll: "",
    resource: "",
    condition: "",
    target: "enemy" as const,
    heals: false,
    save: null,
    disabled: null,
    spent: false,
    compose: false,
  };

  // A beast form swings with its statblock, not with the sheet's gear; a
  // form whose block has no attack (a frog) leaves no attack card at all.
  if (sheet.wildShape?.attacks) {
    for (const attack of sheet.wildShape.attacks) {
      const ranged = Boolean(attack.range) && !attack.thrown;
      cards.push(
        gated(
          {
            ...base,
            id: `attack:${textKey(attack.name)}`,
            name: attack.name,
            range: attack.range
              ? ranged
                ? t("table.hand.range.beastRanged", { range: attack.range, long: attack.longRange ?? attack.range })
                : t("table.hand.range.beastThrown", { reach: attack.reach ?? 5, range: attack.range, long: attack.longRange ?? attack.range })
              : t("table.hand.range.feet", { feet: attack.reach ?? 5 }),
            dice: `${attack.damage} ${attack.type}${(attack.riders ?? []).map((rider) => ` + ${rider.dice} ${rider.type}`).join("")}`.trim(),
            roll: t("table.hand.attack.toHit", { bonus: signed(attack.toHit) }),
            rules: t("table.hand.attack.form", { form: sheet.wildShape.form }),
            icon: beastAttackIcon(sheet.wildShape.form, attack.name),
            toHit: attack.toHit,
            damage: attack.damage,
            damageType: attack.type,
            melee: !ranged,
            intent: { card: "attack", weapon: attack.name },
          },
          standing,
          // The form's Multiattack, as the server counts it (turn-budget.ts).
          attackGate(turn, Math.max(allowed, sheet.wildShape.attacksPerTurn ?? 1), sheet, {}, t),
        ),
      );
    }
    return cards;
  }

  const carried = carriedWeapons(sheet);
  const dualWielder = dualWields(sheet.feats, sheet.campaignId);
  const build = (name: string, srd: SrdWeapon | null, offHand: boolean, gear: WeaponGear | null = null, natural = false): HandCard => {
    const resolved = { displayName: name, srd, unarmed: srd === null, ...(gear ? { gear } : {}) };
    // Shillelagh, as pc_attack swings it: a club or quarterstaff deals a d8
    // with the spellcasting ability when that is better, and is no longer
    // versatile (shillelaghSwing in src/lib/dm/attack-features.ts).
    const shillelagh = shillelaghSwing(sheet, resolved, derived);
    const held = shillelagh?.resolved.srd ?? srd;
    const profile = weaponAttackProfile(
      shillelagh?.derived ?? derived,
      // A natural weapon is always proficient, as the engine swings it.
      natural ? [...profs, "simple", name.toLowerCase()] : profs,
      shillelagh?.resolved ?? resolved,
      // Bracers of Archery's longbow training and +2 damage, as pc_attack swings.
      { riders, offHand, martialArts, worn: magicItemRiders(sheet.equipment, sheet).weaponRiders },
    );
    // The damage and the roll as pc_attack makes them (hand-attack-lines.ts).
    const line = attackDamageLine({ sheet, turn, profile, riders, kind: "weapon" });
    const rolled = attackRollLine(sheet, profile.toHit);
    const damage = line.damage;
    const notes: string[] = [];
    if (!offHand && allowed > 1) notes.push(t("table.hand.attack.extraAttack", { count: allowed }));
    if (riders.sneakAttackDice > 0 && profile.sneakEligible) {
      notes.push(t("table.hand.attack.sneakAttack", { dice: riders.sneakAttackDice }));
    }
    notes.push(...line.notes, ...rolled.notes);
    if (shillelagh) notes.push(`${shillelagh.note}.`);
    notes.push(...profile.riderNotes.map((note) => `${note}.`));
    if (!profile.proficient) notes.push(t("table.hand.attack.notProficient"));
    // The bigger die is for a melee attack (SRD 5.1), so a weapon that can
    // also be thrown says where it counts.
    if (held?.properties?.includes("versatile") && !profile.twoHanded && !shieldName && !offHand) {
      notes.push(profile.thrown ? t("table.hand.attack.versatileThrown") : t("table.hand.attack.versatile"));
    }
    const ammoKind = srd?.properties?.includes("ammunition") ? ammoKindForWeapon(srd.name) : null;
    const ammo = ammoKind ? findAmmo(sheet.equipment, ammoKind) : null;
    const empty = ammoKind !== null && ammo === null;
    const ammoLabel = ammoKind ? t(AMMO_KEY[ammoKind]) : "";
    const card: HandCard = {
      ...base,
      id: `${offHand ? "offhand" : "attack"}:${textKey(name)}`,
      name: offHand ? t("table.hand.attack.offHand", { name }) : name,
      cost: offHand ? "bonus" : "action",
      ...attackReach(profile),
      range: weaponRange(profile, t),
      dice: dmgWithType(damage, profile.damageType, t),
      roll: t("table.hand.attack.toHit", { bonus: `${(rolled.toHit ?? 0) >= 0 ? "+" : ""}${rolled.toHit ?? 0}${rolled.toHitDice ?? ""}` }),
      rules: notes.slice(0, 2).join(" "),
      description: notes.join(" "),
      resource: ammoKind ? (ammo ? t("table.hand.attack.ammoCount", { ammo: ammoLabel, count: ammo.count }) : t("table.hand.attack.noAmmo", { ammo: ammoLabel })) : "",
      icon: natural
        ? beastAttackIcon("", name)
        : srd ? { kind: "item", key: srd.name, family: "item-weapon" } : { kind: "action", key: "unarmed-strike" },
      toHit: rolled.toHit,
      ...(rolled.toHitDice ? { toHitDice: rolled.toHitDice } : {}),
      ...(rolled.rollAdvantage ? { rollAdvantage: rolled.rollAdvantage } : {}),
      damage,
      damageType: profile.damageType,
      melee: !profile.ranged,
      intent: { card: "attack", weapon: name, ...(offHand ? { offHand: true } : {}) },
      ...(offHand ? {} : { options: attackOptionsFor(sheet, turn, profile, derived, { allowed }, t) }),
    };
    const ammoGate: Gate =
      empty && options.trackAmmo ? { reason: t("table.hand.attack.outOfAmmo", { ammo: ammoLabel }), spent: true } : null;
    // A two-handed weapon is not swung at all with a shield on the arm, in
    // handsRuling's own words. A lance is left to the engine: the Hand does
    // not know whether its rider is mounted.
    const hands = held
      ? handsRuling({ who: sheet.name, weapon: name, properties: held.properties ?? [], lance: false, mounted: false, twoHandedAsked: false, shieldName })
      : null;
    const handsGate: Gate = hands && "error" in hands ? { reason: handsRulingReason(hands.error, name, sheet.name, shieldName, t), spent: false } : null;
    if (offHand) {
      // The engine's own rule (attack-rules.ts offHandProblem): the swing is
      // earned by the Attack action's weapon, not by any attack, so a rapier
      // swing leaves the card shut and a dagger swing opens it (issue 210).
      // A server too old to say what the action was made with leaves the
      // card to the first swing, as it always was.
      const legacy = turn.lightMeleeAttack === undefined && turn.attacksMade > 0;
      const rule = offHandProblem({
        who: sheet.name,
        profile,
        budget: turn.myTurn
          ? { ...budgetOf(turn, sheet, allowed), ...(legacy ? { lightMeleeAttack: true, oneHandMeleeAttack: true } : {}) }
          : null,
        inFight: true,
        equipment: sheet.equipment,
        feats: sheet.feats,
        campaignId: sheet.campaignId,
        shieldName,
      });
      const opened: Gate = rule
        ? { reason: offHandProblemReason(rule.error, name, sheet.name, shieldName, dualWielder, t), spent: false }
        : null;
      return gated(card, standing, costGate("bonus", turn, sheet, `an off-hand attack with ${name}`, t), opened, undrawnGate(sheet, turn, name, t));
    }
    return gated(card, standing, handsGate, attackGate(turn, allowed, sheet, { unarmed: srd === null }, t), ammoGate, undrawnGate(sheet, turn, name, t));
  };

  for (const weapon of carried) cards.push(build(weapon.name, weapon.srd, false, weapon.gear));
  // A lineage's bite or claws (src/lib/srd/racial-weapons.ts), proficient.
  for (const term of ["bite", "claws"]) {
    const natural = racialNaturalWeapon(sheet.features, term);
    if (natural && !carried.some((weapon) => textKey(weapon.name) === textKey(natural.srd.name))) {
      cards.push(build(natural.srd.name, natural.srd, false, null, true));
    }
  }
  cards.push(build("Unarmed strike", null, false));
  // The bonus-action strikes a feature grants (Martial Arts, Frenzy).
  cards.push(...bonusStrikeCards(sheet, turn, riders, carried.map((weapon) => ({ name: weapon.name, srd: weapon.srd }))));
  // The attacks a held condition grants (Spiritual Weapon's weapon).
  cards.push(...grantedAttackCards(sheet, turn, allowed));

  // Two-weapon fighting: two light melee weapons in hand buy a bonus swing,
  // and with Dual Wielder any two melee weapons held in one hand do.
  const paired = carried.filter(
    (weapon) =>
      weapon.srd.kind === "melee" &&
      (dualWielder ? !weapon.srd.properties?.includes("two-handed") : weapon.srd.properties?.includes("light")),
  );
  const pairedCount = paired.reduce((sum, weapon) => sum + weapon.qty, 0);
  if (pairedCount >= 2) {
    const second = paired.length > 1 ? paired[1] : paired[0];
    cards.push(build(second.name, second.srd, true, second.gear));
  }
  return cards;
}

// ---- riders ----

// What a maneuver riding the swing asks beyond its die, on its card
// (src/lib/dm/maneuver-rules.ts). The maneuvers that are not part of a swing
// are dealt elsewhere: Parry and Riposte as reactions (hand-react.ts), Rally
// and Commander's Strike as bonus actions (hand-options.ts).
const SWING_RULES: Partial<Record<ManeuverUse, string>> = {
  swing: "table.hand.rider.rules.swing",
  feint: "table.hand.rider.rules.feint",
  bonus_swing: "table.hand.rider.rules.bonusSwing",
  grapple: "table.hand.rider.rules.grapple",
  ally_move: "table.hand.rider.rules.allyMove",
};

function riderCards(sheet: CharacterSheet, turn: HandTurn, riders: CombatRiders, t: T = enT): HandCard[] {
  const standing = standingGate(sheet, turn, "attack", t);
  const cards: HandCard[] = [];
  const base = {
    type: "rider" as const,
    cost: "rider" as const,
    range: t("table.hand.range.self"),
    roll: t("table.hand.rider.onHit"),
    condition: "",
    target: "none" as const,
    toHit: null,
    heals: false,
    save: null,
    melee: true,
    disabled: null,
    spent: false,
    compose: false,
  };
  if (riders.canSmite && sheet.spellcasting) {
    const slot = lowestSlot(sheet, 1);
    // The engine's smite: 2d8 at a 1st level slot, one more per level, six at most.
    const dice = `${Math.min(6, 1 + (slot?.level ?? 1))}d8`;
    cards.push(
      gated(
        {
          ...base,
          id: "rider:divine smite",
          name: "Divine Smite",
          dice: `+${dice} radiant`,
          rules: t("table.hand.rider.smiteRules"),
          resource: slot ? slotLine(slot, t) : t("table.hand.react.noSlots"),
          icon: { kind: "feature", key: "Divine Smite", family: "class-paladin" },
          damage: dice,
          damageType: "radiant",
          intent: { card: "rider", rider: "Divine Smite", ...(slot ? { slotLevel: slot.level } : {}) },
        },
        standing,
        slot ? null : { reason: t("table.hand.rider.noSlotToSmite"), spent: true },
      ),
    );
  }
  const pool = sheet.resources.sub_superiority_dice;
  if (pool) {
    const die = `1${maneuverDieFor(sheet)}`;
    const picks = sheet.features
      .map((feature) => /^maneuver:\s*(.+)$/i.exec(feature.name)?.[1]?.trim())
      .filter((name): name is string => Boolean(name));
    const left = pool.max - pool.used;
    for (const name of picks.length ? picks : ["Maneuver"]) {
      const use = maneuverUse(name);
      const rules = picks.length ? SWING_RULES[use] : "table.hand.rider.maneuverFallback";
      if (!rules) continue;
      // Feinting Attack and Quick Toss take the bonus action with the swing;
      // Grappling Strike's grapple needs it after.
      const bonus = use === "feint" || use === "bonus_swing" || use === "grapple";
      cards.push(
        gated(
          {
            ...base,
            id: `rider:${textKey(name)}`,
            name,
            dice: use === "grapple" ? t("table.hand.rider.grappleDice", { die }) : `+${die}`,
            rules: t(rules),
            resource: t("table.hand.rider.diceLine", { left, max: pool.max }),
            icon: { kind: "feature", key: name, family: "class-fighter" },
            damage: use === "grapple" ? null : die,
            damageType: "",
            pool: "sub_superiority_dice",
            intent: { card: "rider", rider: name },
          },
          standing,
          left > 0 ? null : { reason: t("table.hand.rider.noDice"), spent: true },
          bonus ? costGate("bonus", turn, sheet, name, t) : null,
        ),
      );
    }
  }
  return cards;
}

// ---- the basics ----

const BASICS: Array<{ id: BasicActionId; name: string; rules: string; target: HandTarget; compose?: boolean; asks?: "trigger" }> = [
  { id: "dodge", name: "Dodge", rules: "Attacks against you roll at disadvantage until your next turn.", target: "none" },
  { id: "dash", name: "Dash", rules: "Double your movement this turn.", target: "none" },
  { id: "disengage", name: "Disengage", rules: "Your movement provokes no opportunity attacks this turn.", target: "none" },
  { id: "help", name: "Help", rules: "An ally gets advantage on their next attack against a creature you name within 5 ft of you, or on a check.", target: "ally" },
  { id: "hide", name: "Hide", rules: "A Stealth check to slip out of sight.", target: "none" },
  { id: "search", name: "Search", rules: "Perception or Investigation to find what is hidden.", target: "none" },
  { id: "escape", name: "Escape", rules: "Athletics or Acrobatics against the grappler's Athletics.", target: "none" },
  { id: "stand-up", name: "Stand up", rules: "Getting up costs half your speed.", target: "none" },
  { id: "ready", name: "Ready", rules: "Name a trigger and what you will do when it happens; your reaction does it then.", target: "none", asks: "trigger" },
  { id: "grapple", name: "Grapple", rules: "Athletics against their Athletics or Acrobatics. Takes the place of one attack.", target: "enemy" },
  { id: "shove", name: "Shove", rules: "Knock them prone or push them 5 ft. Takes the place of one attack.", target: "enemy" },
  { id: "use-object", name: "Use an object", rules: "Drink, pull, light, throw: say what.", target: "none", compose: true },
  { id: "end-turn", name: "End turn", rules: "Done with your action, movement and bonus action.", target: "none" },
];

// The moves a feature lets a character make as the bonus action, by the
// engine's own reading of the sheet (bonus-routes.ts, which take_action asks).
const BONUS_MOVES: MoveAction[] = ["dash", "disengage", "hide", "dodge"];

// The damage types a swing names, keyed to the reader's word (the same
// words the FR book prints: Tranchants, Perforants, Contondants).
const DTYPE_KEY: Record<string, string> = {
  acid: "table.hand.dtype.acid",
  bludgeoning: "table.hand.dtype.bludgeoning",
  cold: "table.hand.dtype.cold",
  fire: "table.hand.dtype.fire",
  force: "table.hand.dtype.force",
  lightning: "table.hand.dtype.lightning",
  necrotic: "table.hand.dtype.necrotic",
  piercing: "table.hand.dtype.piercing",
  poison: "table.hand.dtype.poison",
  psychic: "table.hand.dtype.psychic",
  radiant: "table.hand.dtype.radiant",
  slashing: "table.hand.dtype.slashing",
  thunder: "table.hand.dtype.thunder",
  healing: "table.hand.dtype.healing",
};

export function dmgWithType(damage: string, type: string, t: T): string {
  if (!type) return damage.trim();
  const key = DTYPE_KEY[type.trim().toLowerCase()];
  return key ? `${damage} ${t(key)}` : `${damage} ${type}`.trim();
}

const BASIC_RULE_KEY: Record<BasicActionId, string> = {
  dodge: "table.hand.basic.dodge.rules",
  dash: "table.hand.basic.dash.rules",
  disengage: "table.hand.basic.disengage.rules",
  help: "table.hand.basic.help.rules",
  hide: "table.hand.basic.hide.rules",
  search: "table.hand.basic.search.rules",
  escape: "table.hand.basic.escape.rules",
  "stand-up": "table.hand.basic.stand-up.rules",
  ready: "table.hand.basic.ready.rules",
  grapple: "table.hand.basic.grapple.rules",
  shove: "table.hand.basic.shove.rules",
  "use-object": "table.hand.basic.use-object.rules",
  "end-turn": "table.hand.basic.end-turn.rules",
  stabilize: "table.hand.basic.stabilize.rules",
  dismount: "table.hand.basic.dismount.rules",
};

// The basics' own words, keyed so a French reader's cards read like the
// tutorial that promises them (SRD 5.1 FR print: Esquiver, Foncer,
// Se désengager, Empoigner, Bousculer).
const BASIC_NAME_KEYS: Record<BasicActionId, string> = {
  dodge: "table.hand.basic.dodge",
  dash: "table.hand.basic.dash",
  disengage: "table.hand.basic.disengage",
  help: "table.hand.basic.help",
  hide: "table.hand.basic.hide",
  search: "table.hand.basic.search",
  escape: "table.hand.basic.escape",
  "stand-up": "table.hand.basic.stand-up",
  ready: "table.hand.basic.ready",
  grapple: "table.hand.basic.grapple",
  shove: "table.hand.basic.shove",
  "use-object": "table.hand.basic.use-object",
  "end-turn": "table.hand.basic.end-turn",
  stabilize: "table.hand.basic.stabilize",
  dismount: "table.hand.basic.dismount",
};

function basicCards(sheet: CharacterSheet, turn: HandTurn, riders: CombatRiders, board: HandOptions["board"], t: T = enT): HandCard[] {
  const derived = computeSheetDerived(sheet);
  const allowed = 1 + riders.extraAttacks;
  // The engine's own refusals of a basic action on the rules (take_action's
  // words): a grapple with both hands full (cast-rules.ts
  // grappleHandsProblem), a Hide a watcher sees clearly (the board view's
  // verdict, hide-traits.ts hideRefusal). Both cards were open and refused.
  const grappleHands = grappleHandsProblem(sheet);
  const ruled = (id: BasicActionId): Gate =>
    id === "grapple" && grappleHands
      ? { reason: grappleHands.error, spent: false }
      : id === "hide" && board?.hide
        ? { reason: board.hide, spent: false }
        : null;
  const grappled = sheet.conditions.some((entry) => entry.trim().toLowerCase() === "grappled");
  const prone = sheet.conditions.some((entry) => entry.trim().toLowerCase() === "prone");
  // A spell's hold (Web, Maze, Irresistible Dance): take_action escape breaks
  // it when no grapple does (src/lib/dm/spell-escape.ts).
  const hold = grappled ? null : spellHoldOf(sheet);
  const cards: HandCard[] = [];
  const athletics = derived.skills.athletics ?? derived.abilityMods.str;
  const make = (basic: (typeof BASICS)[number], route: BonusRoute | null): HandCard => {
    const contest = basic.id === "grapple" || basic.id === "shove";
    const cost: HandCost = basic.id === "end-turn" || basic.id === "stand-up" ? "free" : route ? "bonus" : "action";
    const escape = basic.id === "escape";
    const ki = route?.ki ? kiLeft(sheet) : null;
    return {
      id: route ? `basic:${basic.id}:bonus` : `basic:${basic.id}`,
      type: "basic",
      name: route
        ? t("table.hand.basic.routeName", { feature: route.feature, name: t(BASIC_NAME_KEYS[basic.id]) })
        : t(BASIC_NAME_KEYS[basic.id]),
      cost,
      // Help aims at the ally, who may stand anywhere (SRD 5.1 gives helping
      // with a task no range); its 5 feet are the foe's, named in its words.
      range: contest ? t("table.hand.range.melee") : basic.id === "help" ? "" : t("table.hand.range.self"),
      dice: contest || escape
        ? t("table.hand.dice.athletics", { mod: signed(athletics) })
        : basic.id === "hide"
          ? t("table.hand.dice.stealth", { mod: signed(derived.skills.stealth ?? derived.abilityMods.dex) })
          : basic.id === "search"
            ? t("table.hand.dice.perception", { mod: signed(derived.skills.perception ?? derived.abilityMods.wis) })
            : "",
      roll: contest || escape
        ? t("table.hand.roll.contested")
        : basic.id === "hide" || basic.id === "search"
          ? t("table.hand.roll.skill")
          : t("table.hand.roll.none"),
      rules: route
        ? t("table.hand.basic.routeRules", {
            rules: t(`${BASIC_RULE_KEY[basic.id]}`),
            feature: route.feature,
            tail: route.ki ? t("table.hand.basic.routeKi", { count: route.ki }) : route.counter ? t("table.hand.basic.routeUse") : "",
          })
        : t(`${BASIC_RULE_KEY[basic.id]}`),
      resource: route?.ki && sheet.resources.ki
        ? `Ki ${ki ?? 0}/${sheet.resources.ki.max}`
        : route?.counter
          ? `${route.feature} ${usesLeft(sheet, route.counter) ?? 0}/${sheet.resources[route.counter].max}`
          : "",
      condition:
        basic.id === "dodge"
          ? t("table.hand.cond.dodging")
          : basic.id === "grapple"
            ? t("table.hand.cond.grappled")
            : basic.id === "shove"
              ? t("table.hand.cond.prone")
              : basic.id === "ready"
                ? t("table.hand.cond.readied")
                : "",
      icon: { kind: "action", key: basic.id },
      target: basic.target,
      toHit: null,
      damage: null,
      damageType: "",
      heals: false,
      save: null,
      melee: contest,
      disabled: null,
      spent: false,
      compose: Boolean(basic.compose),
      ...(basic.asks ? { asks: basic.asks } : {}),
      // Step of the Wind and Patient Defense spend ki; a counted route its uses.
      ...(route?.ki ? { pool: "ki" } : route?.counter ? { pool: route.counter } : {}),
      intent: { card: "basic", action: basic.id, ...(route ? { bonus: true } : {}) },
    };
  };
  for (const basic of BASICS) {
    // Escape is only there to take while something holds you.
    if (basic.id === "escape" && !grappled && !hold) continue;
    // Standing up is only there to take while lying prone.
    if (basic.id === "stand-up" && !prone) continue;
    const plain = make(basic, null);
    const card: HandCard =
      basic.id === "escape" && hold
        ? {
            ...plain,
            name: t("table.hand.basic.escapeHold", { spell: hold.spell }),
            rules: hold.rules,
            dice: hold.dice,
            roll: hold.roll,
            condition: "",
          }
        : plain;
    if (basic.id === "stand-up") {
      // Movement, not an action (SRD 5.1, Being Prone): no standing at speed
      // 0, whether a condition or exhaustion stops them.
      const still: Gate =
        exhaustionSpeed(sheet.exhaustion ?? 0, effectiveSpeed(sheet.conditions, sheet.speed)) === 0
          ? { reason: t("table.hand.gate.standSpeed"), spent: false }
          : null;
      cards.push(gated(card, standingGate(sheet, turn, "move", t), still));
      continue;
    }
    if (basic.id === "end-turn") {
      // Ending the turn is always open to whoever holds it, down or not.
      cards.push(turn.myTurn ? card : gated(card, standingGate(sheet, turn, "free", t)));
      continue;
    }
    const contest = basic.id === "grapple" || basic.id === "shove";
    const still: Gate =
      basic.id === "dash" && effectiveSpeed(sheet.conditions, sheet.speed) === 0
        ? { reason: t("table.hand.gate.dashSpeed"), spent: false }
        : null;
    cards.push(
      gated(
        card,
        standingGate(sheet, turn, contest ? "attack" : "action", t),
        contest
          ? attackGate(turn, allowed, sheet, { hasteOk: false }, t)
          : costGate("action", turn, sheet, t(BASIC_NAME_KEYS[basic.id]), t),
        still,
        ruled(basic.id),
      ),
    );
    // The same move as the bonus action, where a feature allows it: Cunning
    // Action before the action as well as after it, Step of the Wind and
    // Patient Defense for a point of ki.
    const route = (BONUS_MOVES as string[]).includes(basic.id) ? bonusRouteFor(sheet, basic.id as MoveAction) : null;
    if (route) {
      const kiGate: Gate =
        route.ki > 0 && (kiLeft(sheet) ?? 0) < route.ki
          ? { reason: t("table.hand.gate.noKi", { name: sheet.name, feature: route.feature }), spent: true }
          : null;
      const usesGate: Gate =
        route.counter && !usesLeft(sheet, route.counter)
          ? { reason: t("table.hand.gate.noUse", { name: sheet.name, feature: route.feature }), spent: true }
          : null;
      cards.push(
        gated(make(basic, route), standingGate(sheet, turn, "bonus", t), costGate("bonus", turn, sheet, `${route.feature} (${basic.name})`, t), kiGate, usesGate, still, ruled(basic.id)),
      );
    }
  }
  return cards;
}

// ---- the hand ----

// Attacks, the riders that ride them, spells by level, class features, then
// the basics every character has, so a level 1 commoner still holds a hand.
// `locale` rides beside `t` for the data prose a builder does not key (the
// feature resources' names and guidance, class-resources-fr.ts).
export function deriveHand(sheet: CharacterSheet, turn: HandTurn = FRESH_TURN, options: HandOptions = {}, t: T = enT, locale: Locale = "en"): HandCard[] {
  const riders = combatRiders(sheet);
  const spells = spellCards(sheet, turn, riders, options, t);
  const features = featureCards(sheet, turn, t, locale);
  // By name, and by the spend a card plays (Arcane Jolt's two cards are one spend, and so are Cauterizing Flames' two reactions).
  const taken = new Set(features.flatMap((card) => [textKey(card.name), ...(card.intent.card === "reaction" ? [textKey(card.intent.feature)] : []), ...(card.intent.card === "feature" && card.intent.resourceId ? [textKey(card.intent.resourceId)] : [])]));
  return [
    ...attackCards(sheet, turn, riders, options, t),
    ...riderCards(sheet, turn, riders, t),
    ...spells,
    ...ringSpellCards(sheet, turn, riders, options),
    ...(options.items === false ? [] : itemSpellCards(sheet, turn, riders, options)),
    ...features,
    ...optionCards(sheet, turn, t),
    ...intimidatingPresenceCards(sheet, turn, t),
    ...subclassSpendCards(sheet, turn, taken, t),
    ...kiCards(sheet, turn, t),
    ...basicCards(sheet, turn, riders, options.board, t).map((card) => (card.id === "basic:ready" ? withReadySpells(card, spells, t) : card)),
    ...gearCards(sheet, turn, options.gear, t),
    ...fastHandsCards(sheet, turn, t),
  ];
}

// Ready commits to one action (SRD 5.1; src/lib/dm/readied-kinds.ts): an
// attack unless the player picks another. The "@" picks are take_action's
// `readied` (hand-play.ts sends them as readyAction); a spell by its name is
// take_action's `spell`: the engine casts it now, slot and concentration,
// and releases it with the reaction when the trigger comes. The spells
// offered are the hand's own one-action spell cards the cast guard would
// take now.
const READY_PICKS: Array<{ value: string; labelKey: string }> = [
  { value: "", labelKey: "table.hand.basic.ready.attack" },
  { value: "@move", labelKey: "table.hand.basic.ready.move" },
  { value: "@help", labelKey: "table.hand.basic.ready.help" },
  { value: "@hide", labelKey: "table.hand.basic.ready.hide" },
  { value: "@search", labelKey: "table.hand.basic.ready.search" },
  { value: "@use_object", labelKey: "table.hand.basic.ready.useObject" },
  { value: "@item", labelKey: "table.hand.basic.ready.item" },
  { value: "@grapple", labelKey: "table.hand.basic.ready.grapple" },
  { value: "@shove", labelKey: "table.hand.basic.ready.shove" },
];

function withReadySpells(card: HandCard, spells: HandCard[], t: T = enT): HandCard {
  const ready = spells.filter(
    (spell) => spell.intent.card === "spell" && spell.cost === "action" && !spell.disabled,
  );
  const levels: Record<string, number> = {};
  const options: NonNullable<HandCard["choice"]>["options"] = READY_PICKS.map((pick) => ({ value: pick.value, label: t(pick.labelKey) }));
  for (const spell of ready) {
    if (spell.intent.card !== "spell") continue;
    options.push({ value: spell.name, label: spell.name, note: spell.resource });
    if (spell.intent.slotLevel) levels[spell.name] = spell.intent.slotLevel;
  }
  return { ...card, choice: { arg: "readySpell", label: t("table.hand.basic.ready"), options, fallback: "", levels } };
}

// The spells the component has to look up before the hand is complete.
export function spellsToLookUp(sheet: CharacterSheet): string[] {
  return spellNames(sheet);
}

// The same, and what its items cast, for the cards alone: the summoning door lists
// what the sheet casts from its own slots.
export function handSpellsToLookUp(sheet: CharacterSheet): string[] {
  return [...spellNames(sheet), ...ringSpellNames(sheet), ...itemSpellNames(sheet)];
}

// Nine in the fan, the rest behind the "more" spine; a player's own
// arrangement of the fan is hand-layout.ts (issue 231).
export { splitHand } from "@/lib/battlemap/hand-layout";

export { attacksAllowed } from "@/lib/battlemap/hand-core";
