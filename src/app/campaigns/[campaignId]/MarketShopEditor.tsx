"use client";

import { Plus, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { ContentPick } from "@/components/ui/ContentPick";
import { GameIcon } from "@/components/ui/GameIcon";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { readWrite } from "@/lib/load-state";
import { MARKUP_STEPS, costToCopper, type StockLine } from "@/lib/dm/shop-logic";
import { formatPrice, parseCoins, unreadCoins } from "@/lib/srd/currency";
import { withoutBonus } from "@/lib/srd/item-row";
import { KitButton, panelField, SettingToggle } from "./PanelKit";
import { KIND_KEYS, SIZE_KEYS } from "./MarketPanel";
import { textKey } from "@/lib/language/text-logic";
import { useT } from "@/lib/locale";

// The translator's shape, for the label helper below: `t` comes in first
// (src/lib/story-window.ts).
type T = (key: string, vars?: Record<string, string | number>) => string;

// The Market's shop editor (#171), for whoever holds the prep: the DM seat,
// the lead of an AI-narrated table, the workshop's author. Every field is
// one a person can type or pick: the place and keeper from the campaign's
// own lists, a shelf line from the content pack's catalog at the catalog's
// price or written by hand at any price, a markup from the haggle ladder.
// What it saves is the shelf now and the shelf a restock refills to. A line
// picked from the catalog keeps the row it is (srdName) when it is renamed
// into the table's language, so what is bought is still that row.

export type EditableShop = {
  id: string;
  name: string;
  kind: string;
  size: string;
  locationId: string;
  keeperNpcId: string;
  buys: boolean;
  restockDays: number;
  markup: number;
  stock: StockLine[];
  preparedStock: StockLine[] | null;
};

export type Named = { id: string; name: string };

const KINDS = ["general", "smith", "apothecary", "outfitter", "curiosities"] as const;
const SIZES = ["hamlet", "village", "town", "city"] as const;
const MAX_LINES = 60;

// The haggle ladder in words, so a markup is picked rather than typed.
function markupLabel(t: T, step: number): string {
  return step === 1
    ? t("market.editor.listPrice")
    : step < 1
      ? t("market.editor.off", { pct: Math.round((1 - step) * 100) })
      : step === 2
        ? t("market.editor.double")
        : t("market.editor.plus", { pct: Math.round((step - 1) * 100) });
}

// A price typed the way the table says it ("15 gp", "2 sp 5 cp", a bare
// number is gold), shown back in coin. A slip that is not a price keeps the
// last good one and says so.
function CoinField({ value, onChange, label }: { value: number; onChange: (cp: number) => void; label: string }) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) {
      return;
    }
    const parsed = parseCoins(draft);
    if (parsed && parsed > 0) {
      onChange(parsed);
      setBad(null);
    } else {
      setBad(parsed === null ? unreadCoins(t, draft) : t("market.editor.priceHint"));
    }
    setDraft(null);
  };
  return (
    <input
      value={draft ?? formatPrice(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        }
      }}
      aria-label={label}
      aria-invalid={bad !== null || undefined}
      title={bad ?? undefined}
      className={cn(panelField, "w-[7.5rem] tabular-nums", bad && "motion-shake border-red-500/60")}
    />
  );
}

