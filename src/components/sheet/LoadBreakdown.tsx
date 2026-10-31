"use client";

import { useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { GameIcon } from "@/components/ui/GameIcon";
import { CountPop } from "@/components/ui/Reveal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useT } from "@/lib/locale";
import {
  coinWeightLb,
  COINS_PER_POUND,
  loadLines,
  sortLoadLines,
  type Encumbrance,
  type LoadOrder,
  type LoadSort,
  type WeightSource,
} from "@/lib/srd/encumbrance";

// What the Carried tile is made of (issue #206): every line of the pack with
// its count, its weight each and its line total, the purse, and the lines
// nothing could weigh. Read-only, for anyone who can open the sheet. The
// lines are the ones the total is summed from (src/lib/srd/encumbrance.ts
// loadLines), so they add up to the tile by construction, and both redraw
// from the same sheet when it changes.

// A weight the line does not carry itself says where it came from,
// as a message key (sheet.load.*) read with the caller's translator.
const SOURCE_NOTE: Record<WeightSource, string | null> = {
  item: null,
  ammunition: "sheet.load.perRound",
  armor: "sheet.load.fromArmor",
  gear: "sheet.load.fromGear",
  weapon: "sheet.load.fromWeapon",
};

function pounds(value: number, places: number): string {
  return `${Number(value.toFixed(places))} lb`;
}

export function LoadBreakdown({
  open,
  onOpenChange,
  name,
  equipment,
  gold,
  load,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  equipment: Array<{ name: string; qty?: number; weight?: number; equipped?: boolean }>;
  // Whole gold pieces: the coins the load weighs, as every caller of
  // encumbranceFor counts them.
  gold: number;
  load: Encumbrance;
}) {
  const t = useT();
  const [key, setKey] = useState<LoadSort>("total");
  const [order, setOrder] = useState<LoadOrder>("desc");
  const lines = sortLoadLines(loadLines(equipment), key, order);
  const coins = Math.max(0, gold);
  const floor = load.unweighed > 0;
  const total = `${load.carriedLb}${floor ? "+" : ""} lb`;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("sheet.load.title", { name })}
      icon={<GameIcon icon={{ kind: "glyph", key: "coin-purse" }} size="size-6" />}
      width="w-[min(94vw,38rem)]"
    >
      <div className="load-breakdown space-y-3 text-sm text-stone-300">
        <p className="text-xs leading-relaxed text-stone-400">
          <CountPop value={total} className="font-display text-sm text-amber-100">
            {total}
          </CountPop>{" "}
          {t("sheet.load.capacity", { capacity: load.capacityLb })}{" "}
          {floor ? t("sheet.load.floor", { count: load.unweighed }) : t("sheet.load.noFloor")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            size="sm"
            label={t("sheet.load.sortBy")}
            value={key}
            onChange={setKey}
            options={[
              { value: "total", label: t("sheet.load.lineTotal") },
              { value: "each", label: t("sheet.load.each") },
            ]}
          />
          <SegmentedControl
            size="sm"
            label={t("sheet.load.order")}
            value={order}
            onChange={setOrder}
            options={[
              { value: "desc", label: t("sheet.load.heaviest"), icon: ArrowDownWideNarrow },
              { value: "asc", label: t("sheet.load.lightest"), icon: ArrowUpNarrowWide },
            ]}
          />
        </div>
        <table className="load-table">
          <caption className="sr-only">
            {t("sheet.load.caption", {
              name,
              by: key === "total" ? t("sheet.load.byTotal") : t("sheet.load.byEach"),
              order: order === "desc" ? t("sheet.load.descFirst") : t("sheet.load.ascFirst"),
            })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("sheet.load.item")}</th>
              <th scope="col" className="load-num">
                {t("sheet.load.qty")}
              </th>
              <th scope="col" className="load-num" aria-sort={key === "each" ? (order === "desc" ? "descending" : "ascending") : undefined}>
                {t("sheet.load.each")}
              </th>
              <th scope="col" className="load-num" aria-sort={key === "total" ? (order === "desc" ? "descending" : "ascending") : undefined}>
                {t("sheet.load.total")}
              </th>
            </tr>
          </thead>
          {/* Keyed by the sort, so a re-sort deals the rows in again. */}
          <tbody key={`${key}-${order}`} className="stagger-up">
            {lines.map((line) => {
              const note = line.source ? SOURCE_NOTE[line.source] : null;
              const worn = equipment[line.index]?.equipped;
              return (
                <tr key={line.index} data-unknown={line.totalLb === null ? "" : undefined}>
                  <th scope="row">
                    <span className="block text-stone-200">{line.name}</span>
                    {worn || note ? (
                      <span className="block text-[11px] text-stone-500">{[worn ? t("sheet.gear.worn") : null, note ? t(note) : null].filter(Boolean).join(", ")}</span>
                    ) : null}
                  </th>
                  <td className="load-num">{line.qty}</td>
                  <td className="load-num">{line.eachLb === null ? <span className="load-unknown">{t("sheet.load.unknown")}</span> : pounds(line.eachLb, 3)}</td>
                  <td className="load-num">{line.totalLb === null ? <span className="load-unknown">{t("sheet.load.unknown")}</span> : pounds(line.totalLb, 2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                <span className="block text-stone-200">{t("sheet.load.coins")}</span>
                <span className="block text-[11px] text-stone-500">
                  {t("sheet.load.coinsNote", { coins, perPound: COINS_PER_POUND })}
                </span>
              </th>
              <td className="load-num">{coins}</td>
              <td className="load-num">{pounds(1 / COINS_PER_POUND, 3)}</td>
              <td className="load-num">{pounds(coinWeightLb(coins), 2)}</td>
            </tr>
            <tr className="load-sum">
              <th scope="row">{t("sheet.load.carried")}</th>
              <td className="load-num" colSpan={3}>
                <CountPop value={total}>{total}</CountPop>
                {floor ? (
                  <span className="block text-[11px] font-normal text-amber-300/90">
                    {t("sheet.load.plusUnknown", { count: load.unweighed })}
                  </span>
                ) : null}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Dialog>
  );
}
