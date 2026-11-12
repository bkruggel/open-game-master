"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { appNotice } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { navigateTo } from "@/lib/navigation";
import { hostOffers, offersStoryModel, useCapabilities } from "@/lib/use-capabilities";
import type { MatchOption } from "@/lib/pdf-import/match-logic";
import type { ImportView, ReviewView } from "@/lib/pdf-import/view";
import type { MatchChoice } from "./PdfMatches";
import { PdfReview } from "@/app/workshop/pdf-import/PdfReview";
import { sendBook, type SendProgress } from "@/app/workshop/pdf-import/send-book";
import { useT } from "@/lib/locale";

// "Import an adventure PDF": the GM picks their own copy of a book, the
// page reads it (src/lib/pdf-import/read-pdf.ts), the server reads what it
// says (and, with a story model, what it means), and the GM reviews the
// result before it becomes a workshop, or, from WorldForge, part of the
// world already open. An import half done (a closed tab, a phone that
// slept) waits on the server and is offered again here.
//
// No setting: the import does as much as the host can. Without a story
// model it reads the layout (the text, stat blocks, tables, maps, pictures
// and chapters) and says what a model would add.

type PdfT = (key: string, vars?: Record<string, string | number>) => string;

type Phase =
  | { kind: "idle" }
  | { kind: "sending"; progress: SendProgress; fileName: string }
  | { kind: "working"; item: ImportView }
  | { kind: "review"; item: ImportView; review: ReviewView; srd: MatchOption[] };

const POLL_MS = 2_000;

// send-book's "reach the server" sentence, matched by its own retry logic
// (/reach the server/, send-book.ts): the one wording of this file that
// stays English at the source and is mapped to the reader's words at the
// display site (pick's catch, the engineRefusalKey pattern, hand-core.ts).
const REACH_SENTENCE = "Could not reach the server. Your progress is kept; pick the PDF again to carry on.";

async function json<T>(t: PdfT, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }).catch(() => {
    throw new Error(t("pdf.unreachable"));
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || t("pdf.failed"));
  return data;
}

function sendingLine(t: PdfT, progress: SendProgress): string {
  if (progress.phase === "opening") return t("pdf.progress.opening");
  if (progress.phase === "pages") return t("pdf.progress.pages", { done: progress.done, total: progress.total });
  if (progress.phase === "pictures") return t("pdf.progress.pictures", { done: progress.done, total: progress.total });
  return t("pdf.progress.starting");
}

