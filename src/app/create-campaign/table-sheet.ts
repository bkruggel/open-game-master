import type { CampaignDraft, WizardGates } from "@/app/create-campaign/draft";
// Pure still: the translate is only the English fallback for a caller that
// passes no translator (the suites).
import { translate } from "@/lib/messages-logic";

// The table sheet's pure half: which table switches the creator shows, in which
// group, which of them the "features on" total counts, and what a press
// does to the draft. SheetRows draws the rows wherever the essentials and
// experience steps group them; scripts/test-world-portals.mjs
// holds the count to thirteen.

// Which of the table features are switched on, counting only the ones the
// wizard actually showed: a hidden toggle is not a choice the table made.
// The review step reads this so its "n on" agrees with the grid.
export function featuresOn(draft: CampaignDraft, gates: WizardGates): number {
  const { aiNarrates, solo } = gates;
  const bonds = draft.relationships !== "off";
  return [
    aiNarrates && draft.aiStorySetup,
    draft.ttsEnabled,
    draft.mapsEnabled,
    draft.ambienceEnabled,
    draft.ambienceEnabled && draft.ambienceAuto,
    draft.multiclassingEnabled,
    aiNarrates && draft.worldSimulation,
    draft.inventoryApprovals,
    draft.vitalsApprovals,
    bonds,
    bonds && draft.romance !== "off",
    aiNarrates && draft.narrationGuard,
    !solo && draft.midGameJoinOpen,
    !solo && draft.holdSubmissions,
  ].filter(Boolean).length;
}

// The translator a caller hands over (`const t = useT()`).
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type SheetGroupId = "narration" | "senses" | "people" | "rules";

export type SheetRowKey =
  | "aiStorySetup"
  | "narrationGuard"
  | "worldSimulation"
  | "ttsEnabled"
  | "mapsEnabled"
  | "ambienceEnabled"
  | "ambienceAuto"
  | "presentation"
  | "relationships"
  | "romance"
  | "multiCharacter"
  | "midGameJoinOpen"
  | "holdSubmissions"
  | "multiclassingEnabled"
  | "inventoryApprovals"
  | "vitalsApprovals"
  | "boardDrawing"
  | "enemyIntent";

// Which explainer a row carries; SheetRows maps these to the lobby's texts.
export type SheetInfo = "livingWorld" | "bonds" | "romance" | "narrationGuard";

export type SheetRow = {
  key: SheetRowKey;
  label: string;
  hint: string;
  on: boolean;
  // Where the knob rests: 0 off, 1 on, 0.5 for the middle of the tri-state.
  knob: 0 | 0.5 | 1;
  // True for the thirteen rows featuresOn() adds up.
  counted: boolean;
  disabled: boolean;
  // A row that exists because its parent is on arrives rather than blinks in.
  dependent: boolean;
  info: SheetInfo | null;
};

export type SheetGroup = { id: SheetGroupId; label: string; note: string; rows: SheetRow[] };

type RowSpec = {
  key: SheetRowKey;
  group: SheetGroupId;
  counted: boolean;
  aiOnly?: boolean;
  tableOnly?: boolean;
  needs?: "ambienceEnabled" | "relationships";
  info?: SheetInfo;
};

// Order inside a group is the order on screen. A dependent row sits right
// after its parent so it appears beside the switch that summoned it.
const ROWS: RowSpec[] = [
  { key: "aiStorySetup", group: "narration", counted: true, aiOnly: true },
  { key: "narrationGuard", group: "narration", counted: true, aiOnly: true, info: "narrationGuard" },
  { key: "worldSimulation", group: "narration", counted: true, aiOnly: true, info: "livingWorld" },
  { key: "ttsEnabled", group: "senses", counted: true },
  { key: "mapsEnabled", group: "senses", counted: true },
  { key: "ambienceEnabled", group: "senses", counted: true },
  { key: "ambienceAuto", group: "senses", counted: true, needs: "ambienceEnabled" },
  { key: "presentation", group: "senses", counted: false },
  { key: "relationships", group: "people", counted: true, info: "bonds" },
  { key: "romance", group: "people", counted: true, needs: "relationships", info: "romance" },
  { key: "multiCharacter", group: "people", counted: false },
  { key: "midGameJoinOpen", group: "people", counted: true, tableOnly: true },
  { key: "holdSubmissions", group: "people", counted: true, tableOnly: true },
  { key: "multiclassingEnabled", group: "rules", counted: true },
  { key: "inventoryApprovals", group: "rules", counted: true },
  { key: "vitalsApprovals", group: "rules", counted: true },
  { key: "boardDrawing", group: "rules", counted: false },
  { key: "enemyIntent", group: "rules", counted: false },
];

