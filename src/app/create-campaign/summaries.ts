import { TABLE_LANGUAGE_LABELS } from "@/lib/schemas/game-settings-options";
import type { CampaignDraft, WizardGates } from "@/app/create-campaign/draft";
import { bringsSomething } from "@/app/workshop/ContentImportPicker";

// The one line under each group's name, and the review's read-back of what
// is inside the groups. Worked out from the draft only, so a closed group
// still says truthfully what it holds. The words live in the dictionaries
// under creator.summary.*; each function takes the translator from the
// component that draws it (home/types.ts's agoLabel is the same pattern),
// with the English line as the source of every wording. Pure otherwise: no
// database, no model, and no React.

// The translator a component hands over (`const t = useT()`).
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function worldSummary(t: Translate, draft: CampaignDraft, gates: WizardGates, packName: string | null): string {
  return [
    packName ?? t("creator.summary.noPack"),
    TABLE_LANGUAGE_LABELS[draft.tableLanguage],
    gates.aiNarrates ? t(`creator.summary.length.${draft.campaignLength}`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function characterSummary(t: Translate, draft: CampaignDraft): string {
  return [
    t(`creator.summary.hp.${draft.hpMethod}`),
    draft.startingWealth === "equipment" ? t("creator.summary.kit") : t("creator.summary.gold"),
    draft.dicePolicy === "digital_only" ? t("creator.summary.digitalDice") : t("creator.summary.realDice"),
    draft.multiclassingEnabled ? t("creator.summary.multiclass.on") : t("creator.summary.multiclass.off"),
  ].join(" · ");
}

export function prepSummary(t: Translate, draft: CampaignDraft, sourceTitle: string | null): string {
  const lore = draft.loreDrafts.filter((entry) => entry.title.trim()).length;
  const importing = bringsSomething(draft.contentImport);
  return [
    draft.houseRules.trim() ? t("creator.summary.houseRulesWritten") : t("creator.summary.noHouseRules"),
    lore ? t("creator.summary.loreEntries", { count: lore }) : t("creator.summary.noLore"),
    importing ? t("creator.summary.prepFrom", { title: sourceTitle ?? t("creator.prep.fromWorkshop") }) : t("creator.summary.noPrep"),
  ].join(" · ");
}

export function narrationSummary(t: Translate, draft: CampaignDraft, gates: WizardGates, voiceName: string): string {
  if (!gates.ttsAvailable) {
    return t("creator.summary.notReadAloud");
  }
  if (!draft.ttsEnabled) {
    return t("creator.summary.narrationOff");
  }
  return t("creator.summary.voiceAt", {
    voice: voiceName,
    speed: draft.ttsSpeed.toFixed(2),
    casting: draft.ttsAutoCast ? t("creator.summary.autoCast") : t("creator.summary.narratorReads"),
  });
}

export function safetySummary(t: Translate, draft: Pick<CampaignDraft, "safety" | "gm">): string {
  const { safety, gm } = draft;
  const lists = [
    safety.lines.length ? t("creator.summary.lines", { count: safety.lines.length }) : null,
    safety.veils.length ? t("creator.summary.veils", { count: safety.veils.length }) : null,
  ].filter(Boolean);
  return [
    t(`creator.summary.boundary.${safety.boundaries}`),
    safety.xCard ? t("creator.summary.xCard.on") : t("creator.summary.xCard.off"),
    lists.length ? lists.join(", ") : t("creator.summary.noLines"),
    t(`creator.summary.strictness.${gm.strictness}`),
    gm.tone.length ? gm.tone.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function aiSummary(t: Translate, draft: CampaignDraft): string {
  return [
    draft.aiStorySetup ? t("creator.summary.storySetup.on") : t("creator.summary.storySetup.off"),
    draft.narrationGuard ? t("creator.summary.outcomeCheck.on") : t("creator.summary.outcomeCheck.off"),
    draft.worldSimulation ? t("creator.summary.livingWorld.on") : t("creator.summary.livingWorld.off"),
    t("creator.summary.alliesLabel", { allies: t(`creator.summary.allies.${draft.companions}`) }),
  ].join(" · ");
}

export function bondsSummary(t: Translate, draft: Pick<CampaignDraft, "relationships" | "romance">): string {
  if (draft.relationships === "off") {
    return t("creator.summary.bondsOff");
  }
  return draft.romance === "off" ? t("creator.summary.bondsOnly") : t("creator.summary.bondsRomance");
}

export function playersSummary(t: Translate, draft: CampaignDraft, gates: WizardGates): string {
  return [
    draft.multiCharacter === "off"
      ? t("creator.summary.oneEach")
      : draft.multiCharacter === "one_active"
        ? t("creator.summary.oneAtATime")
        : t("creator.summary.allFielded"),
    gates.solo ? null : draft.midGameJoinOpen ? t("creator.summary.joining.open") : t("creator.summary.joining.closed"),
    gates.solo ? null : draft.holdSubmissions ? t("creator.summary.heldResponses") : null,
    draft.inventoryApprovals || draft.vitalsApprovals ? t("creator.summary.confirmChanges") : t("creator.summary.instantChanges"),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function boardSummary(t: Translate, draft: Pick<CampaignDraft, "boardDrawing" | "enemyIntent">): string {
  return [
    draft.boardDrawing ? t("creator.summary.drawing.on") : t("creator.summary.drawing.off"),
    draft.enemyIntent ? t("creator.summary.intent.shown") : t("creator.summary.intent.hidden"),
  ].join(" · ");
}

export function variantSummary(t: Translate, draft: Pick<CampaignDraft, "variantRules">): string {
  const { restVariant, ...toggles } = draft.variantRules;
  const on = Object.values(toggles).filter(Boolean).length;
  return `${on ? t("creator.summary.onCount", { count: on }) : t("creator.summary.noneOn")} · ${t(`creator.summary.rests.${restVariant}`)}`;
}

export function voiceChatSummary(t: Translate, draft: Pick<CampaignDraft, "voiceChat">): string {
  return voiceSummary(t, draft.voiceChat);
}

// The live table's settings call it `voice`; the creator's draft `voiceChat`.
export function voiceSummary(t: Translate, voice: CampaignDraft["voiceChat"]): string {
  if (!voice.enabled) {
    return t("creator.summary.voiceOff");
  }
  return [
    t("creator.summary.voiceOn"),
    t(`creator.summary.turns.${voice.turnEnforcement}`),
    voice.rules.proximity ? t("creator.summary.proximity", { feet: voice.rules.hearingRangeFeet }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Whether the table has rules beyond the book: any variant rule, a rest
// variant, or house rules typed here.
export function customRules(t: Translate, draft: CampaignDraft): string | null {
  const { restVariant, ...toggles } = draft.variantRules;
  const on = Object.values(toggles).filter(Boolean).length;
  const parts = [
    on ? t("creator.summary.variantRules", { count: on }) : null,
    restVariant !== "standard" ? t(`creator.summary.rests.${restVariant}`) : null,
    draft.houseRules.trim() ? t("creator.summary.houseRules") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
