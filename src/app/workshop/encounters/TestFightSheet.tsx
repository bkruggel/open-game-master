"use client";

import { Loader2, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { GameIcon } from "@/components/ui/GameIcon";
import { Sheet } from "@/components/ui/Sheet";
import { PanelError } from "@/app/campaigns/[campaignId]/PanelKit";
import { classWordsAfterLevel, speciesName } from "@/lib/characters/class-words";
import { cn } from "@/lib/cn";
import { readLoad, readWrite } from "@/lib/load-state";
import { navigateTo } from "@/lib/navigation";
import { ui } from "@/lib/ui";
import { TARGET_PARTY_LIMITS } from "@/lib/workshop/kind";
import { TEST_ALLY_LIMIT } from "@/lib/workshop/test-seats-logic";
import { hostOffers, useCapabilities } from "@/lib/use-capabilities";
import type { PreparedEncounter } from "@/app/workshop/encounters/types";
import { useT } from "@/lib/locale";

// Test fight (issue 553): who fights the prepared fight, then the table
// (src/lib/workshop/test-fight.ts). Each question has a default that needs
// no answer. The stand-ins are the party the workshop is built for, so one
// press tests what every budget in the workshop was measured against; the
// other answer is the author's own characters, when the question is how
// their party fares. Where an AI DM is set up it runs the fight unless the
// author would rather run it, as they run their own tables; where none is,
// the author runs it and the sheet only says so.
//
// Allies (issue 685): a fight written around an ally is tested with that
// ally. The companions the author keeps are offered beside either party,
// marked as allies, and only to an author who keeps any; none is picked
// unless the author picks one.

export type TestFightInfo = {
  ready: boolean;
  reason: string;
  // Set when the server's "Who may start campaigns and workshops" keeps this
  // person from starting one; an older host leaves it out.
  refused?: string;
  standIns: { size: number; level: number; classes: string[] };
  open: { id: string; title: string; createdAt: string } | null;
};

type Character = {
  id: string;
  name: string;
  role: "pc" | "companion";
  race: string;
  class: string;
  level: number;
};

type Who = "stand-ins" | "characters";

// "Level 4 Variant Human Fighter", in the words the library's cards use: the
// ids themselves ("variant_human", "srd-2024-goliath") read as code here.
// The "Level {n}" head reads the reader's language (workshop.bestiary.spells.levelN).
function describe(character: Character, levelWord: string): string {
  return `${levelWord} ${[speciesName(character), classWordsAfterLevel(character)].filter(Boolean).join(" ")}`;
}

function listed(names: string[], and: string): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

// Whether the party picked is the one a fight's set-up was saved with
// (src/lib/workshop/fight-setup-logic.ts samePartyAsSetup, for the sheet).
function sameAsSetup(party: NonNullable<PreparedEncounter["setupParty"]>, who: Who, picked: string[], allies: string[]): boolean {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);
  if (!same(party.allyIds ?? [], allies)) return false;
  if (party.kind === "stand-ins") return who === "stand-ins";
  return who === "characters" && same(party.characterIds, picked);
}

const choiceCard =
  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-amber-400/40";

