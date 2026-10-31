import { signed, type HandCard, type MonsterAbilityUse, type MonsterMove } from "@/lib/battlemap/hand-core";
import type { PublicEnemyAbility, PublicEnemyActions, PublicEnemyAttack } from "@/lib/dm/enemy-actions-view";
import { monsterAttackIcon } from "@/lib/battlemap/attack-art";

// The DM's hand: a monster's turn as cards (issue #108). A person running
// the table used to play every goblin through the console's form; the
// players had cards. This derives the same HandCard shape the players' fan
// draws from the DM projection's `actions` (src/lib/dm/enemy-actions-view.ts),
// and turns a played card into the console's own invoke call, so the dice,
// the reach, the conditions and the audit trail are the engine's exactly as
// they are when the form is used.
//
// Like composerGate, the cards' own words (names, rules, refusal reasons,
// the aim bar's sentence; table.hand.monster.*) are read with the translator
// of the component that draws the hand. Pure and database-free otherwise:
// scripts/test-monster-hand.mjs drives every branch.

export type MonsterHandEnemy = {
  id: string;
  name: string;
  status: string;
  conditions: string[];
  actions?: PublicEnemyActions;
};

export type MonsterAdvantage = "none" | "advantage" | "disadvantage";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

const SAVE_WORDS: Record<string, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

function saveWord(code: string): string {
  return SAVE_WORDS[code.trim().toLowerCase()] ?? code.toUpperCase();
}

function cardKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// "Multiattack: 2 Claw, 1 Bite" from the swings one call makes.
export function swingsLine(t: Translator, swings: string[]): string {
  if (swings.length <= 1) {
    return "";
  }
  const counts = new Map<string, number>();
  for (const name of swings) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return t("table.hand.monster.multiattack", { swings: [...counts.entries()].map(([name, count]) => `${count} ${name}`).join(", ") });
}

const BASE = {
  cost: "action" as const,
  resource: "",
  condition: "",
  heals: false,
  compose: false,
};

function attackCard(t: Translator, enemy: MonsterHandEnemy, actions: PublicEnemyActions, attack: PublicEnemyAttack): HandCard {
  return {
    ...BASE,
    id: `monster:${enemy.id}:attack:${cardKey(attack.name)}`,
    type: "attack",
    name: attack.name,
    range: attack.range,
    dice: `${attack.damage} ${attack.type}`.trim(),
    roll: t("table.hand.monster.toHit", { bonus: signed(attack.toHit) }),
    rules: [swingsLine(t, attack.swings), attack.spellAttack ? t("table.hand.monster.spellAttack") : ""].filter(Boolean).join(" "),
    condition: attack.onHit ?? "",
    icon: monsterAttackIcon(enemy.name, attack.name, Boolean(attack.spellAttack)),
    target: "enemy",
    toHit: attack.toHit,
    damage: attack.damage || null,
    damageType: attack.type.split("/")[0] ?? "",
    save: null,
    melee: attack.melee,
    disabled: actions.refusal,
    spent: actions.acted,
    intent: { card: "monster", enemyId: enemy.id, action: "attack", attackName: attack.name },
  };
}

function abilityCard(t: Translator, enemy: MonsterHandEnemy, actions: PublicEnemyActions, ability: PublicEnemyAbility): HandCard {
  const use: MonsterAbilityUse = {
    name: ability.name,
    save: ability.save,
    dc: ability.dc,
    ...(ability.damage ? { damage: ability.damage } : {}),
    ...(ability.damageType ? { damageType: ability.damageType } : {}),
    ...(ability.halfOnSave !== undefined ? { halfOnSave: ability.halfOnSave } : {}),
    ...(ability.condition ? { condition: ability.condition } : {}),
    ...(ability.rounds ? { rounds: ability.rounds } : {}),
  };
  const rules = [
    ability.halfOnSave ? t("table.hand.monster.halfOnSave") : "",
    ability.rounds ? t("table.hand.monster.lasts", { count: ability.rounds }) : "",
    t("table.hand.monster.hintMany"),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    ...BASE,
    id: `monster:${enemy.id}:ability:${cardKey(ability.name)}`,
    type: ability.damage ? "spell" : "control",
    name: ability.name,
    range: "",
    dice: ability.damage ? `${ability.damage} ${ability.damageType ?? ""}`.trim() : (ability.condition ?? ""),
    roll: t("table.hand.monster.saveRoll", { ability: saveWord(ability.save), dc: ability.dc }),
    rules,
    resource: ability.resource,
    condition: ability.condition ?? "",
    icon: { kind: "action", key: "cast" },
    target: "enemy",
    toHit: null,
    damage: ability.damage ?? null,
    damageType: ability.damageType ?? "",
    save: { ability: saveWord(ability.save), dc: ability.dc },
    melee: false,
    // The ability's own reason first (not recharged), then the turn's.
    disabled: ability.refusal ?? actions.refusal,
    spent: Boolean(ability.refusal) || actions.acted,
    intent: { card: "monster", enemyId: enemy.id, action: "ability", ability: use },
  };
}