export function PdfImportButton({
  campaignId,
  label,
  className = ui.btnSecondary,
  onImported,
}: {
  // Begun inside a workshop's WorldForge: the world it goes into.
  campaignId?: string;
  // A caller's own words on the button (WorldForge); default pdf.import.label.
  label?: string;
  className?: string;
  // From WorldForge: what to refresh once the book is in.
  onImported?: () => void;
}) {
  const t = useT();
  const capabilities = useCapabilities();
  const offered = hostOffers(capabilities, "pdfImport");
  const withModel = offersStoryModel(capabilities);
  const input = useRef<HTMLInputElement>(null);
  const signal = useRef({ cancelled: false });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [matchError, setMatchError] = useState("");
  const chosen = useRef(0);
  const [open, setOpen] = useState<ImportView[]>([]);
  const [continueId, setContinueId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const destination = campaignId ? "world" : "workshop";

  const mine = useCallback((item: ImportView) => (campaignId ? item.campaignId === campaignId : !item.campaignId), [campaignId]);

  const refreshOpen = useCallback(async () => {
    try {
      const data = await json<{ imports: ImportView[] }>(t, "/api/pdf-imports");
      setOpen(data.imports.filter(mine));
    } catch {
      // The list is a convenience; the button works without it.
    }
  }, [t, mine]);

  useEffect(() => {
    if (!offered) return;
    let stopped = false;
    json<{ imports: ImportView[] }>(t, "/api/pdf-imports")
      .then((data) => {
        if (!stopped) setOpen(data.imports.filter(mine));
      })
      .catch(() => {
        // The list is a convenience; the button works without it.
      });
    return () => {
      stopped = true;
    };
  }, [offered, mine, t]);

  const follow = useCallback(async (item: ImportView) => {
    if (item.state === "review") {
      const data = await json<{ import: ImportView; review?: ReviewView; srd?: MatchOption[] }>(t, `/api/pdf-imports/${item.id}`);
      if (data.review) setPhase({ kind: "review", item: data.import, review: data.review, srd: data.srd ?? [] });
      return;
    }
    setPhase({ kind: "working", item });
  }, [t]);

  // While the server reads, the card follows it.
  useEffect(() => {
    if (phase.kind !== "working") return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const data = await json<{ import: ImportView; review?: ReviewView; srd?: MatchOption[] }>(t, `/api/pdf-imports/${phase.item.id}`);
        if (stopped) return;
        if (data.import.state === "review" && data.review) setPhase({ kind: "review", item: data.import, review: data.review, srd: data.srd ?? [] });
        else if (data.import.state === "failed") {
          setError(data.import.reason || t("pdf.import.stopped"));
          setPhase({ kind: "idle" });
          void refreshOpen();
        } else setPhase({ kind: "working", item: data.import });
      } catch (thrown) {
        if (!stopped) setError(thrown instanceof Error ? thrown.message : t("pdf.import.lostTouch"));
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [phase, refreshOpen, t]);

  if (!offered) return null;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    signal.current = { cancelled: false };
    setPhase({ kind: "sending", progress: { phase: "opening", done: 0, total: 0 }, fileName: file.name });
    try {
      const item = await sendBook(t, file, {
        campaignId,
        continueId: continueId || undefined,
        signal: signal.current,
        onProgress: (progress) => setPhase({ kind: "sending", progress, fileName: file.name }),
      });
      setContinueId("");
      await follow(item);
    } catch (thrown) {
      // The retry-matched sentence of send-book stays English at its source
      // and is worded here; everything else arrives in the reader's words.
      setError(
        thrown instanceof Error
          ? thrown.message === REACH_SENTENCE
            ? t("pdf.send.reach")
            : thrown.message
          : t("pdf.pdfUnreadable"),
      );
      setPhase({ kind: "idle" });
      void refreshOpen();
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function discard(id: string) {
    setBusy(true);
    try {
      await json(t, `/api/pdf-imports/${id}`, { method: "DELETE" });
      setPhase({ kind: "idle" });
      await refreshOpen();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("pdf.discardFailed"));
    } finally {
      setBusy(false);
    }
  }

  // A creature's match, saved as it is made: the review comes back with
  // its records' notes brought up to date. Choices can follow each other
  // faster than the saves; only the latest reply is shown.
  async function choose(item: ImportView, srd: MatchOption[], choices: Record<string, MatchChoice>) {
    const mine = ++chosen.current;
    setMatchError("");
    try {
      const data = await json<{ import: ImportView; review: ReviewView }>(t, `/api/pdf-imports/${item.id}`, { method: "PATCH", body: JSON.stringify({ matches: choices }) });
      if (mine === chosen.current) setPhase({ kind: "review", item: data.import, review: data.review, srd });
    } catch (thrown) {
      if (mine === chosen.current) setMatchError(thrown instanceof Error ? thrown.message : t("pdf.matchSaveFailed"));
    }
  }

  async function bringIn(item: ImportView, choices: { include: Record<string, boolean>; title: string; destination: "workshop" | "world" }) {
    setBusy(true);
    setError("");
    try {
      await json(t, `/api/pdf-imports/${item.id}`, { method: "PATCH", body: JSON.stringify({ include: choices.include, ...(choices.title ? { title: choices.title } : {}) }) });
      const done = await json<{ workshopId: string; shelf?: { renamed: string[]; refused: string[] } }>(t, `/api/pdf-imports/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "import", destination: choices.destination }),
      });
      const renamed = (done.shelf?.renamed ?? []).filter(Boolean);
      const refused = (done.shelf?.refused ?? []).filter(Boolean);
      if (renamed.length || refused.length) {
        await appNotice([...renamed, ...refused].join(" "), t("pdf.fromBook"));
      }
      setPhase({ kind: "idle" });
      if (choices.destination === "world" && campaignId) {
        onImported?.();
        await refreshOpen();
      } else navigateTo(`/workshop/${done.workshopId}`);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t("pdf.bringInFailed"));
    } finally {
      setBusy(false);
    }
  }

  const sending = phase.kind === "sending";
  const working = phase.kind === "working";
  const percent =
    phase.kind === "sending" && phase.progress.total
      ? Math.round((phase.progress.done / phase.progress.total) * 100)
      : phase.kind === "working" && phase.item.total
        ? Math.round((phase.item.done / phase.item.total) * 100)
        : null;

  return (
    // It sits in a row of buttons: allowed to shrink to the row, and the
    // whole row once a book is being read or reviewed.
    <div data-testid="pdf-import" className={cn("min-w-0 max-w-full", phase.kind !== "idle" && "basis-full")}>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(event) => void pick(event.target.files?.[0])} />
      <button
        type="button"
        onClick={() => {
          setContinueId("");
          input.current?.click();
        }}
        disabled={sending || working || busy}
        className={className}
        title={t("pdf.import.title")}
      >
        {sending || working ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
        {label ?? t("pdf.import.label")}
      </button>

      {phase.kind === "idle" && open.length ? (
        <ul className="stagger mt-2 space-y-1" aria-label={t("pdf.openList.aria")}>
          {open.map((item) => (
            <li key={item.id} className="reveal flex flex-wrap items-center gap-2 text-xs text-stone-400">
              <span className="text-stone-300">{item.title || item.fileName}</span>
              <span>
                {item.state === "review"
                  ? t("pdf.item.read")
                  : item.state === "working"
                    ? item.step || t("pdf.item.reading")
                    : item.state === "failed"
                      ? t("pdf.item.stopped", { reason: item.reason })
                      : t("pdf.item.pages", { received: item.pagesReceived, total: item.pageCount })}
              </span>
              {item.state === "review" || item.state === "working" ? (
                <button type="button" className={ui.btnSmall} onClick={() => void follow(item).catch((thrown) => setError(String(thrown?.message ?? thrown)))}>
                  {item.state === "review" ? t("pdf.item.review") : t("pdf.item.follow")}
                </button>
              ) : (
                <button
                  type="button"
                  className={ui.btnSmall}
                  onClick={() => {
                    setContinueId(item.state === "failed" && item.pagesReceived >= item.pageCount ? "" : item.id);
                    if (item.state === "failed" && item.pagesReceived >= item.pageCount) {
                      void json<{ import: ImportView }>(t, `/api/pdf-imports/${item.id}`, { method: "POST", body: JSON.stringify({ action: "start" }) })
                        .then((data) => follow(data.import))
                        .catch((thrown) => setError(thrown instanceof Error ? thrown.message : t("pdf.restartFailed")));
                    } else input.current?.click();
                  }}
                >
                  {item.state === "failed" && item.pagesReceived >= item.pageCount ? t("action.retry") : t("pdf.item.repick")}
                </button>
              )}
              <button type="button" className={ui.btnSmall} disabled={busy} onClick={() => void discard(item.id)}>
                {t("action.discard")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {sending || working ? (
        <div className={`${ui.card} reveal mt-3 p-4`} role="status" aria-live="polite">
          <p className="text-sm text-stone-200">{sending ? sendingLine(t, phase.progress) : phase.item.step || t("pdf.working.default")}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-800" aria-hidden="true">
            <div
              className={cn("h-full rounded-full bg-amber-400/80 transition-[width] duration-500", percent === null && "w-1/3 animate-pulse")}
              style={percent === null ? undefined : { width: `${Math.max(3, percent)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {sending
              ? t("pdf.privacy")
              : withModel
                ? t("pdf.model.long")
                : t("pdf.layoutOnly")}
          </p>
          {sending ? (
            <button type="button" className={cn(ui.btnSmall, "mt-2")} onClick={() => (signal.current.cancelled = true)}>
              {t("pdf.stop")}
            </button>
          ) : (
            <button type="button" className={cn(ui.btnSmall, "mt-2")} disabled={busy} onClick={() => void discard(phase.item.id)}>
              {t("pdf.stopDiscard")}
            </button>
          )}
        </div>
      ) : null}

      {phase.kind === "review" ? (
        <PdfReview
          importId={phase.item.id}
          review={phase.review}
          destination={destination}
          busy={busy}
          error={error}
          matchError={matchError}
          srd={phase.srd}
          onChoose={(choices) => void choose(phase.item, phase.srd, choices)}
          onReread={() =>
            void json<{ import: ImportView }>(t, `/api/pdf-imports/${phase.item.id}`, { method: "POST", body: JSON.stringify({ action: "start" }) })
              .then((data) => follow(data.import))
              .catch((thrown) => setError(thrown instanceof Error ? thrown.message : t("pdf.restartFailed")))
          }
          onImport={(choices) => void bringIn(phase.item, choices)}
          onDiscard={() => void discard(phase.item.id)}
        />
      ) : null}

      {error && phase.kind !== "review" ? (
        <p role="alert" className="motion-shake mt-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
