"use client";

import { useEffect, useId, useState } from "react";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import type { PendingRoll } from "@/app/campaigns/[campaignId]/useCampaignStream";
import { CheckFrame } from "@/app/campaigns/[campaignId]/SkillCheckCard";
import { foretoldLeft } from "@/lib/dm/foretold-logic";
import { holdsFeature } from "@/lib/srd/feature-names";
import { useT } from "@/lib/locale";

// A finger-sized target (40px, the kit's own) with a ring for the keyboard.
const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70";
const NUMBER = `motion-press inline-flex min-h-10 items-center justify-center rounded-full border border-amber-400/60 px-3 py-1 text-xs font-semibold disabled:opacity-50 ${RING}`;
const PLAIN = `motion-press inline-flex min-h-10 items-center px-1 text-xs font-medium underline decoration-dotted underline-offset-2 disabled:opacity-50 ${RING}`;

type Power = "portent" | "chronal_shift" | "flash_of_genius" | "favored_by_the_gods";
// The feature names as the table reads them: Présage is the FR SRD print for
// Portent; the other three have no official French, so the dictionary coins
// them (Décalage chronal, Éclair de génie, Favori des dieux). The sheet
// matches the features in English below — that matching is protocol.
const FEATURE_KEYS: Record<Power, string> = {
  portent: "pending.watch.feature.portent",
  chronal_shift: "pending.watch.feature.chronalShift",
  flash_of_genius: "pending.watch.feature.flashOfGenius",
  favored_by_the_gods: "pending.watch.feature.favoredByTheGods",
};

// The feature a character watches with: a diviner's numbers first, then a
// chronurgist's shift, an artificer's Flash of Genius, a divine soul's
// Favored by the Gods (src/lib/dm/foresight.ts asks in the same order).
export function watchFeatureOf(sheet: CharacterSheet): Power | null {
  if (foretoldLeft(sheet).length > 0) return "portent";
  if (holdsFeature(sheet, "chronal shift")) return "chronal_shift";
  if (holdsFeature(sheet, "flash of genius")) return "flash_of_genius";
  if (holdsFeature(sheet, "favored by the gods")) return "favored_by_the_gods";
  return null;
}

// What watching lets the player do, on the button's hint: an infinitive
// phrase, composed into the toggle's titles by {what}.
const WATCH_FOR_KEYS: Record<Power, string> = {
  portent: "pending.watch.for.portent",
  chronal_shift: "pending.watch.for.chronalShift",
  flash_of_genius: "pending.watch.for.flashOfGenius",
  favored_by_the_gods: "pending.watch.for.favoredByTheGods",
};

// The Intelligence modifier Flash of Genius adds, as the sheet's score gives it.
const intModifier = (sheet: CharacterSheet | undefined) => Math.floor(((sheet?.abilities?.int ?? 10) - 10) / 2);