function fleeCard(t: Translator, enemy: MonsterHandEnemy): HandCard {
  return {
    ...BASE,
    id: `monster:${enemy.id}:flee`,
    type: "basic",
    name: t("table.hand.monster.nameFlee"),
    cost: "free",
    range: "",
    dice: "",
    roll: t("table.hand.react.noRoll"),
    rules: t("table.hand.monster.fleeRules"),
    icon: { kind: "action", key: "escape" },
    target: "none",
    toHit: null,
    damage: null,
    damageType: "",
    save: null,
    melee: false,
    disabled: enemy.status === "alive" ? null : t("table.hand.monster.statusHeld", { name: enemy.name, status: enemy.status }),
    spent: false,
    intent: { card: "monster", enemyId: enemy.id, action: "flee" },
  };
}

const MOVE_CARDS: Array<{ move: MonsterMove; nameKey: string; rulesKey: string }> = [
  { move: "dash", nameKey: "table.hand.monster.nameDash", rulesKey: "table.hand.monster.dashRules" },
  { move: "disengage", nameKey: "table.hand.monster.nameDisengage", rulesKey: "table.hand.monster.disengageRules" },
  { move: "dodge", nameKey: "table.hand.monster.nameDodge", rulesKey: "table.hand.monster.dodgeRules" },
];

// Dash, Disengage and Dodge (issue #621): its action, played with no target,
// as take_action with its enemyId. Only from a host that resolves them and
// says how far the creature may still walk.
function moveCards(t: Translator, enemy: MonsterHandEnemy, actions: PublicEnemyActions): HandCard[] {
  const movement = actions.movement;
  if (!movement) {
    return [];
  }
  return MOVE_CARDS.map(({ move, nameKey, rulesKey }) => {
    const disabled =
      move === "dash" && movement.speedFeet === 0
        ? t("table.hand.monster.speedHeld", { name: enemy.name })
        : move === "disengage" && movement.disengaged
          ? t("table.hand.monster.disengaged", { name: enemy.name })
          : move === "disengage"
            ? null
            : actions.refusal;
    return {
      ...BASE,
      id: `monster:${enemy.id}:${move}`,
      type: "basic",
      name: t(nameKey),
      range: "",
      dice: "",
      roll: t("table.hand.react.noRoll"),
      rules: t(rulesKey, { left: movement.leftFeet }),
      icon: { kind: "action", key: move },
      target: "none",
      toHit: null,
      damage: null,
      damageType: "",
      save: null,
      melee: false,
      // Disengage may still be its bonus action (Nimble Escape): the server
      // says no if neither is left.
      disabled: enemy.status === "alive" ? disabled : t("table.hand.monster.statusHeld", { name: enemy.name, status: enemy.status }),
      spent: move !== "disengage" && actions.acted,
      intent: { card: "monster", enemyId: enemy.id, action: move },
    };
  });
}

// The cards one enemy holds: its attacks, its save abilities, Dash, Disengage
// and Dodge when the host resolves them (`enemyActions`), and breaking off.
// Empty for an enemy the projection carries no actions for (a player's view,
// or an older server).
export function deriveMonsterHand(t: Translator, enemy: MonsterHandEnemy, options: { enemyActions?: boolean } = {}): HandCard[] {
  const actions = enemy.actions;
  if (!actions) {
    return [];
  }
  return [
    ...actions.attacks.map((attack) => attackCard(t, enemy, actions, attack)),
    ...actions.abilities.map((ability) => abilityCard(t, enemy, actions, ability)),
    ...(options.enemyActions ? moveCards(t, enemy, actions) : []),
    fleeCard(t, enemy),
  ];
}

