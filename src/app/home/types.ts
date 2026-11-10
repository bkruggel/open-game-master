import type { CampaignSummary, HomeGlance } from "@/lib/campaign-types";
import { sessionWhenLocal } from "@/lib/dm/session-hold-logic";

// The words these helpers build live in the dictionaries (home.ago.*,
// home.seats.*, home.slot.*, ...); each takes the translator from the
// component that draws it, so a language switch rewords the title screen
// with everything else. Pure otherwise: no database, no model.

// What GET /api/campaigns hands the home screen: the summary row plus the
// name of the character this user plays there, or null when they have no
// sheet yet (a fresh lobby) or hold the DM seat instead, and the title
// screen's glance at the table (last narration, chapter, scene, faces).
// Local to the home screen because no other page lists campaigns with a
// "playing as".
export type HomeCampaign = CampaignSummary & { playingAs: string | null; glance?: HomeGlance };

// Copying prep out of a campaign follows story authority, exactly as
// /api/campaigns/[id]/clone demands: the seated DM if there is one, the party
// lead otherwise. Mirrored here only to decide whether to draw the button;
// the server decides whether it works.
export function steersStory(campaign: CampaignSummary, userId: string): boolean {
  return campaign.dmUserId
    ? campaign.dmUserId === userId || campaign.assistantDmUserId === userId
    : campaign.leadUserId === userId;
}

// Whether this user narrates the table rather than playing at it, which is
// why the hero has no "playing as" for them.
export function holdsDmSeat(campaign: CampaignSummary, userId: string): boolean {
  return campaign.dmUserId === userId || campaign.assistantDmUserId === userId;
}

// The table to put on the title screen: the most recently touched campaign
// that is still going. When every table has ended, the newest of those, so
// an account with only finished tales still opens on a painting rather than
// an empty stage; the title block says it is finished.
export function pickContinue(campaigns: HomeCampaign[]): HomeCampaign | null {
  let best: HomeCampaign | null = null;
  let lastEnded: HomeCampaign | null = null;
  for (const campaign of campaigns) {
    if (campaign.status === "ended") {
      if (!lastEnded || campaign.updatedAt > lastEnded.updatedAt) {
        lastEnded = campaign;
      }
      continue;
    }
    if (!best || campaign.updatedAt > best.updatedAt) {
      best = campaign;
    }
  }
  return best ?? lastEnded;
}

// "2 days ago" for the recap and the save slots. Coarse on purpose: a title
// screen is not a log.
export function agoLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  iso: string | null | undefined,
  now = Date.now(),
): string {
  if (!iso) {
    return "";
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return "";
  }
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 2) return t("home.ago.justNow");
  if (minutes < 60) return t("home.ago.minutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? t("home.ago.hour") : t("home.ago.hours", { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? t("home.ago.yesterday") : t("home.ago.days", { count: days });
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? t("home.ago.week") : t("home.ago.weeks", { count: weeks });
  const months = Math.round(days / 30);
  if (months < 12) return months <= 1 ? t("home.ago.month") : t("home.ago.months", { count: months });
  const years = Math.round(days / 365);
  return years <= 1 ? t("home.ago.year") : t("home.ago.years", { count: years });
}

// Roman numerals for chapter headings ("Chapter III"). Chapters are small
// integers; anything beyond the table's reach falls back to digits.
export function romanNumeral(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999) {
    return String(value);
  }
  const table: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = value;
  let out = "";
  for (const [num, glyph] of table) {
    while (rest >= num) {
      out += glyph;
      rest -= num;
    }
  }
  return out;
}

// One line under a table's name: who you are there and how full it is.
export function seatLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  campaign: HomeCampaign,
  userId: string,
): string {
  if (campaign.status === "lobby") {
    return t("home.seats.lobby", { count: campaign.playerCount, max: campaign.maxPlayers });
  }
  const party = campaign.maxPlayers === 1 ? t("home.seats.solo") : t("home.seats", { count: campaign.playerCount, max: campaign.maxPlayers });
  if (campaign.playingAs) {
    return t("home.seats.playingAs", { name: campaign.playingAs, party });
  }
  if (holdsDmSeat(campaign, userId)) {
    return t("home.seats.dm", { party });
  }
  return t("home.seats.noCharacter", { party });
}

// The chapter line: "Act II, Chapter III · The Drowned Lantern" (the act
// only once the arc has one), the act's name when the chapter has none yet,
// the scene after that, or the campaign's own description.
export function chapterLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  campaign: HomeCampaign,
): string {
  const chapter = campaign.glance?.chapter;
  const scene = (campaign as HomeCampaign & { scene?: string }).scene?.trim() || "";
  if (chapter) {
    const act = chapter.act ? `${t("home.chapter.act", { num: romanNumeral(chapter.act) })}, ` : "";
    const head = `${act}${t("home.chapter.head", { num: romanNumeral(chapter.index) })}`;
    const title = chapter.title.trim();
    if (title) return `${head} · ${title}`;
    const actTitle = chapter.actTitle?.trim() || "";
    if (actTitle) return `${head} · ${actTitle}`;
    if (scene) return `${head} · ${scene}`;
    return head;
  }
  if (scene) return scene;
  return campaign.description.trim();
}

// The slot's badge: where the table stands. A campaign in play between
// sessions (issue 586) says so, rather than "active" all week.
export function statusLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  campaign: HomeCampaign,
): string {
  if (campaign.status === "active" && campaign.glance?.session?.between) {
    return t("home.badge.between");
  }
  const key = `home.badge.${campaign.status}`;
  const word = t(key);
  return word === key ? campaign.status : word;
}

// When the table meets next, in the reader's own time: "Next session Fri,
// Nov 6, 7:00 PM". Empty when nothing is set, or from an older host.
export function nextSessionLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  campaign: HomeCampaign,
  locale?: string,
): string {
  const next = campaign.status === "ended" ? null : campaign.glance?.session?.next;
  const when = next ? sessionWhenLocal(next.startsAt, locale) : "";
  return when ? t("home.nextSession", { when }) : "";
}

// The save slot's one line: what state the table is in, in a few words.
export function slotLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  campaign: HomeCampaign,
  userId: string,
): string {
  if (campaign.status === "lobby") {
    return t("home.slot.ready", { count: campaign.playerCount, max: campaign.maxPlayers });
  }
  if (campaign.status === "ended") {
    const ago = agoLabel(t, campaign.updatedAt);
    return ago ? t("home.slot.finishedAgo", { ago }) : t("home.slot.finished");
  }
  const next = nextSessionLine(t, campaign);
  if (next) {
    return next;
  }
  if (campaign.glance?.session?.between) {
    return t("home.slot.between");
  }
  if (holdsDmSeat(campaign, userId)) {
    return t("home.slot.dm");
  }
  const ago = agoLabel(t, campaign.glance?.recapAt ?? campaign.updatedAt);
  return ago ? t("home.slot.lastPlayed", { ago }) : t("home.slot.inPlay");
}
