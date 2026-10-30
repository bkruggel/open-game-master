"use client";

import { EyeOff, Eye, X } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { GameIcon } from "@/components/ui/GameIcon";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";
import type { StoredRoll } from "@/lib/db/rolls";
import {
  EMPTY_TRAY_POOL,
  TRAY_DIE_SIDES,
  TRAY_MODIFIER_LIMIT,
  trayAddDie,
  trayPoolExpression,
  type TrayPool,
} from "@/lib/dice/tray-pool";
import { ui } from "@/lib/ui";

// The dice tray: loose dice for anyone at the table. Tap dice into the pool
// (or type an expression), add a bonus, and the server throws them; the roll
// lands in the table's log like every other. With "Roll in secret" on, the
// roll goes behind the screen: a DM seat's secret roll is theirs alone, a
// player's is theirs and the DM's (src/lib/dm/viewer.ts decides; the table
// is never sent it). The tray keeps the last few results while the table is
// open, so a number rolled in secret can be looked at again.

const HISTORY = 6;

type TrayResult = { roll: StoredRoll; secret: boolean };

// Moved to src/lib/dice/secret-audience.ts so the table can word the
// tray's promise without loading the tray; kept here for its callers.
export { secretAudience } from "@/lib/dice/secret-audience";


function faces(roll: StoredRoll): string {
  return roll.breakdown.terms
    .map((term, index) => {
      const sign = term.sign < 0 ? "- " : index > 0 ? "+ " : "";
      return term.kind === "dice" ? `${sign}[${term.dice.map((die) => die.value).join(", ")}]` : `${sign}${term.value}`;
    })
    .join(" ");
}

function ResultRow({ result, fresh }: { result: TrayResult; fresh: boolean }) {
  const t = useT();
  const { roll } = result;
  const crit = roll.breakdown.crit ?? null;
  return (
    <li className={cn("dice-tray-result", fresh && "dice-tray-result-fresh")} data-crit={crit ?? undefined} data-secret={result.secret || undefined}>
      <span key={fresh ? roll.id : undefined} className="dice-tray-total">
        {roll.total}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm text-stone-200">{roll.expression}</span>
        <span className="block truncate font-mono text-xs text-stone-500">{faces(roll)}</span>
      </span>
      {crit ? <span className="dice-tray-crit">{crit === "nat20" ? t("table.tray.nat20") : t("table.tray.nat1")}</span> : null}
      {result.secret ? (
        <span className="dice-tray-secret">
          <EyeOff className="size-3" aria-hidden="true" />
          {t("table.tray.secretTag")}
        </span>
      ) : null}
    </li>
  );
}

export function DiceTrayDialog({
  open,
  onOpenChange,
  campaignId,
  audience,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  // secretAudience() for this seat.
  audience: string;
}) {
  const [pool, setPool] = useState<TrayPool>(EMPTY_TRAY_POOL);
  const t = useT();
  // What the reader typed in place of the tapped pool; null while the pool
  // speaks for itself.
  const [typed, setTyped] = useState<string | null>(null);
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TrayResult[]>([]);

  const expression = (typed ?? trayPoolExpression(pool)).trim();

  function tap(sides: number) {
    setTyped(null);
    setError("");
    setPool((current) => trayAddDie(typed === null ? current : EMPTY_TRAY_POOL, sides));
  }

  function clear() {
    setTyped(null);
    setPool(EMPTY_TRAY_POOL);
    setError("");
  }

  async function roll() {
    if (!expression || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression, secret }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.roll) {
        setError(data.error || t("table.tray.failed"));
        return;
      }
      setResults((current) => [{ roll: data.roll as StoredRoll, secret }, ...current].slice(0, HISTORY));
    } catch {
      setError(t("table.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("table.tray.title")}
      icon={<GameIcon icon={{ kind: "glyph", key: "tab-dice" }} size="size-6" />}
      width="w-[min(94vw,30rem)]"
    >
      <div className="dice-tray" data-secret={secret || undefined}>
        <div className="dice-tray-dice" role="group" aria-label={t("table.tray.addDie")}>
          {TRAY_DIE_SIDES.map((sides) => {
            const count = typed === null ? (pool.dice[sides] ?? 0) : 0;
            return (
              <button
                key={sides}
                type="button"
                className="dice-tray-die motion-press"
                data-on={count > 0 || undefined}
                onClick={() => tap(sides)}
                aria-label={count ? t("table.tray.addDieCount", { sides, count }) : t("table.tray.addDieAria", { sides })}
              >
                <GameIcon icon={{ kind: "glyph", key: `die-d${sides}` }} size="size-9" />
                <span className="dice-tray-die-name">d{sides}</span>
                {count ? (
                  <span key={count} className="dice-tray-count">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className={ui.sectionEyebrow}>{t("table.tray.dice")}</span>
            <input
              className={cn(ui.input, "mt-1 font-mono")}
              value={expression}
              placeholder={t("table.tray.placeholder")}
              maxLength={60}
              spellCheck={false}
              onChange={(event) => {
                setTyped(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void roll();
                }
              }}
            />
          </label>
          <div className="shrink-0">
            <span className={ui.sectionEyebrow}>{t("table.tray.bonus")}</span>
            <NumberStepper
              className="mt-1"
              size="sm"
              label={t("table.tray.bonus")}
              value={pool.bonus}
              min={-TRAY_MODIFIER_LIMIT}
              max={TRAY_MODIFIER_LIMIT}
              disabled={typed !== null}
              onChange={(bonus) => setPool((current) => ({ ...current, bonus }))}
            />
          </div>
          {expression ? (
            <button type="button" className={cn(ui.btnSmall, "h-10 shrink-0 px-2.5")} onClick={clear} aria-label={t("table.tray.empty")}>
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="dice-tray-secret-row mt-4">
          <span className="dice-tray-secret-icon" aria-hidden="true">
            {secret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-stone-200">{t("table.tray.secret")}</span>
            <span className="block text-xs text-stone-500">
              {secret ? audience : t("table.tray.secretOff")}
            </span>
          </span>
          <Switch on={secret} onChange={setSecret} label={t("table.tray.secret")} />
        </div>

        <button type="button" className={cn(ui.btnPrimary, "dice-tray-roll mt-4 w-full")} disabled={!expression || busy} onClick={() => void roll()}>
          {secret ? <EyeOff className="size-4" aria-hidden="true" /> : null}
          {busy ? t("table.tray.rolling") : secret ? t("table.tray.secret") : t("table.tray.roll")}
        </button>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-ember-300">
            {error}
          </p>
        ) : null}

        {results.length ? (
          <ol className="dice-tray-results mt-4" aria-live="polite" aria-label={t("table.tray.rollsAria")}>
            {results.map((result, index) => (
              <ResultRow key={result.roll.id} result={result} fresh={index === 0} />
            ))}
          </ol>
        ) : null}
      </div>
    </Dialog>
  );
}