// Whether the card takes several targets at once (a breath weapon catches
// everyone in its cone; one call spends one action).
export function takesManyTargets(card: HandCard): boolean {
  return card.intent.card === "monster" && card.intent.action === "ability";
}

function listNames(t: Translator, names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  // The joiner's own spaces come with the key's value (" and " / " et ").
  return `${names.slice(0, -1).join(", ")}${t("table.hand.join.and")}${names[names.length - 1]}`;
}

// The line the aim bar shows for the raised card.
export function monsterSentence(t: Translator, enemyName: string, card: HandCard, targetNames: string[]): string {
  const intent = card.intent;
  if (intent.card !== "monster") {
    return "";
  }
  const who = listNames(t, targetNames);
  if (intent.action === "attack") {
    return who
      ? t("table.hand.monster.attackLine", { name: enemyName, who, attack: card.name })
      : t("table.hand.monster.attackLineNoOne", { name: enemyName, attack: card.name });
  }
  if (intent.action === "ability") {
    return who
      ? t("table.hand.monster.abilityLine", { name: enemyName, who, ability: card.name })
      : t("table.hand.monster.abilityLineNoOne", { name: enemyName, ability: card.name });
  }
  if (intent.action === "dash") {
    return t("table.hand.monster.dashLine", { name: enemyName });
  }
  if (intent.action === "disengage") {
    return t("table.hand.monster.disengageLine", { name: enemyName });
  }
  if (intent.action === "dodge") {
    return t("table.hand.monster.dodgeLine", { name: enemyName });
  }
  return t("table.hand.monster.fleeLine", { name: enemyName });
}

// The console call a played card makes: the same adjudication the form
// would send, so the server's rules are the only rules. Null when the card
// still needs a target. rows: the targets that are enemy rows (a creature
// the party dominates strikes its own kind, issue 503).
export function monsterInvoke(
  card: HandCard,
  targetIds: string[],
  advantage: MonsterAdvantage = "none",
  rows: ReadonlySet<string> = new Set(),
): { name: string; args: Record<string, unknown> } | null {
  const intent = card.intent;
  if (intent.card !== "monster") {
    return null;
  }
  if (intent.action === "flee") {
    return { name: "enemy_flees", args: { enemyId: intent.enemyId, reason: "Breaks off and runs." } };
  }
  if (intent.action === "dash" || intent.action === "disengage" || intent.action === "dodge") {
    return { name: "take_action", args: { enemyId: intent.enemyId, action: intent.action } };
  }
  if (!targetIds.length) {
    return null;
  }
  if (intent.action === "attack") {
    return {
      name: "enemy_attack",
      args: {
        enemyId: intent.enemyId,
        targetCharacterId: targetIds[0],
        ...(intent.attackName ? { attack: intent.attackName } : {}),
        ...(advantage !== "none" ? { advantage } : {}),
      },
    };
  }
  const ability = intent.ability;
  if (!ability) {
    return null;
  }
  const numbers = {
    saveAbility: ability.save,
    dc: ability.dc,
    ...(ability.damage ? { damage: ability.damage } : {}),
    ...(ability.halfOnSave !== undefined ? { halfOnSave: ability.halfOnSave } : {}),
  };
  if (targetIds.length === 1) {
    return {
      name: "cast_at_player",
      args: {
        characterId: targetIds[0],
        casterEnemyId: intent.enemyId,
        enemyAbility: ability.name,
        ...numbers,
        ...(ability.damageType ? { damageType: ability.damageType } : {}),
        ...(ability.condition ? { condition: ability.condition } : {}),
        ...(ability.rounds ? { rounds: ability.rounds } : {}),
      },
    };
  }
  return {
    name: "aoe_damage",
    args: {
      casterEnemyId: intent.enemyId,
      enemyAbility: ability.name,
      characterIds: targetIds.filter((id) => !rows.has(id)),
      ...(targetIds.some((id) => rows.has(id)) ? { enemyIds: targetIds.filter((id) => rows.has(id)) } : {}),
      ...numbers,
      ...(ability.damageType ? { type: ability.damageType } : {}),
    },
  };
}
