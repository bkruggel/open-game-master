"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { GameIcon } from "@/components/ui/GameIcon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/cn";
import type { DefaultsState } from "@/app/create-campaign/useCampaignDefaults";
import { useT } from "@/lib/locale";

// The creator's half of personal campaign defaults
// (src/lib/campaign-defaults.ts): the bar on the first step that says what
// this campaign started from, the panel on the review step that saves it, and
// the manager both open. Saving is always a press of its own: creating a
// campaign never changes the defaults, and saving them never creates one.

export type StartFrom = "mine" | "app";

export type DefaultsActions = {
  state: DefaultsState;
  startFrom: StartFrom;
  // The saved defaults arrived after the person had begun, so none of them
  // were laid over what they typed.
  late: boolean;
  // What applying them left alone, and why.
  kept: string[];
  busy: boolean;
  message: { tone: "ok" | "error"; text: string } | null;
  onUseMine: () => void;
  onUseApp: () => void;
  onSave: () => void;
  onRemove: () => void;
  onManage: () => void;
};

// What the manager lists as saved alongside the defaults, as dictionary keys
// (the words live in en.ts and fr.ts).
const SAVED_GROUP_KEYS = [
  "creator.saved.group.seats",
  "creator.saved.group.world",
  "creator.saved.group.story",
  "creator.saved.group.character",
  "creator.saved.group.narration",
  "creator.saved.group.board",
  "creator.saved.group.allies",
  "creator.saved.group.players",
  "creator.saved.group.safety",
  "creator.saved.group.rules",
  "creator.saved.group.voice",
] as const;

const savedOn = (iso: string) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";
};

export function DefaultsBar({ actions }: { actions: DefaultsActions }) {
  const t = useT();
  const { state, startFrom, late, kept } = actions;
  // Nothing saved yet: one quiet line, since there is nothing to choose
  // between before the person has made a table worth keeping. Saving it
  // waits on the review step, and Manage stays a tap away.
  if (state.status === "none" && !kept.length) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500" role="status">
        <GameIcon icon={{ kind: "glyph", key: "ui-pin" }} size="size-4" className="shrink-0" />
        <span className="min-w-0 flex-1">{t("creator.defaults.noneShort")}</span>
        <button type="button" onClick={actions.onManage} className="cc-link">
          {t("creator.defaults.about")}
        </button>
      </p>
    );
  }
  const line =
    state.status === "loading"
      ? t("creator.defaults.loading")
      : state.status === "unavailable"
        ? t("creator.defaults.unavailable", { error: state.error })
        : state.status === "none"
          ? t("creator.defaults.noneLong")
          : late && startFrom === "app"
            ? t("creator.defaults.late")
            : startFrom === "mine"
              ? savedOn(state.defaults.savedAt)
                ? t("creator.defaults.mineDated", { date: savedOn(state.defaults.savedAt) })
                : t("creator.defaults.mine")
              : t("creator.defaults.appAvailable");
  return (
    <div className="cc-defaults" role="group" aria-label={t("creator.defaults.startingPoint")}>
      <GameIcon icon={{ kind: "glyph", key: "ui-pin" }} size="size-5" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="cc-eyebrow block">{t("creator.defaults.startingPoint")}</span>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-400" role="status">
          {line}
          {kept.length ? t("creator.defaults.kept", { list: kept.join("; ") }) : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {state.status === "saved" ? (
          <SegmentedControl<StartFrom>
            size="sm"
            label={t("creator.defaults.startFrom")}
            value={startFrom}
            onChange={(value) => (value === "mine" ? actions.onUseMine() : actions.onUseApp())}
            options={[
              { value: "mine", label: t("creator.defaults.mineLabel") },
              { value: "app", label: t("creator.defaults.appLabel") },
            ]}
          />
        ) : null}
        <button type="button" onClick={actions.onManage} className="cc-link">
          {t("creator.defaults.manage")}
        </button>
      </div>
    </div>
  );
}

