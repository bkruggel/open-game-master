// The lobby's one line about what happens next for this viewer (F06 of
// docs/app-usability-audit-2026-10-16.md): choose a hero, ready up, wait for
// named people, or begin. Read from the same seats and blocker the Begin
// button uses (lobbyBlocker in viewer.ts), so it never disagrees with it.
// Pure, for scripts/test-lobby-next.mjs.

export type LobbyNextInput = {
  solo: boolean;
  // The viewer sits in a DM seat and plays no character.
  isDm: boolean;
  hasSheet: boolean;
  ready: boolean;
  // Owner or the person in the DM seat: who may press Begin.
  canStart: boolean;
  // lobbyBlocker's answer: "" when the adventure can open.
  blocker: string;
  // The other players, by name, who still need a hero or to ready up.
  needHero: string[];
  notReady: string[];
};

export type LobbyNext = { text: string; tone: "do" | "wait" | "go" };

// The caller binds the language: the lobby passes its own translator, the
// tests an English-bound one (see scripts/test-lobby-next.mjs).
type Translate = (key: string, vars?: Record<string, string | number>) => string;

// The waited-on players as prose: "Ada", "Ada and Bram", "Ada, Bram and 1
// more" (namedTwo and namedMore, the hero routes' joinery).
function names(t: Translate, list: string[]): string {
  if (list.length <= 1) {
    return list.join("");
  }
  if (list.length === 2) {
    return t("table.hero.namedTwo", { first: list[0], second: list[1] });
  }
  return t("table.hero.namedMore", { first: list[0], second: list[1], count: list.length - 2 });
}

export function lobbyNext(t: Translate, input: LobbyNextInput): LobbyNext {
  if (input.solo) {
    return input.hasSheet
      ? { text: t("table.lobby.next.soloReady"), tone: "go" }
      : { text: t("table.lobby.next.soloHero"), tone: "do" };
  }
  if (!input.isDm && !input.hasSheet) {
    return { text: t("table.lobby.next.hero"), tone: "do" };
  }
  if (!input.ready) {
    return input.isDm
      ? { text: t("table.lobby.next.dmReady"), tone: "do" }
      : { text: t("table.lobby.next.ready"), tone: "do" };
  }
  if (input.blocker) {
    if (input.needHero.length) {
      return {
        text: t("table.lobby.next.waitingHero", { names: names(t, input.needHero), count: input.needHero.length }),
        tone: "wait",
      };
    }
    if (input.notReady.length) {
      return {
        text: t("table.lobby.next.waitingReady", { names: names(t, input.notReady), count: input.notReady.length }),
        tone: "wait",
      };
    }
    return { text: input.blocker, tone: "wait" };
  }
  return input.canStart
    ? { text: t("table.lobby.next.go"), tone: "go" }
    : { text: t("table.lobby.next.goWait"), tone: "wait" };
}