export function TestFightSheet({
  workshopId,
  encounter,
  info,
  onClose,
}: {
  workshopId: string;
  // The fight to test; null keeps the sheet shut.
  encounter: PreparedEncounter | null;
  info: TestFightInfo | null;
  onClose: () => void;
}) {
  const t = useT();
  const [whoChoice, setWho] = useState<Who | null>(null);
  const [runner, setRunner] = useState<"ai" | "person">("ai");
  const [pickedChoice, setPicked] = useState<string[] | null>(null);
  const [alliesChoice, setAllies] = useState<string[] | null>(null);
  // An older host drops the allies unread and starts the test without them
  // (capabilities.ts testFightAllies), so it is offered none.
  const allyOffer = hostOffers(useCapabilities(), "testFightAllies");
  const [pregens, setPregens] = useState<Character[] | null>(null);
  const [library, setLibrary] = useState<Character[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = encounter !== null;
  const setupParty = encounter?.setup?.length ? (encounter.setupParty ?? null) : null;
  // Until the author answers, a fight with a saved set-up offers the party
  // it was saved with, so the moment is the same moment (issue 685), and
  // any other fight the stand-ins. Another answer is one press away, and
  // says below what it costs.
  const who: Who = whoChoice ?? (setupParty?.kind === "characters" ? "characters" : "stand-ins");
  const picked = pickedChoice ?? (setupParty?.kind === "characters" ? setupParty.characterIds : []);
  const allies = alliesChoice ?? setupParty?.allyIds ?? [];

  // The characters are read when the sheet opens, the roster first: the
  // pregens are the ones made for this workshop. Heroes and allies are told
  // apart by the role each is filed under.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      readLoad<{ pregens?: Character[] }>(t, fetch(`/api/workshops/${workshopId}/pregens`), t("load.label.roster")),
      readLoad<{ characters?: Character[] }>(t, fetch("/api/characters"), t("load.label.characters")),
    ]).then(([roster, shelf]) => {
      if (cancelled) return;
      setLoadError(roster.error ?? shelf.error ?? "");
      setPregens(roster.payload?.pregens ?? []);
      setLibrary(shelf.payload?.characters ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [ open, workshopId, t ]);
  function close(next: boolean) {
    if (next) return;
    setError("");
    setBusy(false);
    // The next fight opened asks afresh, from its own default.
    setWho(null);
    setPicked(null);
    setAllies(null);
    onClose();
  }

  const toggled = (current: string[], id: string, on: boolean) =>
    on ? [...current.filter((entry) => entry !== id), id] : current.filter((entry) => entry !== id);
  function toggle(id: string, on: boolean) {
    setPicked(toggled(picked, id, on));
  }
  function toggleAlly(id: string, on: boolean) {
    setAllies(toggled(allies, id, on));
  }

  // Heroes fight in the party; companions (filed as allies the GM plays)
  // fight beside it, the workshop's own first.
  const hero = (character: Character) => character.role !== "companion";
  const pregenIds = new Set((pregens ?? []).map((character) => character.id));
  const heroPregens = (pregens ?? []).filter(hero);
  const others = (library ?? []).filter((character) => !pregenIds.has(character.id) && hero(character));
  const allyChoices = [...(pregens ?? []), ...(library ?? []).filter((character) => !pregenIds.has(character.id))].filter(
    (character) => !hero(character),
  );

  async function start() {
    if (!encounter) return;
    setBusy(true);
    setError("");
    const beside = allyOffer ? allies.filter((id) => allyChoices.some((character) => character.id === id)) : [];
    const allyPart = beside.length ? { allyIds: beside } : {};
    const sent = await readWrite<{ campaignId: string }>(t,
      fetch(`/api/workshops/${workshopId}/test-fight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: encounter.id,
          party: who === "stand-ins" ? { kind: "stand-ins", ...allyPart } : { kind: "characters", characterIds: picked, ...allyPart },
          runner: info?.ready ? runner : "person",
        }),
      }),
      t("load.write.testFight"),
    );
    if (sent.error !== null) {
      setError(
        sent.unanswered
          ? `${sent.error} ${t("table.misc.testFight.unansweredNote")}`
          : sent.error,
      );
      setBusy(false);
      return;
    }
    navigateTo(`/campaigns/${sent.payload.campaignId}`);
  }

  const full = picked.length >= TARGET_PARTY_LIMITS.size.max;
  const alliesFull = allies.length >= TEST_ALLY_LIMIT;
  const standIns = info?.standIns;
  const canStart = Boolean(info) && !info?.refused && !busy && (who === "stand-ins" || picked.length > 0);

  // One character to tick, a card the whole of which is its label. An ally
  // wears the word, so the two lists never read as one.
  const pickCard = (character: Character, ally: boolean) => {
    const on = (ally ? allies : picked).includes(character.id);
    return (
      <li key={character.id}>
        <label
          className={cn(choiceCard, on ? "border-amber-500/50 bg-amber-500/10" : "border-stone-800 bg-stone-950/40")}
          {...(ally ? { "data-test-ally": character.id } : { "data-test-pick": character.id })}
        >
          <input
            type="checkbox"
            checked={on}
            disabled={!on && (ally ? alliesFull : full)}
            onChange={(event) => (ally ? toggleAlly : toggle)(character.id, event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-amber-500"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 text-sm text-stone-100">
              {character.name}
              {ally ? (
                <span className="rounded-full border border-stone-600 px-1.5 text-[10px] uppercase tracking-[0.12em] text-amber-200">{t("table.misc.testFight.allyChip")}</span>
              ) : null}
            </span>
            <span className="block text-xs text-stone-400">{describe(character, t("workshop.bestiary.spells.levelN", { level: character.level }))}</span>
          </span>
        </label>
      </li>
    );
  };
  const checkbox = (character: Character) => pickCard(character, false);

  // One answer of a question, as a card the whole of which is its label.
  const radio = (group: string, checked: boolean, onSelect: () => void, title: string, hint: string) => (
    <label className={cn(choiceCard, checked ? "border-amber-500/50 bg-amber-500/10" : "border-stone-800 bg-stone-950/40")}>
      <input type="radio" name={group} checked={checked} onChange={onSelect} className="mt-0.5 size-4 shrink-0 accent-amber-500" />
      <span className="min-w-0">
        <span className="block text-sm text-stone-100">{title}</span>
        <span className="block text-xs text-stone-400">{hint}</span>
      </span>
    </label>
  );
  const legend = "mb-1.5 font-display text-xs uppercase tracking-[0.14em] text-amber-200/90";

  return (
    <Sheet open={open} onOpenChange={close} title={encounter ? t("table.misc.testFight.testTitle", { name: encounter.name }) : t("table.misc.testFight.title")} className="lg:w-[min(92vw,34rem)]">
      <div className="space-y-4" data-testid="test-fight-sheet">
        <p className="text-sm text-stone-300">
          {t("table.misc.testFight.intro")}
        </p>

        {encounter?.setup?.length ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-50" data-testid="test-fight-setup">
            <p className="font-display text-amber-200">{t("table.misc.testFight.opensOnSetup")}</p>
            <ul className="mt-1 space-y-0.5 text-stone-300">
              {encounter.setup.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {setupParty && !sameAsSetup(setupParty, who, picked, allies) ? (
              <p className="mt-1 text-amber-200/90">
                {t("table.misc.testFight.otherPartyNote")}
              </p>
            ) : null}
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className={legend}>{t("table.misc.testFight.whoTitle")}</legend>
          {radio(
            "test-fight-party",
            who === "stand-ins",
            () => setWho("stand-ins"),
            t("table.misc.testFight.standInsTitle"),
            standIns
              ? t("table.misc.testFight.standInsHint", { count: standIns.size, level: standIns.level, classes: listed(standIns.classes, t("table.misc.testFight.listAnd")) })
              : t("table.misc.testFight.standInsFallback"),
          )}
          {radio(
            "test-fight-party",
            who === "characters",
            () => setWho("characters"),
            t("table.misc.testFight.pickTitle"),
            t("table.misc.testFight.pickHint"),
          )}
        </fieldset>

        {who === "characters" ? (
          <div className="reveal space-y-3" aria-live="polite">
            {pregens === null || library === null ? (
              <p className="flex items-center gap-2 text-xs text-stone-400">
                <Loader2 className="size-3.5 animate-spin" /> {t("table.misc.testFight.reading")}
              </p>
            ) : heroPregens.length + others.length === 0 ? (
              <p className="text-xs text-stone-400">
                {t("table.misc.testFight.noHeroes")}
              </p>
            ) : (
              <>
                {heroPregens.length ? (
                  <section>
                    <h4 className="mb-1.5 text-xs text-stone-400">{t("table.misc.testFight.pregensHeading")}</h4>
                    <ul className="grid gap-1.5 sm:grid-cols-2">{heroPregens.map(checkbox)}</ul>
                  </section>
                ) : null}
                {others.length ? (
                  <section>
                    <h4 className="mb-1.5 text-xs text-stone-400">{t("table.misc.testFight.libraryHeading")}</h4>
                    <ul className="grid gap-1.5 sm:grid-cols-2">{others.map(checkbox)}</ul>
                  </section>
                ) : null}
                <p className="text-xs text-stone-500">
                  {picked.length
                    ? `${t("table.misc.testFight.pickedCount", { count: picked.length })}${full ? t("table.misc.testFight.pickedFull") : ""}.`
                    : t("table.misc.testFight.pickUpTo", { count: TARGET_PARTY_LIMITS.size.max })}
                </p>
              </>
            )}
            {loadError ? <PanelError>{loadError}</PanelError> : null}
          </div>
        ) : null}

        {/* Allies, beside either party: shown only to an author who keeps a
            companion, on a host that seats them (issue 685). */}
        {allyOffer && allyChoices.length ? (
          <fieldset className="reveal space-y-2" data-testid="test-fight-allies">
            <legend className={legend}>{t("table.misc.testFight.alliesTitle")}</legend>
            <p className="text-xs text-stone-400">
              {t("table.misc.testFight.alliesBlurb")}
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">{allyChoices.map((character) => pickCard(character, true))}</ul>
            <p className="text-xs text-stone-500">
              {allies.length
                ? `${t("table.misc.testFight.alliesCount", { count: allies.length })}${alliesFull ? t("table.misc.testFight.alliesFull") : ""}.`
                : t("table.misc.testFight.alliesNone", { count: TEST_ALLY_LIMIT })}
            </p>
          </fieldset>
        ) : null}

        {/* Who runs it is a question only where an AI DM could; with none,
            the author does, and the note says so. */}
        {info?.refused ? (
          <p className="flex items-start gap-2 rounded-lg border border-stone-700/60 bg-stone-950/40 px-3 py-2 text-xs text-stone-300" data-testid="test-fight-refused">
            <GameIcon icon={{ kind: "glyph", key: "ui-ai" }} size="size-5" className="shrink-0" />
            {info.refused}
          </p>
        ) : info?.ready ? (
          <fieldset className="space-y-2">
            <legend className={legend}>{t("table.misc.testFight.runnerTitle")}</legend>
            {radio(
              "test-fight-runner",
              runner === "ai",
              () => setRunner("ai"),
              t("table.misc.testFight.runnerAiTitle"),
              t("table.misc.testFight.runnerAiHint"),
            )}
            {radio(
              "test-fight-runner",
              runner === "person",
              () => setRunner("person"),
              t("table.misc.testFight.runnerYouTitle"),
              t("table.misc.testFight.runnerYouHint"),
            )}
          </fieldset>
        ) : info ? (
          <p className="flex items-start gap-2 rounded-lg border border-stone-700/60 bg-stone-950/40 px-3 py-2 text-xs text-stone-300" data-testid="test-fight-not-ready">
            <GameIcon icon={{ kind: "glyph", key: "ui-ai" }} size="size-5" className="shrink-0" />
            {info.reason}
          </p>
        ) : null}
        {info?.open ? (
          <p className="text-xs text-stone-400">{t("table.misc.testFight.openNote", { title: info.open.title })}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!canStart} aria-busy={busy} onClick={() => void start()} className={cn(ui.btnPrimary, "min-h-11")}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />}
            {busy ? t("table.misc.testFight.settingTable") : t("table.misc.testFight.startButton")}
          </button>
        </div>
        {error ? <PanelError>{error}</PanelError> : null}
      </div>
    </Sheet>
  );
}
