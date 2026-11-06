"use client";

import { findLostCreate, readLoad, readWrite, useLoadStatus } from "@/lib/load-state";
import { EmptyState } from "@/components/EmptyState";
import { ChevronDown, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { GameIcon } from "@/components/ui/GameIcon";
import { SectionHead } from "@/components/ui/SectionHead";
import { Select } from "@/components/ui/Select";
import { useEffect, useRef, useState } from "react";
import { appConfirm } from "@/components/ui/ConfirmDialog";
import { InfoDialog } from "@/components/ui/InfoDialog";
import { contentSlug } from "@/lib/help";
import { cardArtwork } from "@/lib/battlemap/card-art";
import { cn } from "@/lib/cn";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { formatCopper, formatPrice } from "@/lib/srd/currency";
import { KitButton, LoadFailed, PanelError, panelField, PanelLoading, RowMenu, SettingToggle } from "./PanelKit";
import { MarketShopEditor, type Named } from "./MarketShopEditor";
import type { StockLine } from "@/lib/dm/shop-logic";
import type { MarketRequest } from "@/lib/dm/table-tabs";
import { GameTerm } from "@/components/ui/GameTerm";
import { useTourPrepare } from "@/lib/tours/prepare";
import { useT } from "@/lib/locale";

// The market (docs/vtt-parity-implementation-plan.md 11.1): the shops at
// the party's place, stock as tiles with a price chip in coin, a Buy on
// each, the pack laid out to sell, a haggle button, and a coin arc into
// the purse when money moves. Whoever steers the story sees every shop in
// the world; whoever holds the prep (the DM seat, the lead of an
// AI-narrated table, the workshop's author: the server says which, #171)
// opens shops here or in the workshop and writes their shelves. A tile's
// name opens the item card (src/components/ui/InfoDialog.tsx): its damage,
// armour class, properties and text, so a buyer knows what the coin gets.

type StockView = { itemName: string; qty: number; priceCp: number; askingCp: number; note: string };
type ShopView = {
  id: string;
  name: string;
  kind: string;
  size: string;
  locationId: string;
  keeperNpcId: string;
  restockDays: number;
  preparedStock: StockLine[] | null;
  locationName: string;
  keeperName: string;
  keeperPortrait: string;
  stock: StockView[];
  buys: boolean;
  markup: number;
  haggledBy: string[];
  haggles: Array<{ ids: string[]; steps: number; skill: HaggleSkill }>;
  // The viewer's own price at this shop, moved by a haggle they were at
  // the counter for, and that haggle's step (null: they have not haggled).
  yourMarkup: number;
  yourHaggle: number | null;
  // Where that haggle left the viewer's prices, in the server's words.
  yourPrices: string | null;
  haggleDc: number;
  // Whether the shop is where the party is now, which is where its counter
  // trades (the trade route asks the same). False only for a shop shown to
  // whoever steers the story, to prep it; absent from an older server.
  standsHere?: boolean;
};

type HaggleSkill = "persuasion" | "intimidation" | "deception";

// A haggle's outcome for the person who made it, in the rules' own words.
// `moved` is false at an end of the price ladder, where a step had nowhere
// to go; `prices` is where it left them, in the server's words.
function haggleOutcome(t: (key: string, vars?: Record<string, string | number>) => string, steps: number, moved: boolean, prices: string): string {
  if (steps < 0) {
    return moved ? t("market.haggle.downMoved", { prices }) : t("market.haggle.downStuck");
  }
  if (steps === 0) {
    return t("market.haggle.firm");
  }
  return moved ? t("market.haggle.badMoved", { prices }) : t("market.haggle.badStuck");
}

// Where the viewer's haggle left their prices, for the line under a shop.
function haggledLine(t: (key: string, vars?: Record<string, string | number>) => string, steps: number, prices: string): string {
  return steps < 0 ? t("market.haggle.lineDown", { prices }) : steps === 0 ? t("market.haggle.lineFirm") : t("market.haggle.lineUp", { prices });
}

const KINDS = ["general", "smith", "apothecary", "outfitter", "curiosities"] as const;
const SIZES = ["hamlet", "village", "town", "city"] as const;
// The kinds' and sizes' words by stored value; the keys live with the market.
// Shared with the shelf editor (MarketShopEditor.tsx).
export const KIND_KEYS: Record<(typeof KINDS)[number], "market.kind.general" | "market.kind.smith" | "market.kind.apothecary" | "market.kind.outfitter" | "market.kind.curiosities"> = {
  general: "market.kind.general",
  smith: "market.kind.smith",
  apothecary: "market.kind.apothecary",
  outfitter: "market.kind.outfitter",
  curiosities: "market.kind.curiosities",
};
export const SIZE_KEYS: Record<(typeof SIZES)[number], "market.size.hamlet" | "market.size.village" | "market.size.town" | "market.size.city"> = {
  hamlet: "market.size.hamlet",
  village: "market.size.village",
  town: "market.size.town",
  city: "market.size.city",
};

// The coin a price is mostly made of, so a chip leads with the right metal.
function coinGlyph(copper: number): string {
  return copper >= 100 ? "coin-gp" : copper >= 10 ? "coin-sp" : "coin-cp";
}

// The last Browse wares the Market answered. Kept outside the panel, which
// remounts each time its section is opened again, so a later visit to the
// Market is not taken for the same press.
let lastFocusedAt = 0;

export function MarketPanel({
  campaignId,
  steersStory,
  isDm = false,
  mySheet,
  refreshKey = 0,
  coins,
  focus = null,
  onAskKeeper,
}: {
  campaignId: string;
  // Story authority sees every shop and where it stands.
  steersStory: boolean;
  // Holds the DM seat. The server's word (`canPrep`) decides once the
  // market has loaded; this only covers the first paint.
  isDm?: boolean;
  mySheet: CharacterSheet | null;
  refreshKey?: number;
  coins?: { characterId: string; direction: "in" | "out"; at: number } | null;
  // A Browse wares from the chat: the heading takes focus and that shop
  // comes into view, once per press.
  focus?: MarketRequest | null;
  // Puts an action in the composer, for a sale only the DM can price.
  onAskKeeper?: (text: string) => void;
}) {
  const t = useT();
  const [shops, setShops] = useState<ShopView[] | null>(null);
  const [here, setHere] = useState<{ id: string; name: string } | null>(null);
  const [places, setPlaces] = useState<Named[]>([]);
  const [keepers, setKeepers] = useState<Named[]>([]);
  const [canPrep, setCanPrep] = useState(isDm);
  const [editing, setEditing] = useState("");
  const [details, setDetails] = useState<StockView | null>(null);
  // A refused or failed read is shown in the server's words with a way to
  // ask again, never as "nothing here yet" (issue 140).
  const { loaded, loadError, settle } = useLoadStatus();

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // A write that failed: the server's refusal, or no answer at all (audit
  // WA-05). Said as an alert, apart from the keeper's own words above.
  const [writeError, setWriteError] = useState("");
  const [opening, setOpening] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "general", size: "village", locationId: "", keeperNpcId: "", stockFromPack: true });
  const [reload, setReload] = useState(0);
  // Something the pack and the item's worth leave unpriced: the keeper
  // names a price, so the sale goes to whoever runs the story.
  const [unpriced, setUnpriced] = useState<{ shop: string; item: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState("");
  // Prices are the viewer's own (a haggle they were at the counter for), so
  // a Play as switch to another of their characters reads the shops again.
  const viewerId = mySheet?.id ?? "";

  useEffect(() => {
    let cancelled = false;
    readLoad<{ shops?: ShopView[]; here?: { id: string; name: string } | null; places?: Named[]; keepers?: Named[]; canPrep?: boolean }>(t,
      fetch(`/api/campaigns/${campaignId}/shops`),
      t("load.label.market"),
    ).then((outcome) => {
      if (cancelled) {
        return;
      }
      settle(outcome);
      if (outcome.payload) {
        setShops(outcome.payload.shops ?? []);
        setHere(outcome.payload.here ?? null);
        setPlaces(outcome.payload.places ?? []);
        setKeepers(outcome.payload.keepers ?? []);
        setCanPrep(outcome.payload.canPrep ?? isDm);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ campaignId, refreshKey, reload, settle, isDm, viewerId, t ]);
  // Create's Shop and the palette's New shop (audit WA-10). The Market sits
  // below Lore's entries in a workshop, so the form comes into view with its
  // name field ready. Unanswered until the shops have loaded, so the asker
  // tries again rather than giving up on a panel still on the wire.
  const nameRef = useRef<HTMLInputElement>(null);
  const [askedToOpen, setAskedToOpen] = useState(0);
  useTourPrepare((name) => {
    if (name !== "open-shop-editor" || shops === null || !canPrep) return;
    setOpening(true);
    setAskedToOpen((count) => count + 1);
    return true;
  });
  useEffect(() => {
    const input = nameRef.current;
    if (!askedToOpen || !input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
  }, [askedToOpen]);

  // Deferred a tick, as the hero page's heading is: the panel paints the
  // shops on the render that loads them, after this effect is scheduled.
  const loadedShops = shops !== null;
  useEffect(() => {
    if (!focus || !loadedShops || focus.at === lastFocusedAt) {
      return;
    }
    lastFocusedAt = focus.at;
    const id = window.setTimeout(() => {
      headingRef.current?.focus({ preventScroll: true });
      const section = listRef.current?.querySelector<HTMLElement>(`[data-shop-id="${CSS.escape(focus.shopId)}"]`);
      (section ?? headingRef.current)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setSpotlight(section ? focus.shopId : "");
    }, 0);
    return () => window.clearTimeout(id);
  }, [focus, loadedShops]);

  async function counter(shop: ShopView, action: "buy" | "sell" | "haggle", item = "", skill: HaggleSkill = "persuasion") {
    setBusy(`${shop.id}:${action}:${item}`);
    setError("");
    setWriteError("");
    setUnpriced(null);
    try {
      let response: Response;
      try {
        response = await fetch(`/api/campaigns/${campaignId}/shops/${shop.id}/trade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, item, qty: 1, characterId: mySheet?.id, ...(action === "haggle" ? { skill } : {}) }),
        });
      } catch {
        // The trade may have gone through before the answer was lost: the
        // shelf and the purse are read again before anything is tried twice.
        setWriteError(`${t("load.unreachable")} ${t("table.market.shelfReread")}`);
        setReload((current) => current + 1);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok && data.unpriced === true) {
        setUnpriced({ shop: shop.name, item });
      } else if (!response.ok) {
        setError(String(data.error ?? t("market.error.shakesHead")));
      } else if (action === "haggle") {
        // The haggler's new markup against the shop's own: equal when the
        // step met an end of the ladder.
        setError(haggleOutcome(t, Number(data.result?.steps) || 0, Number(data.result?.markup) !== shop.markup, String(data.result?.prices ?? "")));
      }
      setReload((current) => current + 1);
    } finally {
      setBusy("");
    }
  }

  async function open() {
    if (!draft.name.trim()) {
      return;
    }
    setBusy("open");
    setError("");
    setWriteError("");
    try {
      const sent = await readWrite<{ shop?: { id?: string } }>(t,
        fetch(`/api/campaigns/${campaignId}/shops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, locationId: draft.locationId || here?.id || "" }),
        }),
        t("load.write.shop"),
      );
      if (sent.error !== null) {
        // A shop whose answer was lost is looked for before anything is said,
        // so a second press never opens two. The form keeps what was typed.
        if (sent.unanswered) {
          const name = draft.name.trim();
          const reread = async () =>
            (await readLoad<{ shops?: ShopView[] }>(t, fetch(`/api/campaigns/${campaignId}/shops`), t("load.label.market"))).payload?.shops ?? null;
          const found = await findLostCreate(shops, reread, (shop) => shop.name === name);
          if (found === "made") {
            setOpening(false);
            setDraft({ name: "", kind: "general", size: "village", locationId: "", keeperNpcId: "", stockFromPack: true });
            setReload((current) => current + 1);
            return;
          }
          setWriteError(
            found === "missing"
              ? t("market.error.lostMissing")
              : t("market.error.lostUnknown"),
          );
          return;
        }
        setWriteError(sent.error);
        return;
      }
      const data = sent.payload;
      setOpening(false);
      setDraft({ name: "", kind: "general", size: "village", locationId: "", keeperNpcId: "", stockFromPack: true });
      // A shop started bare opens straight into its shelf.
      if (!draft.stockFromPack && data.shop?.id) {
        setEditing(String(data.shop.id));
      }
      setReload((current) => current + 1);
    } finally {
      setBusy("");
    }
  }

  async function close(shop: ShopView) {
    if (!(await appConfirm(t("market.close.title", { name: shop.name }), { actionLabel: t("market.close.action"), tone: "danger" }))) {
      return;
    }
    setWriteError("");
    const sent = await readWrite(t, fetch(`/api/campaigns/${campaignId}/shops/${shop.id}`, { method: "DELETE" }), t("load.write.closeShop", { name: shop.name }));
    if (sent.error !== null) setWriteError(sent.error);
    setReload((current) => current + 1);
  }

  const purse = mySheet ? mySheet.gold * 100 + mySheet.copper : 0;
  const coinFx = coins && mySheet && coins.characterId === mySheet.id ? coins : null;

  if (shops === null && loadError) {

    return <LoadFailed error={loadError} onRetry={() => setReload((current) => current + 1)} />;

  }

  if (shops === null) {
    return <PanelLoading label={t("market.loading")} />;
  }
  return (
    <div ref={listRef} className="space-y-2">
      {details ? (
        <InfoDialog
          open
          onOpenChange={(open) => !open && setDetails(null)}
          title={details.itemName}
          meta={t("market.detailsMeta", { price: formatPrice(details.askingCp), qty: details.qty })}
          note={details.note || undefined}
          reference={{ kind: "items", slug: contentSlug(details.itemName), name: details.itemName }}
          icon={cardArtwork({ kind: "item", key: details.itemName, family: "item-gear" })}
        />
      ) : null}
      <SectionHead
        headingRef={headingRef}
        title={t("table.side.market")}
        glyph="tab-market"
        aside={
          mySheet ? (
            <span key={coinFx?.at ?? 0} className="pk-chip relative py-0.5 text-xs text-amber-200">
              <GameIcon icon={{ kind: "glyph", key: "coin-purse" }} size="size-5" /> {formatCopper(purse)}
              {coinFx ? <span aria-hidden className={cn("coin-arc pointer-events-none absolute -left-3 top-1/2 text-amber-300", coinFx.direction === "out" && "coin-arc-out")}>●</span> : null}
            </span>
          ) : null
        }
      />
      {here ? <p className="-mt-1 text-xs text-stone-500">{t("market.at", { name: here.name })}</p> : null}
      {error ? <p role="status" className="live-in text-xs text-amber-300/90">{error}</p> : null}
      {writeError ? <PanelError>{writeError}</PanelError> : null}
      {unpriced ? (
        <p role="status" className="live-in flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-300/90">
          <span className="min-w-0">{t("market.unpriced.line", { item: unpriced.item })}</span>
          {onAskKeeper ? (
            <KitButton onClick={() => onAskKeeper(t("market.unpriced.compose", { item: unpriced.item, shop: unpriced.shop }))}>
              {t("market.unpriced.ask")}
            </KitButton>
          ) : null}
        </p>
      ) : null}
      {canPrep ? (
        opening ? (
          <div className="panel reveal flex flex-wrap items-center gap-1.5 rounded-lg p-2.5">
            <input ref={nameRef} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} placeholder={t("market.open.namePlaceholder")} aria-label={t("market.open.nameAria")} className={cn(panelField, "min-w-[9rem] flex-1")} />
            <Select size="sm" label={t("market.open.kind")} value={draft.kind} options={KINDS.map((kind) => ({ value: kind as string, label: t(KIND_KEYS[kind]) }))} onChange={(kind) => setDraft({ ...draft, kind })} className="pk-w-28" />
            <Select size="sm" label={t("market.open.size")} value={draft.size} options={SIZES.map((size) => ({ value: size as string, label: t(SIZE_KEYS[size]) }))} onChange={(size) => setDraft({ ...draft, size })} className="pk-w-24" />
            {places.length ? (
              <Select
                size="sm"
                label={t("market.open.where")}
                value={draft.locationId || here?.id || ""}
                options={[{ value: "", label: t("market.open.noPlace") }, ...places.map((place) => ({ value: place.id, label: place.name, icon: { kind: "glyph" as const, key: "tab-map" } }))]}
                onChange={(locationId) => setDraft({ ...draft, locationId })}
                className="min-w-[9rem] flex-1"
              />
            ) : null}
            {keepers.length ? (
              <Select
                size="sm"
                label={t("market.open.keeper")}
                value={draft.keeperNpcId}
                options={[{ value: "", label: t("market.open.nobody") }, ...keepers.map((npc) => ({ value: npc.id, label: npc.name, icon: { kind: "glyph" as const, key: "system-cast" } }))]}
                onChange={(keeperNpcId) => setDraft({ ...draft, keeperNpcId })}
                className="min-w-[9rem] flex-1"
              />
            ) : null}
            <SettingToggle on={draft.stockFromPack} onToggle={() => setDraft({ ...draft, stockFromPack: !draft.stockFromPack })}>
              {t("market.open.stockPack")}
            </SettingToggle>
            {draft.stockFromPack ? null : <span className="live-in basis-full text-[11px] text-stone-500">{t("market.open.bareNote")}</span>}
            <KitButton tone="primary" disabled={busy === "open" || !draft.name.trim()} busy={busy === "open"} onClick={() => void open()}>
              {t("market.open.action")}
            </KitButton>
            <KitButton onClick={() => setOpening(false)}>{t("action.cancel")}</KitButton>
          </div>
        ) : (
          <KitButton data-tour="market-open" onClick={() => setOpening(true)}>
            <Plus className="size-3.5" /> {here ? t("market.open.at", { name: here.name }) : t("market.open.label")}
          </KitButton>
        )
      ) : null}
      {!shops.length ? (
        loadError ? (
          <LoadFailed error={loadError} onRetry={() => setReload((current) => current + 1)} />
        ) : loaded ? (
          <EmptyState size="sm" art="chest" title={here ? t("market.empty.here", { name: here.name }) : canPrep ? t("market.empty.none") : t("market.empty.nowhere")} />
        ) : null
      ) : null}
      {shops.map((shop) => {
        // A shop elsewhere (shown to whoever steers the story, to prep it)
        // offers no counter: the server would refuse the trade until the
        // party is there.
        const trades = Boolean(mySheet) && shop.standsHere !== false;
        const canHaggle = Boolean(trades && mySheet && !shop.haggledBy.includes(mySheet.id));
        // A keeper falls for a lie once: after one Deception here, nobody may try another.
        const canDeceive = canHaggle && !shop.haggles.some((deal) => deal.skill === "deception");
        // The haggle's skills: the menu beside Haggle and the shop's own
        // right-click or long-press menu offer the same list.
        const haggleItems: ContextMenuItem[] = canHaggle
          ? [
              { id: "haggle", label: t("market.haggle.persuasion"), glyph: "skill-persuasion", disabled: Boolean(busy), onSelect: () => void counter(shop, "haggle") },
              { id: "haggle-intimidation", label: t("market.haggle.intimidation"), glyph: "skill-intimidation", disabled: Boolean(busy), onSelect: () => void counter(shop, "haggle", "", "intimidation") },
              ...(canDeceive ? [{ id: "haggle-deception", label: t("market.haggle.deception"), glyph: "skill-deception", disabled: Boolean(busy), onSelect: () => void counter(shop, "haggle", "", "deception") }] : []),
            ]
          : [];
        const shopItems: ContextMenuItem[] = [
          ...haggleItems,
          ...(canPrep ? [{ id: "edit", label: t("market.menu.edit"), glyph: "ui-edit", separated: canHaggle, onSelect: () => setEditing(shop.id) }] : []),
          ...(canPrep ? [{ id: "close", label: t("market.close.menu", { name: shop.name }), glyph: "ui-lock", tone: "danger" as const, onSelect: () => void close(shop) }] : []),
        ];
        if (editing === shop.id) {
          return (
            <MarketShopEditor
              key={shop.id}
              campaignId={campaignId}
              shop={shop}
              places={places}
              keepers={keepers}
              onSaved={() => {
                setEditing("");
                setReload((current) => current + 1);
              }}
              onCancel={() => setEditing("")}
            />
          );
        }
        return (
          <section key={shop.id} data-shop-id={shop.id} data-spotlight={spotlight === shop.id ? "" : undefined} className={cn("panel @container space-y-2 rounded-lg p-2.5", spotlight === shop.id && "ring-1 ring-amber-400/60")}>
            <ContextMenu items={shopItems} label={shop.name} className="group flex items-center gap-2">
              {shop.keeperPortrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.keeperPortrait} alt="" className="size-10 rounded-full border border-amber-500/40 object-cover shadow-[0_2px_8px_rgba(4,2,12,0.5)]" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full border border-amber-500/25 bg-stone-900/70">
                  <GameIcon icon={{ kind: "glyph", key: "tab-shop" }} size="size-7" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {/* Wrapped, not cut: beside Haggle and the prep buttons a
                    20rem panel leaves a name and its markup a few letters. */}
                <p className="gold-title break-words text-sm leading-tight">{shop.name}</p>
                <p className="text-pretty break-words text-[11px] leading-snug text-stone-500">
                  {KIND_KEYS[shop.kind as keyof typeof KIND_KEYS] ? t(KIND_KEYS[shop.kind as keyof typeof KIND_KEYS]) : shop.kind}
                  {shop.keeperName ? t("market.keptBy", { name: shop.keeperName }) : ""}
                  {steersStory && shop.locationName ? ` ${t("market.at", { name: shop.locationName })}` : ""}
                  {shop.yourMarkup !== 1 ? t("market.pricesPct", { pct: `${shop.yourMarkup > 1 ? "+" : ""}${Math.round((shop.yourMarkup - 1) * 100)}` }) : ""}
                  {shop.kind === "curiosities" || shop.kind === "apothecary" ? (
                    <>
                      {" · "}
                      {/* A finger-sized target (40px) that keeps the line's height. */}
                      <GameTerm id="magic_item_prices" className="-my-3.5 inline-block py-3.5">
                        {t("market.magicPriced")}
                      </GameTerm>
                    </>
                  ) : null}
                </p>
              </div>
              {canHaggle ? (
                <>
                  <KitButton disabled={Boolean(busy)} busy={busy === `${shop.id}:haggle:`} onClick={() => void counter(shop, "haggle")}>
                    {t("market.haggle.button")}
                  </KitButton>
                  {/* One tap haggles by Persuasion; this door opens the other
                      skills, the same list the shop's own menu holds. */}
                  <RowMenu
                    items={haggleItems}
                    label={t("market.haggle.atMenu", { name: shop.name })}
                    trigger={{ label: t("market.haggle.otherSkill"), icon: <ChevronDown className="size-4" aria-hidden="true" /> }}
                    className="-ml-1.5"
                  />
                </>
              ) : null}
              {canPrep ? (
                <>
                  <KitButton tone="icon" always aria-label={t("market.editAria", { name: shop.name })} onClick={() => setEditing(shop.id)}>
                    <Pencil className="size-3.5" />
                  </KitButton>
                  <KitButton tone="iconDanger" always aria-label={t("market.closeAria", { name: shop.name })} onClick={() => void close(shop)}>
                    <Trash2 className="size-3.5" />
                  </KitButton>
                </>
              ) : null}
            </ContextMenu>
            {canHaggle ? (
              <p data-haggle-rules="" className="text-pretty text-[11px] leading-snug text-stone-500">
                {t("market.haggle.rules", { dc: shop.haggleDc })}
              </p>
            ) : mySheet && shop.standsHere === false ? (
              <p data-shop-away="" className="text-pretty text-[11px] leading-snug text-stone-500">
                {shop.locationName
                  ? t("market.away.named", { place: shop.locationName })
                  : t("market.away.noPlace")}
              </p>
            ) : mySheet && shop.yourHaggle !== null ? (
              <p data-haggle-rules="" className="text-[11px] leading-snug text-stone-500">
                {haggledLine(t, shop.yourHaggle, shop.yourPrices ?? "")}
              </p>
            ) : null}
            {/* Columns follow the panel, not the window: the side panel is
                narrow on the widest screen, and three columns there left
                no room for a price. */}
            <ul className="stagger-up grid grid-cols-2 gap-1.5 @lg:grid-cols-3">
              {shop.stock.map((line) => {
                const buying = busy === `${shop.id}:buy:${line.itemName}`;
                const cannotBuy = Boolean(busy) || purse < line.askingCp;
                return (
                  <ContextMenu
                    as="li"
                    key={line.itemName}
                    label={line.itemName}
                    items={[
                      { id: "details", label: t("market.details"), glyph: "system-rules", onSelect: () => setDetails(line) },
                      ...(trades ? [{ id: "buy", label: t("market.buyFor", { price: formatPrice(line.askingCp) }), glyph: coinGlyph(line.askingCp), disabled: cannotBuy, onSelect: () => void counter(shop, "buy", line.itemName) }] : []),
                    ]}
                    className="flex flex-col justify-between rounded-lg border border-stone-700/60 bg-stone-900/50 p-2 transition-transform duration-[var(--dur-quick,150ms)] hover:-translate-y-0.5 hover:border-amber-500/40"
                  >
                    <button
                      type="button"
                      onClick={() => setDetails(line)}
                      aria-label={t("market.detailsAria", { item: line.itemName })}
                      className="pk-tap flex min-w-0 items-center gap-1.5 rounded text-left text-xs text-stone-200 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    >
                      <GameIcon icon={{ kind: "item", key: line.itemName, family: "item-gear" }} size="size-7" />
                      <span className="truncate">{line.itemName}</span>
                      <Info aria-hidden className="size-3.5 shrink-0 text-stone-500" />
                    </button>
                    <span className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                      <span className="pk-chip max-w-full whitespace-normal text-amber-200">
                        <GameIcon icon={{ kind: "glyph", key: coinGlyph(line.askingCp) }} size="size-4" />
                        {formatPrice(line.askingCp)}
                      </span>
                      <span className="text-[11px] tabular-nums text-stone-500">x{line.qty}</span>
                    </span>
                    {trades ? (
                      <KitButton disabled={cannotBuy} busy={buying} onClick={() => void counter(shop, "buy", line.itemName)} className="mt-1.5 w-full justify-center border-amber-500/30 text-amber-100">
                        {buying ? null : t("market.buy")}
                      </KitButton>
                    ) : null}
                  </ContextMenu>
                );
              })}
              {!shop.stock.length ? <li className="col-span-full text-xs italic text-stone-500">{t("market.bareShelves")}</li> : null}
            </ul>
            {shop.buys && trades && mySheet?.equipment.length ? (
              <details className="group/sell text-xs">
                <summary className="pk-link pk-tap flex cursor-pointer list-none items-center gap-1">
                  <GameIcon icon={{ kind: "glyph", key: "tab-trade" }} size="size-5" /> {t("market.sell")}
                  <ChevronDown className="size-3.5 transition-transform group-open/sell:rotate-180" />
                </summary>
                <ul className="stagger mt-1.5 flex flex-wrap gap-1">
                  {mySheet.equipment.map((item) => (
                    <li key={item.name}>
                      <KitButton disabled={Boolean(busy)} onClick={() => void counter(shop, "sell", item.name)}>
                        <GameIcon icon={{ kind: "item", key: item.name, family: "item-gear" }} size="size-4" />
                        {item.name}
                        {item.qty > 1 ? ` x${item.qty}` : ""}
                      </KitButton>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