// The stop before a watched roll (src/lib/dm/foresight.ts): the watcher may put
// a foretold number on it, set a Chronal Shift to roll it again if it goes
// the wrong way, or set Flash of Genius or Favored by the Gods to add to a
// save that fails, picking whose roll first when an area holds several; and
// everyone else sees why the table has paused.
export function WatchCard({
  campaignId,
  pending,
  sheets,
  meUserId,
  steersStory,
}: {
  campaignId: string;
  pending: PendingRoll;
  sheets: CharacterSheet[];
  meUserId: string;
  steersStory: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deadline = pending.watch ? new Date(pending.watch.deadline).getTime() : 0;
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  // Not a live region (it would speak every second): the watcher's buttons
  // name it as their description, so the time left is heard at each choice.
  const clockId = useId();
  const watcher = sheets.find((sheet) => sheet.id === pending.characterId);
  const power: Power = pending.watch?.power ?? "portent";
  const feature = t(FEATURE_KEYS[power] ?? "pending.watch.feature.portent");
  const choices = pending.watch?.choices ?? [];
  // Whose roll, when there is more than one to answer (an area's saves).
  const [picked, setPicked] = useState<number | null>(null);
  const asking = choices.length > 1;
  const pick = asking ? picked : 0;

  async function answer(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pending-rolls/${pending.id}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("pending.error.choice"));
      }
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  if (pending.userId !== meUserId) {
    return (
      <CheckFrame className="mb-2 flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <span className="min-w-0">
          {pending.reason} {watcher?.name ?? t("table.companion.aPlayer")} {t("pending.watch.otherDeciding", { feature })}.
        </span>
        {steersStory || left === 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer({ pass: true })}
            className={`${PLAIN} shrink-0`}
          >
            {t("pending.watch.goAhead")}
          </button>
        ) : null}
        {error ? <span role="alert" className="text-red-400">{error}</span> : null}
      </CheckFrame>
    );
  }

  const numbers = watcher ? [...new Set(foretoldLeft(watcher))] : [];
  const choice = asking && pick !== null ? { choice: pick } : {};
  const when = choices[pick ?? 0]?.when ?? "";
  return (
    <CheckFrame className="mb-2 animate-fade-up px-3 py-2.5">
      <p className="text-sm">{pending.reason}</p>
      {asking ? (
        <div role="radiogroup" aria-label={t("pending.watch.whoseAria")} className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs">{t("pending.watch.whoseLabel")}</span>
          {choices.map((entry, index) => (
            <button
              key={`${entry.name}:${index}`}
              type="button"
              role="radio"
              aria-checked={picked === index}
              disabled={busy}
              onClick={() => setPicked(index)}
              className={`${NUMBER} ${picked === index ? "bg-amber-500/25" : ""}`}
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : null}
      <div role="group" aria-label={power === "portent" ? t("pending.watch.groupAriaPortent") : t("pending.watch.groupAriaFeature", { feature })} className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs">{t("pending.watch.featureLabel", { feature })}</span>
        {power === "portent"
          ? numbers.map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy || pick === null}
                aria-describedby={clockId}
                onClick={() => void answer({ value, ...choice })}
                title={asking && pick !== null ? t("pending.watch.foretoldTitleNamed", { value, name: choices[pick].name }) : t("pending.watch.foretoldTitle")}
                className={NUMBER}
              >
                {t("pending.foretoldUse", { value })}
              </button>
            ))
          : (
              <button
                type="button"
                disabled={busy || pick === null}
                aria-describedby={clockId}
                onClick={() => void answer({ shift: true, ...choice })}
                title={
                  power === "flash_of_genius"
                    ? t("pending.watch.flashTitle")
                    : power === "favored_by_the_gods"
                      ? t("pending.watch.favoredTitle")
                      : t("pending.watch.shiftTitle")
                }
                className={NUMBER}
              >
                {power === "flash_of_genius" ? t("pending.watch.addMod", { mod: intModifier(watcher), when }) : power === "favored_by_the_gods" ? t("pending.watch.addDice", { when }) : t("pending.watch.rollAgain", { when })}
              </button>
            )}
        <button
          type="button"
          disabled={busy}
          aria-describedby={clockId}
          onClick={() => void answer({ pass: true })}
          className={PLAIN}
        >
          {t("pending.watch.letRoll")}
        </button>
        <span id={clockId} className="check-dim text-xs" aria-live="off"><span className="sr-only">{t("pending.watch.clockSr")}{" "}</span>{left}s</span>
      </div>
      {asking && picked === null ? <p className="check-dim mt-1 text-xs">{t("pending.watch.chooseWhose")}</p> : null}
      {error ? <p role="alert" className="mt-1.5 text-xs text-red-400">{error}</p> : null}
    </CheckFrame>
  );
}

// The button: only a character who holds a number, a Chronal Shift, Flash of
// Genius or Favored by the Gods, only in a fight.
export function WatchToggle({
  campaignId,
  sheet,
  encounterId,
}: {
  campaignId: string;
  sheet: CharacterSheet;
  encounterId: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = sheet.watchingEncounterId === encounterId;
  const power = watchFeatureOf(sheet) ?? "portent";
  const feature = t(FEATURE_KEYS[power]);
  const what = t(WATCH_FOR_KEYS[power]);

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/foresight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: !on, characterId: sheet.id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("pending.watch.errorToggle"));
      }
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        disabled={busy}
        onClick={() => void toggle()}
        title={on ? t("pending.watch.toggleTitleOn", { what }) : t("pending.watch.toggleTitleOff", { what })}
        className={`motion-press inline-flex min-h-10 items-center rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${RING} ${on ? "border-amber-400 bg-amber-500/20" : "border-amber-400/60"}`}
      >
        {on ? t("pending.watch.toggleOn", { feature }) : t("pending.watch.toggleOff", { feature })}
      </button>
      {error ? <span role="alert" className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
