"use client";

import { Switch } from "@/components/ui/Switch";
import { useState } from "react";
import { Wizard } from "@/components/ui/Wizard";
import type { WorldPackDraft } from "@/lib/worlds/draft";
import { NameFields, OriginFields, VoiceFields, WorldFields } from "@/app/workshop/plugin/IdentityFields";
import { useT } from "@/lib/locale";

// Guided setup: the identity of a world pack, one question at a time. The
// steps are the same four field groups the Identity tab shows together; the
// wizard only orders them and asks the last question, whether to pull the
// workshop's own lore into the pack before the person starts on the tables.
//
// The draft edits land as they are typed (the panel autosaves them), so
// closing the wizard halfway loses nothing and the Identity tab shows
// exactly where the person stopped.

export function PluginWizard({
  draft,
  onDraft,
  onDone,
  onCancel,
}: {
  draft: WorldPackDraft;
  onDraft: (next: WorldPackDraft) => void;
  onDone: (pull: boolean) => void;
  onCancel: () => void;
}) {
  const [pull, setPull] = useState(true);
  const t = useT();
  const props = { draft, onDraft };
  return (
    <Wizard
      title={t("workshop.plugin.wizard.title")}
      doneLabel={t("workshop.plugin.wizard.doneLabel")}
      onDone={() => onDone(pull)}
      onCancel={onCancel}
      // Room for the sheet's X, which floats over the header's step count
      // (the same clearance CreateCampaignDialog and SetupWizard give it).
      className="[&>header]:pr-9"
      steps={[
        {
          key: "name",
          title: t("workshop.plugin.wizard.nameTitle"),
          blurb: t("workshop.plugin.wizard.nameBlurb"),
          content: <NameFields {...props} />,
          canContinue: Boolean(draft.name.trim() && draft.blurb.trim()),
        },
        {
          key: "origins",
          title: t("workshop.plugin.whoseWorld"),
          blurb: t("workshop.plugin.wizard.originsBlurb"),
          content: <OriginFields {...props} />,
          canContinue: Boolean(draft.inspiredBy.trim()),
        },
        {
          key: "world",
          title: t("workshop.plugin.kindOfWorld"),
          blurb: t("workshop.plugin.wizard.worldBlurb"),
          content: <WorldFields {...props} />,
          canContinue: Boolean(draft.theme.trim()),
        },
        {
          key: "voice",
          title: t("workshop.plugin.wizard.voiceTitle"),
          blurb: t("workshop.plugin.wizard.voiceBlurb"),
          content: <VoiceFields {...props} />,
        },
        {
          key: "fill",
          title: t("workshop.plugin.wizard.fillTitle"),
          blurb: t("workshop.plugin.wizard.fillBlurb"),
          content: (
            <div className="panel flex items-start gap-3 rounded-lg p-3 text-sm text-stone-300">
              <Switch on={pull} onChange={setPull} label={t("workshop.plugin.wizard.pullNow")} className="mt-0.5" />
              <span>
                {t("workshop.plugin.wizard.pullNow")}{" "}
                <span className="mt-1 block text-[11px] text-stone-500">
                  {t("workshop.plugin.wizard.pullAdds")}
                </span>
              </span>
            </div>
          ),
        },
      ]}
    />
  );
}