export function DefaultsPanel({ actions }: { actions: DefaultsActions }) {
  const t = useT();
  const saved = actions.state.status === "saved";
  return (
    <div className="cc-field">
      <div className="cc-field-head">
        <span className="cc-eyebrow">{t("creator.defaults.usualTable")}</span>
        <span className="cc-note">{saved ? t("creator.defaults.hasSaved") : t("creator.defaults.nothingSaved")}</span>
      </div>
      <p className="text-xs leading-relaxed text-stone-400">{t("creator.defaults.panelBody")}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={actions.onSave} disabled={actions.busy || actions.state.status === "loading"} className={ui.btnSmall}>
          {actions.busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {saved ? t("creator.defaults.update") : t("creator.defaults.save")}
        </button>
        <button type="button" onClick={actions.onManage} className="cc-link">
          {t("creator.defaults.manageDefaults")}
        </button>
      </div>
      <DefaultsMessage actions={actions} />
    </div>
  );
}

function DefaultsMessage({ actions }: { actions: DefaultsActions }) {
  if (!actions.message) {
    return null;
  }
  return (
    <p role="status" className={cn("mt-2 text-xs", actions.message.tone === "error" ? "text-red-400" : "text-emerald-300")}>
      {actions.message.text}
    </p>
  );
}

export function DefaultsDialog({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: DefaultsActions;
}) {
  const [confirming, setConfirming] = useState(false);
  const t = useT();
  const { state } = actions;
  const saved = state.status === "saved";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setConfirming(false);
        onOpenChange(next);
      }}
      title={t("creator.defaults.dialogTitle")}
      width="w-[min(92vw,36rem)]"
    >
      <div className="space-y-3 text-sm">
        <p className="text-stone-400">{t("creator.defaults.dialogIntro")}</p>
        <div className="cc-field">
          <span className="cc-eyebrow mb-1.5 block">{t("creator.defaults.savedHeading")}</span>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-stone-300">
            {SAVED_GROUP_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-stone-500">{t("creator.defaults.neverSaved")}</p>
        <p className="text-xs text-stone-400" role="status">
          {state.status === "loading"
            ? t("creator.defaults.loading")
            : state.status === "unavailable"
              ? t("creator.defaults.dialogUnavailable", { error: state.error })
              : saved
                ? `${savedOn(state.defaults.savedAt) ? t("creator.defaults.youSavedOn", { date: savedOn(state.defaults.savedAt) }) : t("creator.defaults.youSaved")} ${actions.startFrom === "mine" ? t("creator.defaults.fromMine") : t("creator.defaults.fromApp")}`
                : t("creator.defaults.notSavedYet")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={actions.onSave} disabled={actions.busy || state.status === "loading"} className={ui.btnPrimary}>
            {actions.busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {saved ? t("creator.defaults.dialogUpdate") : t("creator.defaults.dialogSave")}
          </button>
          {saved ? (
            <button type="button" onClick={actions.onUseMine} className={ui.btnSmall}>
              {t("creator.defaults.startMine")}
            </button>
          ) : null}
          <button type="button" onClick={actions.onUseApp} className={ui.btnSmall}>
            {t("creator.defaults.startApp")}
          </button>
        </div>
        {saved ? (
          confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 p-2.5 text-xs text-stone-300">
              <span className="min-w-0 flex-1">{t("creator.defaults.confirmRemove")}</span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  actions.onRemove();
                }}
                className={cn(ui.btnSmall, "border-red-800/60 text-red-300 hover:text-red-200")}
              >
                {t("creator.defaults.remove")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={ui.btnSmall}>
                {t("creator.defaults.keepThem")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="cc-link text-red-300/80 hover:text-red-200">
              {t("creator.defaults.removeLink")}
            </button>
          )
        ) : null}
        <DefaultsMessage actions={actions} />
      </div>
    </Dialog>
  );
}