// The groups' words by key; the keys live with the table sheet group.
const GROUP_KEYS: Record<SheetGroupId, "tsheet.group.narration" | "tsheet.group.senses" | "tsheet.group.people" | "tsheet.group.rules"> = {
  narration: "tsheet.group.narration",
  senses: "tsheet.group.senses",
  people: "tsheet.group.people",
  rules: "tsheet.group.rules",
};
const GROUP_NOTE_KEYS: Partial<Record<SheetGroupId, "tsheet.group.narration.note">> = {
  narration: "tsheet.group.narration.note",
};

const GROUPS: SheetGroupId[] = ["narration", "senses", "people", "rules"];

function parentOn(draft: CampaignDraft, needs: RowSpec["needs"]): boolean {
  if (needs === "ambienceEnabled") return draft.ambienceEnabled;
  if (needs === "relationships") return draft.relationships !== "off";
  return true;
}

function gated(spec: RowSpec, gates: WizardGates): boolean {
  return Boolean((spec.aiOnly && !gates.aiNarrates) || (spec.tableOnly && gates.solo));
}

function copy(
  t: Translate,
  spec: RowSpec,
  draft: CampaignDraft,
  gates: WizardGates,
): { label: string; hint: string } {
  switch (spec.key) {
    case "aiStorySetup":
      return { label: t("tsheet.row.aiStorySetup"), hint: t("tsheet.row.aiStorySetup.hint") };
    case "narrationGuard":
      return { label: t("tsheet.row.narrationGuard"), hint: t("tsheet.row.narrationGuard.hint") };
    case "worldSimulation":
      return { label: t("tsheet.row.worldSimulation"), hint: t("tsheet.row.worldSimulation.hint") };
    case "ttsEnabled":
      return {
        label: t("tsheet.row.ttsEnabled"),
        hint: gates.ttsAvailable ? t("tsheet.row.ttsEnabled.hint") : t("tsheet.row.ttsEnabled.hintOff"),
      };
    case "mapsEnabled":
      return {
        label: t("tsheet.row.mapsEnabled"),
        hint: gates.mapsAvailable ? t("tsheet.row.mapsEnabled.hint") : t("tsheet.row.mapsEnabled.hintOff"),
      };
    case "ambienceEnabled":
      return { label: t("tsheet.row.ambienceEnabled"), hint: t("tsheet.row.ambienceEnabled.hint") };
    case "ambienceAuto":
      return { label: t("tsheet.row.ambienceAuto"), hint: t("tsheet.row.ambienceAuto.hint") };
    case "presentation":
      return {
        label: t("tsheet.row.presentation"),
        hint: t("tsheet.row.presentation.hint"),
      };
    case "relationships":
      return { label: t("tsheet.row.relationships"), hint: t("tsheet.row.relationships.hint") };
    case "romance":
      return { label: t("tsheet.row.romance"), hint: t("tsheet.row.romance.hint") };
    case "multiCharacter":
      return {
        label:
          draft.multiCharacter === "all_active"
            ? t("tsheet.row.multiCharacter.all")
            : draft.multiCharacter === "one_active"
              ? t("tsheet.row.multiCharacter.one")
              : t("tsheet.row.multiCharacter.single"),
        hint: t("tsheet.row.multiCharacter.hint"),
      };
    case "midGameJoinOpen":
      return { label: t("tsheet.row.midGameJoinOpen"), hint: t("tsheet.row.midGameJoinOpen.hint") };
    case "holdSubmissions":
      return { label: t("tsheet.row.holdSubmissions"), hint: t("tsheet.row.holdSubmissions.hint") };
    case "multiclassingEnabled":
      return { label: t("tsheet.row.multiclassingEnabled"), hint: t("tsheet.row.multiclassingEnabled.hint") };
    case "inventoryApprovals":
      return { label: t("tsheet.row.inventoryApprovals"), hint: t("tsheet.row.inventoryApprovals.hint") };
    case "vitalsApprovals":
      return { label: t("tsheet.row.vitalsApprovals"), hint: t("tsheet.row.vitalsApprovals.hint") };
    case "boardDrawing":
      return {
        label: t("tsheet.row.boardDrawing"),
        hint: t("tsheet.row.boardDrawing.hint"),
      };
    case "enemyIntent":
      return { label: t("tsheet.row.enemyIntent"), hint: t("tsheet.row.enemyIntent.hint") };
  }
}

