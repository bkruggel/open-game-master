"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { GameIcon } from "@/components/ui/GameIcon";
import {
  ActionPlate,
  CloseForm,
  DeskCard,
  adjudicationGlyph,
} from "@/app/campaigns/[campaignId]/DmConsoleParts";
import { DmActionForm } from "@/app/campaigns/[campaignId]/DmActionForm";
import { ADJUDICATIONS } from "@/lib/dm/invoke-catalog";
import { findAdjudication } from "@/lib/dm/catalog-types";
import { DIFFICULTY_TIERS, dcForDifficulty, type DifficultyTier } from "@/lib/srd/dc";
import { evaluateEncounter, type EncounterVerdict } from "@/lib/srd/encounter-math";
import { OddsCalculator, type CritRules } from "@/app/campaigns/[campaignId]/DmOddsPanel";
import type { PublicEncounter } from "@/lib/db/encounter-view";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { LengthNote } from "@/components/ui/LengthNote";
import { QUESTION_MAX_CHARS, questionLength } from "@/lib/dm/ask-logic";
import { useT } from "@/lib/locale";

// The translator's shape, for the label helpers below: `t` comes in first
// (src/lib/story-window.ts).
type T = (key: string, vars?: Record<string, string | number>) => string;

// The DM's assist rail: read-only answers from engines that already exist.
// Nothing here applies anything to the game. The one exception is the
// suggestion, which hands the DM a prefilled adjudication form; they still
// press the button.

// The tiers' and verdicts' words by value; the keys live with the assist rail.
const TIER_LABEL_KEYS: Record<DifficultyTier, "dm.tier.very_easy" | "dm.tier.easy" | "dm.tier.moderate" | "dm.tier.hard" | "dm.tier.very_hard" | "dm.tier.nearly_impossible"> = {
  very_easy: "dm.tier.very_easy",
  easy: "dm.tier.easy",
  moderate: "dm.tier.moderate",
  hard: "dm.tier.hard",
  very_hard: "dm.tier.very_hard",
  nearly_impossible: "dm.tier.nearly_impossible",
};

const VERDICT_LABEL_KEYS: Record<EncounterVerdict, "dm.verdict.trivial" | "dm.verdict.easy" | "dm.verdict.medium" | "dm.verdict.hard" | "dm.verdict.deadly" | "dm.verdict.beyond_deadly"> = {
  trivial: "dm.verdict.trivial",
  easy: "dm.verdict.easy",
  medium: "dm.verdict.medium",
  hard: "dm.verdict.hard",
  deadly: "dm.verdict.deadly",
  beyond_deadly: "dm.verdict.beyond_deadly",
};

const VERDICT_TONE: Record<EncounterVerdict, string> = {
  trivial: "text-stone-400",
  easy: "text-emerald-300",
  medium: "text-amber-200",
  hard: "text-orange-300",
  deadly: "text-red-300",
  beyond_deadly: "text-red-400",
};

const inputClass = ui.input;

type Suggestion = {
  name: string;
  label: string;
  summary: string;
  args?: Record<string, unknown>;
  why?: string;
};

