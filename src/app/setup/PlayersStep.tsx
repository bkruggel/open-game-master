"use client";

import { ui } from "@/lib/ui";
import { CopyLine } from "@/components/CopyLine";
import { AdminInvitesSection } from "@/app/admin/AdminInvitesSection";
import type { Draft } from "@/app/setup/draft";
import { ChoiceCard, ChoiceCards, Lamp } from "@/app/setup/SetupParts";
import { useT } from "@/lib/locale";

type Update = (change: (draft: Draft) => Draft) => void;

// How players reach the server and who may make an account there. The
// addresses are this machine's own (GET /api/admin/setup), so the admin
// copies a working link instead of working one out.
export function PlayersStep({
  draft,
  update,
  lanUrls,
}: {
  draft: Draft;
  update: Update;
  lanUrls: string[];
}) {
  const t = useT();
  const set = (patch: Partial<Draft>) => update((current) => ({ ...current, ...patch }));
  const internet = Boolean(draft.publicUrl.trim());
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-stone-200">{t("setup.players.where")}</h4>
        <div className="stagger space-y-2">
          {lanUrls.length ? (
            lanUrls.slice(0, 3).map((url) => (
              <div key={url} className="su-row flex-col items-stretch">
                <span className="flex items-center gap-2 text-xs text-stone-400">
                  <Lamp tone="ok" /> {t("setup.players.lan")}
                </span>
                <CopyLine text={url} label={t("setup.players.lanLabel")} />
              </div>
            ))
          ) : (
            <div className="su-row text-xs text-stone-400">
              <Lamp tone="off" /> {t("setup.players.noAddress")}
            </div>
          )}
          <div className="su-row flex-col items-stretch">
            <span className="flex items-center gap-2 text-xs text-stone-400">
              <Lamp tone={internet ? "ok" : "off"} /> {t("setup.players.internet")}
            </span>
            <input
              className={ui.input}
              value={draft.publicUrl}
              onChange={(event) => set({ publicUrl: event.target.value })}
              placeholder="https://dungeon.example.org"
              aria-label={t("setup.players.publicAria")}
            />
            <span className="text-[11px] leading-4 text-stone-500">
              {t("setup.players.publicHint")}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-stone-200">{t("setup.players.who")}</h4>
        <ChoiceCards label={t("setup.players.who")}>
          <ChoiceCard
            picked={draft.signupMode === "invite"}
            onPick={() => set({ signupMode: "invite" })}
            glyph="tab-handout"
            title={t("setup.players.invite")}
            sub={t("setup.players.inviteSub")}
            badge={internet ? { text: t("setup.players.recommended"), tone: "ready" } : null}
          />
          <ChoiceCard
            picked={draft.signupMode === "open"}
            onPick={() => set({ signupMode: "open" })}
            glyph="tab-characters"
            title={t("setup.players.open")}
            sub={t("setup.players.openSub")}
            badge={!internet ? { text: t("setup.players.fineAtHome"), tone: "ready" } : null}
          />
          <ChoiceCard
            picked={draft.signupMode === "closed"}
            onPick={() => set({ signupMode: "closed" })}
            glyph="tab-admin"
            title={t("setup.players.closed")}
            sub={t("setup.players.closedSub")}
          />
        </ChoiceCards>
        {draft.signupMode === "open" && internet ? (
          <p key="warn" className="reveal su-note">
            {t("setup.players.openWarn")}
          </p>
        ) : null}
        {draft.signupMode === "invite" ? (
          <div key="invites" className="reveal-height">
            <AdminInvitesSection />
          </div>
        ) : null}
        <p className="text-[11px] text-stone-500">
          {t("setup.players.roomCodeNote")}
        </p>
      </div>
    </div>
  );
}
