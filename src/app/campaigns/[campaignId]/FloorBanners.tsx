"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { SessionBanner, bannerButtonClass } from "@/app/campaigns/[campaignId]/SessionBanner";
import type { Floor } from "@/lib/db/campaigns";
import type { PublicEncounter } from "@/lib/db/encounter-view";
import { extraTurnTagT, litOrderRows, orderRowKey } from "@/lib/battlemap/initiative-rows";
import { floorNoticeKey, liveNotice, type HandNotice } from "@/lib/battlemap/hand-table";
import { useT } from "@/lib/locale";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { TurnHoldNote, useTurnHeld } from "@/app/campaigns/[campaignId]/TurnHoldNote";

// Spotlight, held-responses, and initiative banners above the composer;
// the lead gets the release/skip buttons, the current player gets End turn.
export function FloorBanners({
  campaignId,
  floor,
  spotlighted,
  heldSpotlightNames,
  encounter,
  steersStory,
  meUserId = "",
  onRelease,
}: {
  campaignId: string;
  floor: Floor;
  spotlighted: CharacterSheet[];
  heldSpotlightNames: string[];
  encounter?: PublicEncounter | null;
  steersStory: boolean;
  meUserId?: string;
  onRelease: () => void;
}) {
  const [endingTurn, setEndingTurn] = useState(false);
  const t = useT();
  // The end-turn route's refusal, in its own words, under the banner, for
  // the turn it answered only (issue 668).
  const [refusalEntry, setRefusalEntry] = useState<HandNotice | null>(null);
  const refusalKey = floorNoticeKey(floor);
  const refusal = liveNotice(refusalEntry, refusalKey);
  const setRefusal = (text: string) => setRefusalEntry(text ? { text, key: refusalKey } : null);
  const myInitiativeTurn =
    floor.mode === "initiative" && meUserId !== "" && floor.userIds.includes(meUserId);
  // The End Turn is in and the move waits on a watcher's stop.
  const held = useTurnHeld(encounter);

  // Attacks no longer end the turn by themselves (movement and bonus
  // actions stay open), so this is the player's way to say "done".
  async function endTurn() {
    setEndingTurn(true);
    setRefusal("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/encounter/end-turn`, { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setRefusal(data.error ?? t("lead.floor.endFailed"));
      }
    } catch {
      setRefusal(t("table.wait.unreachable"));
    } finally {
      setEndingTurn(false);
    }
  }

  return (
    <>
      {floor.mode === "initiative" ? (
        <SessionBanner
          glyph="attitude-hostile"
          tone="blood"
          title={<>{t("cine.round", { round: floor.round })}</>}
          actions={
            myInitiativeTurn || steersStory ? (
              <>
                {myInitiativeTurn ? (
                  <button
                    type="button"
                    onClick={endTurn}
                    disabled={endingTurn || Boolean(held)}
                    aria-busy={held ? true : undefined}
                    className={bannerButtonClass(true)}
                    title={t("lead.floor.endTurnTitle")}
                  >
                    {held ? t("board.order.endingTurn") : t("board.order.endTurn")}
                  </button>
                ) : null}
                {steersStory ? (
                  <button
                    type="button"
                    onClick={onRelease}
                    className={bannerButtonClass()}
                    // Marks the banner as holding something only it offers
                    // (world.css keeps it over a docked Hand for this).
                    data-banner-lead=""
                    title={t("lead.floor.skipTurnTitle")}
                  >
                    {t("lead.floor.skipTurn")}
                  </button>
                ) : null}
              </>
            ) : null
          }
        >
          <span className="block truncate">
              {encounter?.orderReady && encounter.order.length ? (
                <>
                  {encounter.order.map((entry, index) => {
                    // A player's order leaves hidden combatants out, so the
                    // pointer's index can point past them; the engine names
                    // who it rests on. A thief's second round-1 turn is a
                    // second row with the same id (Thief's Reflexes).
                    const current = litOrderRows(encounter.order, encounter.turnIndex, encounter.acting, encounter.enemiesUp).includes(index);
                    return (
                      <span
                        key={orderRowKey(entry, index)}
                        title={extraTurnTagT(t, entry)?.title}
                        className={cn(
                          "transition-opacity duration-200",
                          current ? "font-semibold" : "opacity-60",
                        )}
                      >
                        {index > 0 ? " > " : ""}
                        {entry.name}
                        {entry.reflex ? <sup className="motion-pop ml-0.5 text-[9px] text-amber-300">{extraTurnTagT(t, entry)?.short}</sup> : null}
                      </span>
                    );
                  })}
                </>
              ) : (
                <>{t("table.hand.header.turn", { name: floor.currentName })}</>
              )}
          </span>
          {held ? <TurnHoldNote held={held} mine={myInitiativeTurn} className="mt-0.5" /> : null}
          {refusal ? (
            <span key={refusal} role="alert" className="mt-0.5 block animate-fade-up text-xs text-amber-200">
              {refusal}
            </span>
          ) : null}
        </SessionBanner>
      ) : null}
      {floor.mode === "spotlight" ? (
        <SessionBanner
          glyph="sense-truesight"
          title={floor.respondedUserIds.length ? t("lead.floor.spotlightWaiting") : t("dm.console.floor.status.spotlight")}
          lead={
            spotlighted.some((sheet) => sheet.portrait) ? (
              <span className="flex shrink-0 -space-x-2">
                {spotlighted
                  .filter((sheet) => sheet.portrait)
                  .slice(0, 4)
                  .map((sheet) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={sheet.id}
                      src={sheet.portrait!.url}
                      alt=""
                      className="size-8 rounded-full border border-amber-500/60 object-cover shadow-glow-gold"
                    />
                  ))}
              </span>
            ) : undefined
          }
          actions={
            steersStory ? (
              <button type="button" onClick={onRelease} className={bannerButtonClass(true)}>
                {t("lead.floor.release")}
              </button>
            ) : null
          }
        >
            <span>
              {spotlighted.length
                ? spotlighted.map((sheet, index) => {
                    const responded = floor.respondedUserIds.includes(sheet.userId);
                    return (
                      <span
                        key={sheet.id}
                        className={responded ? "opacity-50" : undefined}
                      >
                        {index > 0 ? ", " : ""}
                        {sheet.name}
                        {responded ? <Check className="inline size-3 align-baseline" /> : null}
                      </span>
                    );
                  })
                : t("cine.someone")}
              {floor.prompt ? (
                <span className="opacity-80"> · {floor.prompt}</span>
              ) : null}
            </span>
        </SessionBanner>
      ) : null}
      {floor.mode === "hold" && floor.next.mode === "initiative" && encounter?.enemyTurns ? (
        // A fight held for the enemies' turns (src/lib/dm/enemies-due.ts).
        // Reactions still go through. Held responses wrap the fight's floor
        // too, and keep their own banner below.
        <SessionBanner
          glyph="tab-battle"
          title={t("lead.floor.enemyTurns")}
          actions={
            steersStory ? (
              <button type="button" onClick={onRelease} className={bannerButtonClass(true)}>
                {t("lead.floor.handOn")}
              </button>
            ) : null
          }
        >
          <span>
            {t("lead.floor.enemyHoldNote", { name: floor.next.currentName || t("table.hand.monster.nextTurn") })}
          </span>
        </SessionBanner>
      ) : floor.mode === "hold" ? (
        <SessionBanner
          glyph="rest-inspiration"
          title={t("lead.floor.heldTitle")}
          actions={
            steersStory ? (
              <button type="button" onClick={onRelease} className={bannerButtonClass(true)}>
                {t("lead.floor.allow")}
              </button>
            ) : null
          }
        >
          <span>
            {t("lead.floor.heldNote")}
            {heldSpotlightNames.length ? (
              <span className="opacity-80">
                {" "}
                {t("lead.floor.heldNext", { names: heldSpotlightNames.join(", ") })}
              </span>
            ) : null}
          </span>
        </SessionBanner>
      ) : null}
    </>
  );
}