function knobOf(key: SheetRowKey, draft: CampaignDraft): 0 | 0.5 | 1 {
  switch (key) {
    case "presentation":
      return draft.presentation === "theatre" ? 1 : 0;
    case "relationships":
      return draft.relationships !== "off" ? 1 : 0;
    case "romance":
      return draft.romance !== "off" ? 1 : 0;
    case "multiCharacter":
      return draft.multiCharacter === "all_active" ? 1 : draft.multiCharacter === "one_active" ? 0.5 : 0;
    default:
      return draft[key] ? 1 : 0;
  }
}

// The groups as the step draws them. A group with nothing to show is left
// out, which is how the narrator block disappears when a person narrates.
export function tableSheet(
  tOrDraft: Translate | CampaignDraft,
  draftArg?: CampaignDraft,
  gatesArg?: WizardGates,
): SheetGroup[] {
  // Both call shapes: the step passes the translator first (t-first, the
  // agoLabel pattern), the suites pass the draft alone — the reading falls
  // back to the dictionary's English.
  const withT = typeof tOrDraft === "function";
  const t = (withT ? tOrDraft : (key: string, vars?: Record<string, string | number>) => translate("en", key, vars)) as Translate;
  const draft = (withT ? draftArg : tOrDraft) as CampaignDraft;
  const gates = (withT ? gatesArg : draftArg) as WizardGates;
  return GROUPS.map((groupId) => ({
    id: groupId,
    label: t(GROUP_KEYS[groupId]),
    note: GROUP_NOTE_KEYS[groupId] ? t(GROUP_NOTE_KEYS[groupId]!) : "",
    rows: ROWS.filter(
      (spec) => spec.group === groupId && !gated(spec, gates) && parentOn(draft, spec.needs),
    ).map((spec) => {
      const knob = knobOf(spec.key, draft);
      return {
        key: spec.key,
        ...copy(t, spec, draft, gates),
        on: knob > 0,
        knob,
        counted: spec.counted,
        // One server switch away rather than a feature this install can
        // never have, so the row stays visible and says why it is off.
        disabled: spec.key === "ttsEnabled" && !gates.ttsAvailable,
        dependent: Boolean(spec.needs),
        info: spec.info ?? null,
      };
    }),
  })).filter((group) => group.rows.length > 0);
}

// How many switches the total could reach in this mode. A dependent row
// counts even while its parent hides it: it is still a choice on offer.
export function countableRows(gates: WizardGates): number {
  return ROWS.filter((spec) => spec.counted && !gated(spec, gates)).length;
}

// What one press does. The tri-state walks off, one at a time, all at once;
// everything else flips.
export function flipRow(draft: CampaignDraft, key: SheetRowKey): Partial<CampaignDraft> {
  switch (key) {
    case "presentation":
      return { presentation: draft.presentation === "theatre" ? "plain" : "theatre" };
    case "relationships":
      return { relationships: draft.relationships !== "off" ? "off" : "on" };
    case "romance":
      return { romance: draft.romance === "off" ? "on" : "off" };
    case "multiCharacter":
      return {
        multiCharacter:
          draft.multiCharacter === "off"
            ? "one_active"
            : draft.multiCharacter === "one_active"
              ? "all_active"
              : "off",
      };
    default:
      return { [key]: !draft[key] };
  }
}
