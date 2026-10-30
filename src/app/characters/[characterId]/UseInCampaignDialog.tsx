"use client";

import { LoadFailed } from "@/app/campaigns/[campaignId]/PanelKit";
import { readLoad, useLoadStatus } from "@/lib/load-state";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { GameIcon } from "@/components/ui/GameIcon";
import { navigateTo } from "@/lib/navigation";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";

// The detail page's one primary action (docs/visual-overhaul-plan.md 8c.2):
// take this library character to a table. It lists the campaigns the player
// belongs to and sends the same request the campaign's own "pick from your
// library" page sends, so the campaign's multi-character setting and the
// server's lobby/gameplay rules are the ones that answer.
// An ally the DM plays goes through the companion door instead (POST
// /companions/create, the request the party panel's "Build a companion,
// From your library" sends), so it arrives bot-owned with the DM's turns,
// and the table's companion setting, cap and story authority answer
// (issue 192).

type CampaignRow = {
  id: string;
  title: string;
  status?: string;
  kind?: string;
  isWorkshop?: boolean;
  // The level every character plays at on this table.
  startingLevel?: number;
};

export function UseInCampaignDialog({
  characterId,
  characterName,
  characterLevel,
  role = "pc",
  seatedIn,
  onClose,
}: {
  characterId: string;
  characterName: string;
  characterLevel?: number;
  // A character somebody plays, or an ally the DM plays.
  role?: "pc" | "companion";
  // Campaign ids that already hold a copy of this character.
  seatedIn: string[];
  onClose: () => void;
}) {
  const companion = role === "companion";
  const t = useT();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  // A refused or failed read is shown in the server's words with a way to
  // ask again, never as "nothing here yet" (issue 140).
  const { loadError, settle } = useLoadStatus();
  const [reloads, setReloads] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState<{ campaignId: string; text: string; taken: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    readLoad<{ campaigns?: CampaignRow[] }>(fetch("/api/campaigns"), t("characters.use.loadLabel")).then((outcome) => {
      if (cancelled) return;
      settle(outcome);
      if (outcome.payload) {
        const rows: CampaignRow[] = outcome.payload.campaigns ?? [];
        setCampaigns(
          rows.filter((row) => row.status !== "ended" && row.kind !== "workshop" && !row.isWorkshop),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reloads, settle, t]);

  async function seat(campaign: CampaignRow) {
    setBusyId(campaign.id);
    setError(null);
    try {
      const door = companion ? "companions/create" : "sheet";
      const response = await fetch(`/api/campaigns/${campaign.id}/${door}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryCharacterId: characterId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError({
          campaignId: campaign.id,
          text: data.error || t("characters.use.seatFailed"),
          // A seat already taken has a lobby to swap in; a companion refusal
          // (authority, the table's setting, its cap) has not.
          taken: !companion && response.status === 409,
        });
        return;
      }
      navigateTo(`/campaigns/${campaign.id}`);
    } catch {
      setError({ campaignId: campaign.id, text: t("characters.use.unreachable"), taken: false });
    } finally {
      setBusyId("");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={companion ? t("characters.use.titleAlly", { name: characterName }) : t("characters.use.titlePc", { name: characterName })}
      icon={<GameIcon icon={{ kind: "glyph", key: "tab-campaigns" }} size="size-7" />}
      width="w-[min(92vw,30rem)]"
    >
      <p className="mb-3 text-xs leading-5 text-stone-400">
        {companion ? t("characters.use.allyBody") : t("characters.use.pcBody")}
      </p>
      {campaigns === null && loadError ? (
        <LoadFailed error={loadError} onRetry={() => setReloads((current) => current + 1)} />
      ) : campaigns === null ? (
        <div className="skeleton-block h-24 rounded-xl" aria-label={t("characters.use.loadingAria")} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          art="map"
          size="sm"
          title={t("characters.use.emptyTitle")}
          hint={t("characters.use.emptyHint")}
          action={
            <Link href="/" className={ui.btnSecondary}>
              {t("characters.use.toCampaigns")}
            </Link>
          }
        />
      ) : (
        <ul className="stagger space-y-2">
          {campaigns.map((campaign) => {
            const seated = seatedIn.includes(campaign.id);
            return (
              <li key={campaign.id} className="plate-row">
                <GameIcon icon={{ kind: "glyph", key: "tab-campaigns" }} size="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm tracking-wide text-amber-100">{campaign.title}</span>
                  <span className="block text-[11px] text-stone-500">
                    {seated ? t("characters.use.seated") : campaign.status === "lobby" ? t("characters.use.inLobby") : t("characters.use.inPlay")}
                    {campaign.startingLevel ? t("characters.use.playsAtLevel", { level: campaign.startingLevel }) : ""}
                  </span>
                  {!seated &&
                  characterLevel !== undefined &&
                  campaign.startingLevel &&
                  campaign.startingLevel !== characterLevel ? (
                    <span className="block text-[11px] text-amber-300">
                      {t("characters.use.joinsAsLevel", { name: characterName, level: campaign.startingLevel, own: characterLevel })}
                      {campaign.startingLevel < characterLevel
                        ? t("characters.use.belowTail")
                        : t("characters.use.aboveTail")}
                    </span>
                  ) : null}
                </span>
                {seated ? (
                  <Link href={`/campaigns/${campaign.id}`} className={ui.btnSmall}>
                    {t("characters.use.open")}
                  </Link>
                ) : (
                  <button type="button" disabled={Boolean(busyId)} onClick={() => void seat(campaign)} className={ui.btnSmall}>
                    {busyId === campaign.id ? <Loader2 className="size-3.5 animate-spin" /> : null} {companion ? t("characters.use.joinParty") : t("characters.use.takeSeat")}
                  </button>
                )}
                {error?.campaignId === campaign.id ? (
                  <p role="alert" className="motion-shake w-full text-xs text-red-400">
                    {error.text}{" "}
                    {error.taken ? (
                      <Link href={`/campaigns/${campaign.id}/character?mode=replace`} className="text-amber-200 underline underline-offset-2">
                        {t("characters.use.swap")}
                      </Link>
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
