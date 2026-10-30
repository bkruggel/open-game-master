"use client";

import {
  CircleHelp,
  Compass,
  Dices,
  Hourglass,
  MessageSquareText,
  RefreshCw,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { ModeRow, Section } from "@/components/HelpDialog";
import { useT } from "@/lib/locale";

// Onboarding read for newcomers: what the app is, how to get a table running,
// who does the maths, and the table etiquette that follows from coalesced DM
// turns. HelpDialog stays the button-by-button reference.
export function HowToPlayDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("home.howToPlay")}
      icon={<ScrollText className="size-5 text-amber-500/80" />}
      width="w-[min(94vw,44rem)]"
    >
      <Section icon={Sparkles} title={t("help.howToPlay.what.title")}>
        <p>
          {t("help.howToPlay.what.p1")}
        </p>
        <p>
          {t("help.howToPlay.what.p2")}
        </p>
      </Section>

      <Section icon={Compass} title={t("help.howToPlay.started.title")}>
        <p>
          <span className="text-stone-300">{t("help.howToPlay.started.p1Span")}</span>
          {t("help.howToPlay.started.p1After")}
        </p>
        <p>
          <span className="text-stone-300">{t("help.howToPlay.started.p2Span")}</span>
          {t("help.howToPlay.started.p2Mid")}
          {t("home.menu.join")}
          {t("help.howToPlay.started.p2Tail")}
        </p>
        <p>
          {t("help.howToPlay.started.p3")}
        </p>
      </Section>

      <Section icon={Dices} title={t("help.howToPlay.run.title")}>
        <p>
          {t("help.howToPlay.run.p1")}
        </p>
        <p>
          {t("help.howToPlay.run.p2")}
        </p>
      </Section>

      <Section icon={MessageSquareText} title={t("help.howToPlay.turn.title")}>
        <p>{t("help.howToPlay.turn.intro")}</p>
        <ModeRow label={t("table.composer.mode.do")}>
          {t("help.howToPlay.turn.do")}
        </ModeRow>
        <ModeRow label={t("table.composer.mode.say")}>{t("help.howToPlay.turn.say")}</ModeRow>
        <ModeRow label={t("table.composer.mode.ooc")}>
          {t("help.howToPlay.turn.ooc")}
        </ModeRow>
        <p>
          {t("help.howToPlay.turn.askBefore")}
          <span className="text-stone-300">{t("table.ask.eyebrow")}</span>
          {t("help.howToPlay.turn.askAfter")}
        </p>
      </Section>

      <Section icon={Hourglass} title={t("help.howToPlay.wait.title")}>
        <p>
          {t("help.howToPlay.wait.p1")}
        </p>
        <p>
          {t("help.howToPlay.wait.p2Before")}
          <span className="text-stone-300">
            {t("help.howToPlay.wait.p2Span")}
          </span>
          {t("help.howToPlay.wait.p2After")}
        </p>
        <p>
          {t("help.howToPlay.wait.p3")}
        </p>
      </Section>

      <Section icon={RefreshCw} title={t("help.howToPlay.re.title")}>
        <p>
          {t("help.howToPlay.re.p1Before")}
          <span className="text-stone-300">{t("help.howToPlay.re.reroll")}</span>
          {t("help.howToPlay.re.p1Mid")}
          <span className="text-stone-300">{t("help.howToPlay.re.continue")}</span>
          {t("help.howToPlay.re.p1After")}
        </p>
        <p>
          {t("help.howToPlay.re.p2")}
        </p>
      </Section>

      <Section icon={CircleHelp} title={t("help.howToPlay.stuck.title")}>
        <p>
          {t("help.howToPlay.stuck.p1")}
        </p>
      </Section>
    </Dialog>
  );
}
