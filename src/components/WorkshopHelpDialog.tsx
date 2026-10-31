"use client";

import {
  BookOpen,
  CircleHelp,
  Copy,
  Footprints,
  Hammer,
  Share2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import { WORKSHOP_GUIDES } from "@/lib/tours/workshop-guide";
import { Dialog } from "@/components/ui/Dialog";
import { Section } from "@/components/HelpDialog";

// The workshop's own help. The main HelpDialog is written for a table
// mid-session; a workshop has no table, no transcript and no AI turns, so
// its help is its own read: the tours it can replay, a guide per tool (the
// open tool first and unfolded), and the short version of what a workshop
// is and how prep reaches a campaign. Opened from the shelf, the hub and
// every tool.

export type HelpTour = { label: string; detail: string; onStart: () => void };

export function WorkshopHelpDialog({
  open,
  onOpenChange,
  tours,
  system,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The tours this page can start; each closes the dialog first.
  tours?: HelpTour[];
  // The tool open right now, whose guide leads and starts unfolded.
  system?: string | null;
}) {
  const t = useT();
  const guides = [
    ...WORKSHOP_GUIDES.filter((guide) => guide.id === system),
    ...WORKSHOP_GUIDES.filter((guide) => guide.id !== system),
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("help.workshop.title")}
      icon={<CircleHelp className="size-5 text-amber-500/80" />}
      width="w-[min(94vw,44rem)]"
    >
      {tours && tours.length ? (
        <Section icon={Footprints} title={t("help.workshop.tours.heading")} id="Guided tours">
          <p>
            {t("help.workshop.tours.intro")}
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
      <Section icon={Wrench} title={t("help.workshop.tools.heading")} id="The tools, one by one">
        <p>
          {t("help.workshop.tools.intro")}
          {system ? t("help.workshop.tools.introOpen") : ""}
        </p>
        <div className="space-y-1.5">
          {guides.map((guide) => (
            <details
              key={guide.id}
              open={guide.id === system}
              className="group rounded-lg border border-stone-800 bg-stone-950/50"
            >
              <summary
                className={cn(
                  "cursor-pointer list-none px-3 py-2 font-display text-sm tracking-wide text-amber-100 marker:content-none",
                  "flex items-baseline gap-2",
                )}
              >
                <span>{guide.title}</span>
                <span className="text-xs font-normal normal-case tracking-normal text-stone-500">
                  {guide.purpose}
                </span>
              </summary>
              <div className="space-y-2 border-t border-stone-800/70 px-3 py-2">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-300">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="text-sm text-stone-300">
                  <span className="text-amber-200/90">{t("help.workshop.atTable")}</span> {guide.atTable}
                </p>
                {guide.tips.length ? (
                  <ul className="reveal space-y-1 text-xs text-stone-500">
                    {guide.tips.map((tip) => (
                      <li key={tip} className="flex gap-1.5">
                        <span className="text-amber-500/70">&#8226;</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </Section>
      <Section icon={Hammer} title={t("help.workshop.what.heading")} id="What a workshop is">
        <p>{t("help.workshop.what.body")}</p>
      </Section>
      <Section icon={Share2} title={t("help.workshop.inOut.heading")} id="Into a campaign, and back out">
        <p>
          {t("help.workshop.inOut.body.a")}
          <span className="text-stone-300">{t("help.workshop.inOut.span1")}</span>
          {t("help.workshop.inOut.body.b")}
          <span className="text-stone-300">{t("help.workshop.inOut.span2")}</span>
          {t("help.workshop.inOut.body.c")}
        </p>
      </Section>
      <Section icon={Copy} title={t("help.workshop.copying.heading")} id="Copying things">
        <p>{t("help.workshop.copying.body")}</p>
      </Section>
      <Section icon={Sparkles} title={t("help.workshop.ai.heading")} id="With or without AI">
        <p>
          {t("help.workshop.ai.body.a")}
          <span className="text-stone-300">{t("help.workshop.ai.span1")}</span>
          {t("help.workshop.ai.body.b")}
          <span className="text-stone-300">{t("help.workshop.ai.span2")}</span>
          {t("help.workshop.ai.body.c")}
        </p>
      </Section>
      <Section icon={BookOpen} title={t("help.workshop.rules.heading")} id="Where the rules live">
        <p>{t("help.workshop.rules.body")}</p>
      </Section>
    </Dialog>
  );
}