// "The player said this. What am I supposed to press?" The shortlist comes
// from a keyword pass over the catalog and arrives instantly; the model only
// reorders it and fills the form in.
function IntentSuggest({
  campaignId,
  sheets,
  encounter,
  intent,
  onIntentChange,
}: {
  campaignId: string;
  sheets: CharacterSheet[];
  encounter: PublicEncounter | null;
  intent: string;
  onIntentChange: (next: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState<Suggestion | null>(null);

  async function ask(useModel: boolean) {
    const text = intent.trim();
    if (!text) {
      return;
    }
    setBusy(true);
    setError("");
    setOpen(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/dm/assist/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: text, useModel }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("dm.assist.error.workout"));
        return;
      }
      setSuggestions(data.suggestions ?? []);
      if (!data.suggestions?.length) {
        setError(t("dm.assist.error.noMatch"));
      }
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  const openEntry = open ? findAdjudication(ADJUDICATIONS, open.name) : null;

  return (
    <DeskCard glyph="die-d20" title={t("dm.assist.suggestTitle")}>
      <textarea
        value={intent}
        onChange={(event) => onIntentChange(event.target.value.slice(0, 1000))}
        rows={2}
        placeholder={t("dm.assist.suggestPlaceholder")}
        aria-label={t("dm.assist.saidAria")}
        className={cn(inputClass, "resize-y")}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => ask(true)}
          disabled={busy || !intent.trim()}
          aria-busy={busy}
          className={ui.btnPrimary}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {t("dm.assist.suggest")}
        </button>
        <button
          type="button"
          onClick={() => ask(false)}
          disabled={busy || !intent.trim()}
          title={t("dm.assist.noModelTitle")}
          className={cn(ui.btnSmall, "min-h-10 text-xs")}
        >
          {t("dm.assist.noModel")}
        </button>
      </div>
      {error ? <p className="motion-shake mt-1.5 text-xs text-red-400">{error}</p> : null}

      {suggestions.length ? (
        <ul className="stagger mt-2 space-y-1.5">
          {suggestions.map((suggestion) => (
            <li key={suggestion.name}>
              {open?.name === suggestion.name && openEntry ? (
                <div className="reveal space-y-1">
                  <DmActionForm
                    campaignId={campaignId}
                    entry={openEntry}
                    sheets={sheets}
                    encounter={encounter}
                    initialArgs={suggestion.args}
                    glyph={adjudicationGlyph(suggestion.name, "tab-dm")}
                  />
                  <CloseForm onClick={() => setOpen(null)} />
                </div>
              ) : (
                <ActionPlate
                  glyph={adjudicationGlyph(suggestion.name, "tab-dm")}
                  label={suggestion.label}
                  badge={
                    suggestion.args ? (
                      <span className="ml-1.5 rounded-full border border-amber-500/40 bg-amber-400/10 px-1.5 py-px align-middle font-display text-[10px] tracking-[0.1em] text-amber-200">
                        {t("dm.assist.filledIn")}
                      </span>
                    ) : null
                  }
                  summary={suggestion.why || suggestion.summary}
                  onClick={() => setOpen(suggestion)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </DeskCard>
  );
}

// The DMG's difficulty ladder, so "hard" is DC 20 in every scene.
function DcLadder() {
  const t = useT();
  return (
    <DeskCard glyph="rest-proficiency" title={t("dm.assist.costTitle")}>
      <div className="stagger-pop flex flex-wrap gap-1">
        {DIFFICULTY_TIERS.map((tier) => (
          <span
            key={tier}
            className="inline-flex items-center rounded-lg border border-amber-500/25 bg-stone-950/50 px-2 py-1 text-xs text-stone-200"
          >
            {t(TIER_LABEL_KEYS[tier])}
            <span className="ml-1.5 font-display font-semibold tracking-wide text-amber-200">
              {t("dm.assist.dc", { n: dcForDifficulty(tier) })}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-stone-500">
        {t("dm.assist.tierNote")}
      </p>
    </DeskCard>
  );
}

// The budget card's shared shell, so the empty and measured states share one title.
function BudgetCard({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <DeskCard glyph="system-encounters" title={t("dm.assist.hardTitle")}>
      {children}
    </DeskCard>
  );
}

// The fight on the board, measured against the party in front of it.
function EncounterBudget({
  sheets,
  encounter,
}: {
  sheets: CharacterSheet[];
  encounter: PublicEncounter | null;
}) {
  const t = useT();
  const evaluation = useMemo(() => {
    const levels = sheets.filter((sheet) => !sheet.deathSaves?.dead).map((sheet) => sheet.level);
    const crs = (encounter?.enemies ?? [])
      .filter((enemy) => enemy.status === "alive")
      .map((enemy) => enemy.cr);
    if (!levels.length || !crs.length) {
      return null;
    }
    return evaluateEncounter(levels, crs);
  }, [sheets, encounter]);

  if (!evaluation) {
    return (
      <BudgetCard>
        <p className="text-xs text-stone-500">{t("dm.assist.budgetEmpty")}</p>
      </BudgetCard>
    );
  }
  return (
    <BudgetCard>
      <p key={evaluation.verdict} className={cn("count-pop flex items-center gap-2 font-display text-base tracking-wide", VERDICT_TONE[evaluation.verdict])}>
        <GameIcon icon={{ kind: "glyph", key: "tab-battle" }} size="size-6" />
        {t(VERDICT_LABEL_KEYS[evaluation.verdict])}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
        {t("dm.assist.xpLine", {
          adjusted: evaluation.adjustedXp.toLocaleString(),
          easy: evaluation.thresholds.easy.toLocaleString(),
          medium: evaluation.thresholds.medium.toLocaleString(),
          hard: evaluation.thresholds.hard.toLocaleString(),
          deadly: evaluation.thresholds.deadly.toLocaleString(),
          raw: evaluation.totalXp.toLocaleString(),
        })}
      </p>
    </BudgetCard>
  );
}

// Rules lookup, which is Ask with the scope pinned to "rules" and the answer
// kept private. Not a second Ask: the same endpoint, the same retrieval, the
// same citations. What it adds is that the DM does not have to leave the
// console to use it, which on a phone means not leaving the screen.
//
// House rules already win here: assembleEvidence pulls the table's own
// rule_chunks, sorts pinned ones first, and tells the model they override the
// standard rules.
function RulesLookup({ campaignId }: { campaignId: string }) {
  const t = useT();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    citations: Array<{ kind: string; ref: string; quote: string }>;
  } | null>(null);

  // The same limit as the Ask box: the question used to be cut at 500
  // characters as it was typed, with nothing said (issue 207).
  const noteId = useId();
  const length = questionLength(question);
  const tooLong = length > QUESTION_MAX_CHARS;

  async function look() {
    const text = question.trim();
    if (!text || questionLength(text) > QUESTION_MAX_CHARS) {
      return;
    }
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, scope: "rules", visibility: "private" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("dm.assist.error.lookup"));
        return;
      }
      setAnswer({ answer: data.ask?.answer ?? "", citations: data.ask?.citations ?? [] });
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskCard glyph="system-rules" title={t("dm.assist.ruleTitle")}>
      <div className="flex gap-1.5">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void look();
            }
          }}
          placeholder={t("dm.assist.rulePlaceholder")}
          aria-label={t("dm.assist.ruleAria")}
          aria-describedby={noteId}
          aria-invalid={tooLong || undefined}
          className={cn(inputClass, tooLong && "border-red-500/60")}
        />
        <button
          type="button"
          onClick={look}
          disabled={busy || !question.trim() || tooLong}
          aria-busy={busy}
          className={cn(ui.btnSecondary, "shrink-0")}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : t("dm.assist.ask")}
        </button>
      </div>
      <LengthNote id={noteId} length={length} max={QUESTION_MAX_CHARS} from={0.8} className="mt-1" />
      {error ? <p className="motion-shake mt-1.5 text-xs text-red-400">{error}</p> : null}
      {answer ? (
        <div className="reveal mt-1.5 text-xs text-stone-300">
          <p className="whitespace-pre-wrap">{answer.answer}</p>
          {answer.citations.length ? (
            <ul className="reveal mt-1 space-y-0.5 text-[11px] text-stone-500">
              {answer.citations.map((citation) => (
                <li key={`${citation.kind}:${citation.ref}`}>
                  {citation.ref}: {citation.quote}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </DeskCard>
  );
}

export function DmAssistPanel({
  campaignId,
  sheets,
  encounter,
  variantRules,
  intent,
  onIntentChange,
}: {
  campaignId: string;
  sheets: CharacterSheet[];
  encounter: PublicEncounter | null;
  // The table's crit rules, so the consequence preview agrees with what the
  // server would roll.
  variantRules: CritRules;
  intent: string;
  onIntentChange: (next: string) => void;
}) {
  return (
    <div className="space-y-3">
      <IntentSuggest
        campaignId={campaignId}
        sheets={sheets}
        encounter={encounter}
        intent={intent}
        onIntentChange={onIntentChange}
      />
      <EncounterBudget sheets={sheets} encounter={encounter} />
      <DcLadder />
      <OddsCalculator variantRules={variantRules} />
      <RulesLookup campaignId={campaignId} />
    </div>
  );
}
