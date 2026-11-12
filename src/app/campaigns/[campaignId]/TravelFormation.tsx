"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { SectionHead } from "@/components/ui/SectionHead";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";
import { formationView, type FormationChange } from "@/lib/dm/formation-logic";
import type { PartyState } from "@/lib/dm/party-logic";
import { replayAnimation } from "@/lib/motion/replay";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { ui } from "@/lib/ui";

// The party's travel formation (issue 230), for every seat: the order in
// force, who is not placed yet, and a change waiting on answers. The party
// lead (or the DM seat at a table a person runs) arranges it; a player whose
// character a change moves agrees or asks for a change, for each of their
// characters. The DM reads the same record on every turn.
export function TravelFormation({
  campaignId,
  sheets,
  party,
  meUserId,
  arranges,
}: {
  campaignId: string;
  // The characters the formation arranges: those in play, companions too.
  sheets: CharacterSheet[];
  party: Pick<PartyState, "marchingOrder" | "formationChange"> | undefined;
  meUserId: string;
  arranges: boolean;
}) {
  const [editing, setEditing] = useState<string[] | null>(null);
  const [moved, setMoved] = useState<{ id: string; seq: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [asking, setAsking] = useState<{ id: string; note: string } | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const t = useT();
  const partyIds = sheets.map((sheet) => sheet.id);
  const order = party?.marchingOrder ?? [];
  const change: FormationChange | null = party?.formationChange ?? null;
  const { placed, unplaced } = formationView(order, partyIds);
  const byId = new Map(sheets.map((sheet) => [sheet.id, sheet]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "someone";

  if (sheets.length < 2) {
    return null;
  }

  const say = (text: string) => {
    setNotice(text);
    replayAnimation(noticeRef.current, "shake-x var(--dur-beat) var(--ease-snap) both");
  };
  async function send(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/party/formation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        say(data.error || t("table.formation.changeFailed"));
        return false;
      }
      return true;
    } catch {
      say(t("table.unreachable"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Where a character stands, said for a list read aloud as much as seen.
  const rankWord = (index: number, length: number) =>
    length < 2 ? "" : index === 0 ? t("table.formation.rankFront") : index === length - 1 ? t("table.formation.rankRear") : t("table.formation.rankMiddle");
  const who = (id: string) => {
    const sheet = byId.get(id);
    return sheet?.isCompanion ? t("table.formation.allyGm") : sheet?.userId === meUserId ? t("table.formation.yours") : "";
  };

  const list = (ids: string[], tone: "active" | "proposed") => (
    <ol className="flex flex-col gap-1">
      {ids.map((id, index) => (
        <li
          key={`${id}:${moved?.id === id ? moved.seq : 0}`}
          className="formation-row flex min-h-9 items-center gap-2 rounded-lg border px-2 py-1"
          data-tone={tone}
          data-moved={moved?.id === id ? "true" : undefined}
          style={{ "--i": index } as CSSProperties}
        >
          <span className="formation-rank font-mono text-[11px] text-amber-200/90">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-stone-100">{nameOf(id)}</span>
          {who(id) ? <span className="shrink-0 text-[10px] text-stone-500">{who(id)}</span> : null}
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-stone-400">{rankWord(index, ids.length)}</span>
        </li>
      ))}
    </ol>
  );

  // The answers a change is waiting on, and the buttons a player answers
  // with for each of their own characters it moves.
  const answers = (pending: FormationChange) => (
    <ul className="mt-2 flex flex-col gap-1.5">
      {pending.affected.map((id) => {
        const answer = pending.answers[id];
        const mine = byId.get(id)?.userId === meUserId;
        return (
          <li key={id} className="text-xs">
            <span className="text-stone-200">{nameOf(id)}</span>{" "}
            <span
              className={cn(
                "formation-answer rounded-full border px-1.5 py-px text-[10px] uppercase tracking-wider",
                answer?.answer === "agree"
                  ? "border-emerald-400/50 text-emerald-200"
                  : answer?.answer === "change"
                    ? "border-amber-400/60 text-amber-200"
                    : "border-stone-600 text-stone-400",
              )}
            >
              {answer?.answer === "agree" ? t("table.formation.answerAgreed") : answer?.answer === "change" ? t("table.formation.answerChange") : t("table.formation.answerWaiting")}
            </span>
            {answer?.note ? <span className="ml-1 italic text-stone-300">&ldquo;{answer.note}&rdquo;</span> : null}
            {mine ? (
              asking?.id === id ? (
                <span className="mt-1.5 flex flex-col gap-1.5">
                  <textarea
                    value={asking.note}
                    onChange={(event) => setAsking({ id, note: event.target.value.slice(0, 160) })}
                    maxLength={160}
                    rows={2}
                    aria-label={t("table.formation.noteAria", { name: nameOf(id) })}
                    placeholder={t("table.formation.notePlaceholder")}
                    className={cn(ui.input, "text-xs")}
                  />
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(ui.btnSmall, "text-xs")}
                      onClick={async () => {
                        if (await send({ do: "answer", characterId: id, answer: "change", note: asking.note })) setAsking(null);
                      }}
                    >
                      {t("table.formation.send")}
                    </button>
                    <button type="button" className={cn(ui.btnSmall, "text-xs")} onClick={() => setAsking(null)}>
                      {t("table.formation.cancel")}
                    </button>
                  </span>
                </span>
              ) : (
                <span className="mt-1 flex gap-1.5">
                  <button
                    type="button"
                    disabled={busy || answer?.answer === "agree"}
                    className={cn(ui.btnSmall, "text-xs")}
                    onClick={() => void send({ do: "answer", characterId: id, answer: "agree" })}
                  >
                    {t("table.formation.agree")}
                  </button>
                  <button type="button" disabled={busy} className={cn(ui.btnSmall, "text-xs")} onClick={() => setAsking({ id, note: "" })}>
                    {t("table.formation.askChange")}
                  </button>
                </span>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  // ---- the lead's editor ----

  const draft = editing ?? [];
  const left = partyIds.filter((id) => !draft.includes(id));
  const step = (id: string, direction: -1 | 1) => {
    const index = draft.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setEditing(next);
    setMoved((current) => ({ id, seq: (current?.seq ?? 0) + 1 }));
  };
  async function save(mode: "set" | "propose") {
    if (!draft.length) {
      say(t("table.formation.needOne"));
      return;
    }
    if (await send({ do: mode, order: draft })) setEditing(null);
  }

  return (
    <section className="formation reveal space-y-2" aria-label={t("table.formation.title")}>
      <SectionHead title={t("table.formation.title")} glyph="cue-travel" level="h3" aside={placed.length ? `${placed.length}` : undefined} />
      <p ref={noticeRef} role="alert" className={cn("text-xs text-red-300", notice ? "" : "hidden")}>
        {notice}
      </p>
      {editing ? (
        <div className="formation-editor space-y-2 rounded-xl border border-amber-500/30 bg-stone-900/60 p-2.5">
          <p className="text-xs text-stone-400">{t("table.formation.editorNote")}</p>
          <ol className="flex flex-col gap-1">
            {draft.map((id, index) => (
              <li
                key={`${id}:${moved?.id === id ? moved.seq : 0}`}
                className="formation-row flex min-h-10 items-center gap-1.5 rounded-lg border px-2 py-1"
                data-tone="editing"
                data-moved={moved?.id === id ? "true" : undefined}
              >
                <span className="formation-rank font-mono text-[11px] text-amber-200/90">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-100">{nameOf(id)}</span>
                <button type="button" className="formation-step motion-press" aria-label={t("table.formation.moveFrontAria", { name: nameOf(id) })} disabled={index === 0} onClick={() => step(id, -1)}>
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" className="formation-step motion-press" aria-label={t("table.formation.moveRearAria", { name: nameOf(id) })} disabled={index === draft.length - 1} onClick={() => step(id, 1)}>
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(ui.btnSmall, "text-[11px]")}
                  aria-label={t("table.formation.leaveOutAria", { name: nameOf(id) })}
                  onClick={() => setEditing(draft.filter((entry) => entry !== id))}
                >
                  {t("table.formation.out")}
                </button>
              </li>
            ))}
          </ol>
          {left.length ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-400">
              <span>{t("table.formation.notPlaced")}</span>
              {left.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={cn(ui.btnSmall, "text-[11px]")}
                  onClick={() => {
                    setEditing([...draft, id]);
                    setMoved((current) => ({ id, seq: (current?.seq ?? 0) + 1 }));
                  }}
                >
                  {t("table.formation.atRear", { name: nameOf(id) })}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button type="button" disabled={busy} className={cn(ui.btnPrimary, "text-xs")} onClick={() => void save("set")}>
              {t("table.formation.saveNow")}
            </button>
            <button type="button" disabled={busy} className={cn(ui.btnSecondary, "text-xs")} onClick={() => void save("propose")}>
              {t("table.formation.propose")}
            </button>
            <button type="button" className={cn(ui.btnSmall, "text-xs")} onClick={() => setEditing(null)}>
              {t("table.formation.cancel")}
            </button>
          </div>
          <p className="text-[11px] text-stone-500">{t("table.formation.saveNote")}</p>
        </div>
      ) : (
        <>
          {placed.length ? (
            list(placed, "active")
          ) : (
            <p className="text-xs text-stone-500">
              {t("table.formation.noneYet")}{" "}
              {arranges ? t("table.formation.arrangeHint") : t("table.formation.leadArranges")}
            </p>
          )}
          {unplaced.length ? (
            <p className="text-xs text-stone-400">
              {t("table.formation.unplacedLine", { names: unplaced.map(nameOf).join(", ") })}
            </p>
          ) : null}
          {change?.status === "proposed" ? (
            <div className="formation-proposal rounded-xl border border-dashed border-amber-400/50 bg-amber-400/5 p-2.5">
              <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-amber-200/90">
                {t("table.formation.proposedBy", { name: change.byName || t("table.formation.leadLower") })}
              </p>
              {list(change.order, "proposed")}
              {answers(change)}
              {arranges ? (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" disabled={busy} className={cn(ui.btnSmall, "text-xs")} onClick={() => void send({ do: "activate" })}>
                    {t("table.formation.activate")}
                  </button>
                  <button type="button" disabled={busy} className={cn(ui.btnSmall, "text-xs")} onClick={() => void send({ do: "withdraw" })}>
                    {t("table.formation.withdraw")}
                  </button>
                </span>
              ) : null}
            </div>
          ) : change && change.affected.length ? (
            <div className="formation-moved rounded-xl border border-stone-700/60 bg-stone-900/50 p-2.5">
              <p className="text-xs text-stone-300">
                {t("table.formation.movedLine", { name: change.byName || t("table.formation.leadCap"), names: change.affected.map(nameOf).join(", ") })}
              </p>
              {answers(change)}
              {arranges ? (
                <button type="button" disabled={busy} className={cn(ui.btnSmall, "mt-2 text-xs")} onClick={() => void send({ do: "withdraw" })}>
                  {t("table.formation.clearAnswers")}
                </button>
              ) : null}
            </div>
          ) : null}
          {arranges ? (
            <button
              type="button"
              className={cn(ui.btnSecondary, "w-full text-xs")}
              onClick={() => {
                setNotice("");
                setEditing([...placed, ...unplaced]);
              }}
            >
              {placed.length ? t("table.formation.rearrange") : t("table.formation.arrange")}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
