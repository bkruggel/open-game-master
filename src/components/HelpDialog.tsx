"use client";

import Link from "next/link";
import {
  BookOpen,
  Brain,
  Bug,
  Compass,
  Footprints,
  Crown,
  Dices,
  DoorOpen,
  Gavel,
  MessageSquareText,
  Mic,
  Music,
  PanelRight,
  Puzzle,
  RefreshCw,
  Swords,
  Volume2,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { GameIcon } from "@/components/ui/GameIcon";
import { HelpContents, ModeRow, Section } from "@/components/HelpParts";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";

// HowToPlayDialog and WorkshopHelpDialog import these from here.
export { ModeRow, Section };

// One walkthrough of the whole app: menus, side-panel tabs, composer modes,
// asking the DM, fixing a bad narration, what the DM remembers, dice, voice,
// lead powers and world packs. Opened from the home account menu and the
// in-session header.
export function HelpDialog({
  open,
  onOpenChange,
  tours,
  section,
  report,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // A section to open at, by its title, for a control that has one.
  section?: string;
  // The table offers its guided tours from here; each runs once on its own
  // and can be replayed at will. Other pages pass nothing.
  tours?: { label: string; detail: string; onStart: () => void }[];
  // The table's "Report a problem" (issue #459): Help is where someone
  // looks when something broke. The server's admin saves a report file
  // from here (onSave) or Admin > Server log; everyone else is told to ask
  // whoever runs the server, who can check its setup first. Other pages
  // pass nothing.
  report?: { onSave?: () => void };
}) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("menu.help")}
      icon={<GameIcon icon={{ kind: "glyph", key: "tab-story" }} size="size-7" />}
      width="w-[min(94vw,44rem)]"
    >
      <HelpContents withTours={Boolean(tours?.length)} withReport={Boolean(report)} initialSection={section} />
      {tours && tours.length ? (
        <Section icon={Footprints} title={t("help.tours.heading")} id="Guided tours">
          <p>
            {t("help.tours.intro")}
          </p>
          <div className="flex flex-wrap gap-2">
            {tours.map((tour) => (
              <button
                key={tour.label}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  tour.onStart();
                }}
                className={ui.btnSmall}
                title={tour.detail}
              >
                <Footprints className="size-4" /> {tour.label}
              </button>
            ))}
          </div>
        </Section>
      ) : null}
      <Section icon={Compass} title={t("help.started.heading")} id="Getting started">
        <p>
          <span className="text-stone-300">{t("help.started.quickStart")}</span>
          {t("help.started.p1.a1")}
          <span className="text-stone-300">{t("help.started.newCampaign")}</span>
          {t("help.started.p1.a2")}
          <span className="text-stone-300">{t("help.started.solo")}</span>
          {t("help.started.p1.a3")}
          <span className="text-stone-300">{t("help.started.joinCode")}</span>
          {t("help.started.p1.a4")}
          <span className="text-stone-300">{t("help.started.joinLink")}</span>
          {t("help.started.p1.a5")}
        </p>
        <p>{t("help.started.p2")}</p>
        <p>
          {t("help.started.p3.a")}
          <span className="text-stone-300">{t("help.started.p3.span")}</span>
          {t("help.started.p3.b")}
        </p>
      </Section>

      <Section icon={DoorOpen} title={t("help.lobby.heading")} id="The lobby">
        <p>{t("help.lobby.p1")}</p>
      </Section>

      <Section icon={MessageSquareText} title={t("help.talking.heading")} id="Talking to the GM">
        <p>{t("help.talking.intro")}</p>
        <ModeRow label={t("help.talking.do.label")}>
          {t("help.talking.do.body")}
        </ModeRow>
        <ModeRow label={t("help.talking.say.label")}>
          {t("help.talking.say.body")}
        </ModeRow>
        <ModeRow label={t("help.talking.ooc.label")}>
          {t("help.talking.ooc.body")}
        </ModeRow>
        <ModeRow label={t("help.talking.direct.label")} lead>
          {t("help.talking.direct.body.a")}
          <span className="text-stone-300">{t("help.talking.direct.private")}</span>
          {t("help.talking.direct.body.b")}
        </ModeRow>
        <p>
          {t("help.talking.ask.a")}
          <span className="text-stone-300">{t("help.talking.ask.span1")}</span>
          {t("help.talking.ask.b")}
          <span className="text-stone-300">{t("help.talking.ask.span2")}</span>
          {t("help.talking.ask.c")}
          <span className="text-stone-300">{t("help.talking.ask.span3")}</span>
          {t("help.talking.ask.d")}
          <span className="text-stone-300">{t("help.talking.ask.span4")}</span>
          {t("help.talking.ask.e")}
        </p>
        <p>{t("help.talking.askNote")}</p>
        <p>{t("help.talking.spotlight")}</p>
      </Section>

      <Section icon={Swords} title={t("help.hand.heading")} id="Your hand in a fight">
        <p>{t("help.hand.p1")}</p>
        <p>
          {t("help.hand.p2.a")}
          <span className="text-stone-300">{t("help.hand.p2.span1")}</span>
          {t("help.hand.p2.b")}
          <span className="text-stone-300">{t("help.hand.p2.span2")}</span>
          {t("help.hand.p2.c")}
        </p>
        <p>{t("help.hand.p3")}</p>
      </Section>

      <Section icon={RefreshCw} title={t("help.fixes.heading")} id="When the GM gets it wrong">
        <p>{t("help.fixes.p1")}</p>
        <ul className="list-none space-y-1.5">
          <li>
            <span className="text-stone-300">{t("help.fixes.reroll.label")}</span>
            {t("help.fixes.reroll.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.fixes.takes.label")}</span>
            {t("help.fixes.takes.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.fixes.continue.label")}</span>
            {t("help.fixes.continue.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.fixes.edit.label")}</span>
            {t("help.fixes.edit.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.fixes.lore.label")}</span>
            {t("help.fixes.lore.body")}
          </li>
        </ul>
        <p>{t("help.fixes.p2")}</p>
        <p>
          {t("help.fixes.p3.a")}
          <span className="text-stone-300">{t("help.fixes.p3.span")}</span>
          {t("help.fixes.p3.b")}
        </p>
      </Section>

      {report ? (
        <Section icon={Bug} title={t("help.report.heading")} id="Report a problem">
          {report.onSave ? (
            <>
              <p>{t("help.report.save")}</p>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  report.onSave?.();
                }}
                className={ui.btnSmall}
                data-report-problem
              >
                <Bug className="size-4" /> {t("help.report.button")}
              </button>
            </>
          ) : (
            <p data-report-ask-host>
              {t("help.report.ask")}
            </p>
          )}
        </Section>
      ) : null}

      <Section icon={Brain} title={t("help.memory.heading")} id="What the GM remembers">
        <p>{t("help.memory.p1")}</p>
        <ul className="list-none space-y-1.5">
          <li>
            <span className="text-stone-300">{t("help.memory.remember.label")}</span>
            {t("help.memory.remember.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.memory.canon.label")}</span>
            {t("help.memory.canon.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.memory.facts.label")}</span>
            {t("help.memory.facts.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.memory.bonds.label")}</span>
            {t("help.memory.bonds.body")}
          </li>
        </ul>
        <p>{t("help.memory.p2")}</p>
      </Section>

      <Section icon={PanelRight} title={t("help.panel.heading")} id="The side panel">
        <ul className="list-none space-y-1.5">
          <li>
            <span className="text-stone-300">{t("help.panel.party.label")}</span>
            {t("help.panel.party.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.battle.label")}</span>
            {t("help.panel.battle.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.map.label")}</span>
            {t("help.panel.map.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.story.label")}</span>
            {t("help.panel.story.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.notes.label")}</span>
            {t("help.panel.notes.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.chat.label")}</span>
            {t("help.panel.chat.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.world.label")}</span>
            {t("help.panel.world.body.a")}
            <span className="text-stone-300">{t("help.panel.world.span")}</span>
            {t("help.panel.world.body.b")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.context.label")}</span>
            {t("help.panel.context.body")}
          </li>
          <li>
            <span className="text-stone-300">{t("help.panel.settings.label")}</span>
            {t("help.panel.settings.body")}
          </li>
        </ul>
        <p>
          {t("help.panel.layout.a")}
          <span className="text-stone-300">{t("help.panel.layout.span1")}</span>
          {t("help.panel.layout.b")}
          <span className="text-stone-300">{t("help.panel.layout.span2")}</span>
          {t("help.panel.layout.c")}
          <span className="text-stone-300">{t("help.panel.layout.span3")}</span>
          {t("help.panel.layout.d")}
          <span className="text-stone-300">{t("help.panel.layout.span4")}</span>
          {t("help.panel.layout.e")}
          <span className="text-stone-300">{t("help.panel.layout.span5")}</span>
          {t("help.panel.layout.f")}
        </p>
      </Section>

      <Section icon={Dices} title={t("help.dice.heading")} id="Dice">
        <p>
          {t("help.dice.p1.a")}
          <span className="text-stone-300">{t("help.dice.p1.span1")}</span>
          {t("help.dice.p1.b")}
          <span className="text-stone-300">{t("help.dice.p1.span2")}</span>
          {t("help.dice.p1.c")}
        </p>
        <p>
          {t("help.dice.p2.a")}
          <span className="text-stone-300">{t("help.dice.p2.span1")}</span>
          {t("help.dice.p2.b")}
          <span className="text-stone-300">{t("help.dice.p2.span2")}</span>
          {t("help.dice.p2.c")}
        </p>
      </Section>

      <Section icon={Volume2} title={t("help.voice.heading")} id="Voice and narration">
        <p>
          {t("help.voice.p1.a")}
          <span className="text-stone-300">{t("help.voice.p1.span1")}</span>
          {t("help.voice.p1.b")}
          <span className="text-stone-300">{t("help.voice.p1.span2")}</span>
          {t("help.voice.p1.c")}
          <span className="text-stone-300">{t("help.voice.p1.span3")}</span>
          {t("help.voice.p1.d")}
          <span className="text-stone-300">{t("help.voice.p1.span4")}</span>
          {t("help.voice.p1.e")}
        </p>
        <p>
          {t("help.voice.p2.a")}
          <span className="text-stone-300">{t("help.voice.p2.span1")}</span>
          {t("help.voice.p2.b")}
        </p>
      </Section>

      <Section icon={Mic} title={t("help.live.heading")} id="Live voice chat">
        <p>
          {t("help.live.p1.a")}
          <span className="text-stone-300">{t("help.live.p1.span1")}</span>
          {t("help.live.p1.b")}
          <span className="text-stone-300">{t("help.live.p1.span2")}</span>
          {t("help.live.p1.c")}
        </p>
        <p>
          {t("help.live.p2.a")}
          <span className="text-stone-300">{t("help.live.p2.span1")}</span>
          {t("help.live.p2.b")}
        </p>
      </Section>

      <Section icon={Music} title={t("help.ambience.heading")} id="Ambience and music">
        <p>{t("help.ambience.p1")}</p>
        <p>{t("help.ambience.p2")}</p>
        <p>{t("help.ambience.p3")}</p>
      </Section>

      <Section icon={Gavel} title={t("help.human.heading")} id="Playing with a human GM">
        <p>
          {t("help.human.p1.a")}
          <span className="text-stone-300">{t("help.human.p1.span1")}</span>
          {t("help.human.p1.b")}
        </p>
        <p>
          {t("help.human.p2.a")}
          <span className="text-stone-300">{t("help.human.p2.span1")}</span>
          {t("help.human.p2.b")}
          <span className="text-stone-300">{t("help.human.p2.span2")}</span>
          {t("help.human.p2.c")}
        </p>
        <p>
          {t("help.human.p3.a")}
          <span className="text-stone-300">{t("help.human.p3.span1")}</span>
          {t("help.human.p3.b")}
        </p>
      </Section>

      <Section icon={Crown} title={t("help.lead.heading")} id="Party lead">
        <p>{t("help.lead.p1")}</p>
        <p>{t("help.lead.p2")}</p>
        <p>{t("help.lead.p3")}</p>
        <p>{t("help.lead.p4")}</p>
      </Section>

      <Section icon={Puzzle} title={t("help.plugins.heading")} id="Campaign plugins">
        <p>
          {t("help.plugins.p1.a")}
          <span className="text-stone-300">{t("help.plugins.p1.span1")}</span>
          {t("help.plugins.p1.b")}
        </p>
        <p>{t("help.plugins.p2")}</p>
        <p>{t("help.plugins.p3")}</p>
      </Section>

      <Section icon={BookOpen} title={t("help.newbie.heading")} id="New to D&D?">
        <p>{t("help.newbie.p1")}</p>
        <p>
          {t("help.newbie.p2.a")}
          <Link href="/reference" className="text-amber-300 underline-offset-2 hover:underline">
            {t("help.newbie.p2.span1")}
          </Link>
          {t("help.newbie.p2.b")}
          <Link href="/rulebook" className="text-amber-300 underline-offset-2 hover:underline">
            {t("help.newbie.p2.span2")}
          </Link>
          {t("help.newbie.p2.c")}
        </p>
      </Section>

      <Section icon={BookOpen} title={t("help.about.heading")} id="About">
        <p>
          {t("help.about.p1.a")}
          <Link href="/licenses" className="text-amber-300 underline-offset-2 hover:underline">
            {t("help.about.p1.span1")}
          </Link>
          {t("help.about.p1.b")}
        </p>
      </Section>
    </Dialog>
  );
}