export function MarketShopEditor({
  campaignId,
  shop,
  places,
  keepers,
  onSaved,
  onCancel,
}: {
  campaignId: string;
  shop: EditableShop;
  places: Named[];
  keepers: Named[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState({
    name: shop.name,
    kind: shop.kind,
    size: shop.size,
    locationId: shop.locationId,
    keeperNpcId: shop.keeperNpcId,
    buys: shop.buys,
    restockDays: shop.restockDays,
    markup: String(MARKUP_STEPS.reduce((best, step) => (Math.abs(step - shop.markup) < Math.abs(best - shop.markup) ? step : best), 1)),
  });
  const [lines, setLines] = useState<StockLine[]>(shop.stock.map(({ itemName, qty, priceCp, note, srdName }) => ({ itemName, qty, priceCp, note, ...(srdName ? { srdName } : {}) })));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const unnamed = lines.some((line) => !line.itemName.trim());
  const setLine = (index: number, patch: Partial<StockLine>) =>
    setLines((current) => current.map((line, at) => (at === index ? { ...line, ...patch } : line)));
  const addLine = (line: StockLine) =>
    setLines((current) => {
      const same = current.findIndex((entry) => textKey(entry.itemName) === textKey(line.itemName) && line.itemName);
      if (same >= 0) {
        return current.map((entry, at) => (at === same ? { ...entry, qty: Math.min(999, entry.qty + line.qty) } : entry));
      }
      return current.length >= MAX_LINES ? current : [...current, line];
    });

  async function send(body: Record<string, unknown>, what: string) {
    setBusy(what);
    setError("");
    try {
      // A PATCH sent twice lands the same, so a lost answer is only said,
      // and the shelf stays as typed to send again (audit WA-05).
      const sent = await readWrite(t,
        fetch(`/api/campaigns/${campaignId}/shops/${shop.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        t("load.write.saveShop"),
      );
      if (sent.error !== null) {
        setError(sent.unanswered ? `${sent.error} ${t("market.editor.keptHere")}` : sent.error);
        return false;
      }
      onSaved();
      return true;
    } finally {
      setBusy("");
    }
  }

  const save = () =>
    send(
      {
        name: draft.name.trim() || shop.name,
        kind: draft.kind,
        size: draft.size,
        locationId: draft.locationId,
        keeperNpcId: draft.keeperNpcId,
        buys: draft.buys,
        restockDays: draft.restockDays,
        markup: Number(draft.markup),
        // Lines with none left are dropped by the shelf itself.
        stock: lines.map((line) => ({ ...line, itemName: line.itemName.trim() })),
      },
      "save",
    );

  return (
    <div className="panel reveal space-y-2.5 rounded-lg p-2.5" aria-label={t("market.editAria", { name: shop.name })}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} aria-label={t("market.open.nameAria")} className={cn(panelField, "min-w-[9rem] flex-1")} />
        <Select size="sm" label={t("market.open.kind")} value={draft.kind} options={KINDS.map((kind) => ({ value: kind as string, label: t(KIND_KEYS[kind]) }))} onChange={(kind) => setDraft({ ...draft, kind })} className="pk-w-28" />
        <Select size="sm" label={t("market.open.size")} value={draft.size} options={SIZES.map((size) => ({ value: size as string, label: t(SIZE_KEYS[size]) }))} onChange={(size) => setDraft({ ...draft, size })} className="pk-w-24" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Select
          size="sm"
          label={t("market.open.where")}
          value={draft.locationId}
          options={[{ value: "", label: t("market.open.noPlace") }, ...places.map((place) => ({ value: place.id, label: place.name, icon: { kind: "glyph" as const, key: "tab-map" } }))]}
          onChange={(locationId) => setDraft({ ...draft, locationId })}
        />
        <Select
          size="sm"
          label={t("market.open.keeper")}
          value={draft.keeperNpcId}
          options={[{ value: "", label: t("market.open.nobody") }, ...keepers.map((npc) => ({ value: npc.id, label: npc.name, icon: { kind: "glyph" as const, key: "system-cast" } }))]}
          onChange={(keeperNpcId) => setDraft({ ...draft, keeperNpcId })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <SettingToggle on={draft.buys} onToggle={() => setDraft({ ...draft, buys: !draft.buys })}>
          {t("market.editor.buys")}
        </SettingToggle>
        <Select size="sm" label={t("market.editor.prices")} value={draft.markup} options={MARKUP_STEPS.map((step) => ({ value: String(step), label: markupLabel(t, step) }))} onChange={(markup) => setDraft({ ...draft, markup })} className="pk-w-28" />
        <span className="flex items-center gap-1.5 text-xs text-stone-400">
          {t("market.editor.restocksEvery")}
          <NumberStepper size="sm" label={t("market.editor.daysBetween")} value={draft.restockDays} min={0} max={365} onChange={(restockDays) => setDraft({ ...draft, restockDays })} suffix={t("market.editor.days")} />
        </span>
      </div>
      <p className="text-[11px] text-stone-500">
        {draft.restockDays === 0
          ? t("market.editor.never")
          : shop.preparedStock
            ? t("market.editor.refill", { count: draft.restockDays })
            : t("market.editor.refillPack", { count: draft.restockDays })}
      </p>

      <ul className="stagger space-y-1" aria-label={t("market.editor.shelfAria")}>
        {lines.map((line, index) => (
          <li key={index} className="flex flex-wrap items-center gap-1 rounded-md border border-stone-800/80 bg-stone-950/40 p-1.5">
            <GameIcon icon={{ kind: "item", key: line.itemName || "pack", family: "item-gear" }} size="size-6" />
            <input
              value={line.itemName}
              onChange={(event) => setLine(index, { itemName: event.target.value })}
              maxLength={80}
              placeholder={t("market.editor.itemPlaceholder")}
              aria-label={t("market.editor.lineItem", { n: index + 1 })}
              className={cn(panelField, "min-w-[7rem] flex-1", !line.itemName.trim() && "border-amber-500/50")}
            />
            <NumberStepper size="sm" label={t("market.editor.lineCount", { n: index + 1 })} value={line.qty} min={0} max={999} onChange={(qty) => setLine(index, { qty })} />
            <CoinField label={t("market.editor.linePrice", { n: index + 1 })} value={line.priceCp} onChange={(priceCp) => setLine(index, { priceCp })} />
            <KitButton tone="iconDanger" always aria-label={line.itemName ? t("market.editor.takeOff", { name: line.itemName }) : t("market.editor.takeOffUnnamed")} onClick={() => setLines((current) => current.filter((_, at) => at !== index))}>
              <X className="size-3.5" />
            </KitButton>
            {line.srdName && textKey(line.srdName) !== textKey(withoutBonus(line.itemName)) ? (
              <span className="flex basis-full items-center gap-1 text-[11px] text-stone-400">
                <span className="rounded border border-stone-700/80 px-1.5 py-0.5">{t("market.editor.listedAs", { name: line.srdName })}</span>
                <KitButton
                  tone="iconDanger"
                  always
                  aria-label={line.itemName ? t("market.editor.sellUnlisted", { name: line.itemName }) : t("market.editor.sellUnlistedUnnamed")}
                  title={t("market.editor.sellUnlistedTitle")}
                  onClick={() => setLine(index, { srdName: undefined })}
                >
                  <X className="size-3.5" />
                </KitButton>
              </span>
            ) : null}
            <input
              value={line.note}
              onChange={(event) => setLine(index, { note: event.target.value })}
              maxLength={120}
              placeholder={t("market.editor.notePlaceholder")}
              aria-label={t("market.editor.lineNote", { n: index + 1 })}
              className={cn(panelField, "basis-full")}
            />
          </li>
        ))}
        {!lines.length ? <li className="text-xs italic text-stone-500">{t("market.editor.empty")}</li> : null}
      </ul>

      {lines.length < MAX_LINES ? (
        <div className="space-y-1.5">
          <ContentPick
            kind="items"
            label={t("market.editor.addCatalog")}
            placeholder={t("market.editor.addPlaceholder")}
            onPick={(entry) =>
              addLine({
                itemName: entry.name.slice(0, 80),
                qty: 1,
                priceCp: entry.price?.copper ?? costToCopper(entry.cost ?? "") ?? 100,
                note: "",
                ...(entry.srdName ? { srdName: entry.srdName } : {}),
              })
            }
          />
          <KitButton tone="link" onClick={() => addLine({ itemName: "", qty: 1, priceCp: 100, note: "" })}>
            <Plus className="size-3.5" /> {t("market.editor.byHand")}
          </KitButton>
        </div>
      ) : (
        <p className="text-[11px] text-stone-500">{t("market.editor.maxLines", { n: MAX_LINES })}</p>
      )}

      {error ? <p role="alert" className="live-in motion-shake text-xs text-red-300">{error}</p> : null}
      {unnamed ? <p className="live-in text-[11px] text-amber-300/90">{t("market.editor.nameEvery")}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <KitButton tone="primary" disabled={Boolean(busy) || unnamed} busy={busy === "save"} onClick={() => void save()}>
          {t("market.editor.save")}
        </KitButton>
        <KitButton onClick={onCancel}>{t("action.cancel")}</KitButton>
        <span className="flex-1" />
        {shop.preparedStock ? (
          <KitButton tone="link" disabled={Boolean(busy)} onClick={() => void send({ stockFromPack: true }, "pack")}>
            {t("market.editor.packRestock")}
          </KitButton>
        ) : null}
        <KitButton disabled={Boolean(busy)} busy={busy === "restock"} onClick={() => void send({ restock: true }, "restock")} title={t("market.editor.restockTitle")}>
          <RotateCw className="size-3.5" /> {t("market.editor.restockNow")}
        </KitButton>
      </div>
    </div>
  );
}
