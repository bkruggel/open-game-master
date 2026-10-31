import type { SystemId } from "@/app/workshop/[workshopId]/systems";
import type { MessageKey } from "@/lib/messages/en";

// What the workshop's Create chooser offers (audit finding WF-08). WorldForge
// pulls entries out of notes; it does not make playable things, and a World
// type called Monster or Item adds no stat block. So Create starts from what
// the author wants to end up with, says where it will live, and sends them
// to the tool that already makes it: its own editor, validation and store.
// It is a router, not another editor. Pure: the chooser
// (src/app/workshop/[workshopId]/CreateChooser.tsx) draws it, and
// scripts/test-create-chooser.mjs checks that every way in is answered.

// How a thing gets made. "extract" is WorldForge's Forge, which keeps only
// what the notes say; "draft" asks a model to write from a line. A world
// drafted from an idea (WorldForge's Outline view) is reviewed before
// anything is made, and its creatures and items go through the Bestiary's
// and Homebrew's own validators.
export type CreateWay = "blank" | "copy" | "upload" | "draft" | "extract";

// The words live in the dictionaries under `workshop.create.*`, the way the
// settings page's agent scopes do: this data keeps ids, and the chooser
// reads the labels with the translator it already holds, so a language
// switch rewords the chooser with the rest of the workshop.
export const WAY_KEYS: Record<CreateWay, MessageKey> = {
  blank: "workshop.create.way.blank",
  copy: "workshop.create.way.copy",
  upload: "workshop.create.way.upload",
  draft: "workshop.create.way.draft",
  extract: "workshop.create.way.extract",
};

export type CreateStep = {
  // The step's own id, the label and detail's place in the dictionaries
  // (`workshop.create.<choice>.<step>.label`).
  id: string;
  ways: CreateWay[];
  // A workshop tool (and WorldForge's view), asked to open its own editor
  // by the name its panel answers (src/lib/tours/prepare.ts); or a page
  // outside the workshop.
  system?: SystemId;
  view?: string;
  prepare?: string;
  href?: string;
  // The model the step cannot work without: off when the server has none.
  needs?: "story";
  // The model its "draft" way uses; the way is not offered without it.
  drafts?: "story" | "images";
};

export type CreateGroup = "world" | "playable" | "picture";

export const GROUP_KEYS: Record<CreateGroup, MessageKey> = {
  world: "workshop.create.group.world",
  playable: "workshop.create.group.playable",
  picture: "workshop.create.group.picture",
};

export type CreateChoice = {
  id: string;
  group: CreateGroup;
  steps: CreateStep[];
};

export const CREATE_CHOICES: CreateChoice[] = [
  {
    id: "outline",
    group: "world",
    steps: [
      {
        id: "draft",
        ways: ["draft"],
        system: "world",
        view: "outline",
        needs: "story",
        drafts: "story",
      },
      {
        id: "extract",
        ways: ["extract"],
        system: "world",
        view: "forge",
        needs: "story",
      },
      {
        id: "entry",
        ways: ["blank"],
        system: "world",
        view: "wiki",
        prepare: "open-world-entry",
      },
    ],
  },
  {
    id: "npc",
    group: "world",
    steps: [
      {
        id: "editor",
        ways: ["blank", "draft"],
        system: "cast",
        prepare: "open-npc-editor",
        drafts: "story",
      },
    ],
  },
  {
    id: "place",
    group: "world",
    steps: [
      {
        id: "name",
        ways: ["blank"],
        system: "world",
        view: "wiki",
        prepare: "open-world-entry:location",
      },
    ],
  },
  {
    id: "pc",
    group: "playable",
    steps: [
      {
        id: "build",
        ways: ["blank"],
        // A player character, so the builder does not ask (door.ts).
        href: "/characters/new?as=pc",
      },
      {
        id: "pregen",
        ways: ["copy", "blank"],
        system: "party",
      },
    ],
  },
  {
    id: "creature",
    group: "playable",
    steps: [
      {
        id: "build",
        ways: ["blank", "copy"],
        system: "bestiary",
        prepare: "open-monster-build",
      },
    ],
  },
  {
    id: "item",
    group: "playable",
    steps: [
      {
        id: "editor",
        ways: ["blank", "copy"],
        system: "homebrew",
        prepare: "open-homebrew-editor:item",
      },
    ],
  },
  {
    // The Market lives under Lore, below its entries; without this way in,
    // an author looking for shops found no tool for them (audit WA-10).
    id: "shop",
    group: "playable",
    steps: [
      {
        id: "open",
        ways: ["blank"],
        system: "lore",
        prepare: "open-shop-editor",
      },
    ],
  },
  {
    id: "spell",
    group: "playable",
    steps: [
      {
        id: "editor",
        ways: ["blank", "copy"],
        system: "homebrew",
        prepare: "open-homebrew-editor:spell",
      },
    ],
  },
  {
    id: "option",
    group: "playable",
    steps: [
      {
        id: "editor",
        ways: ["blank", "copy"],
        system: "homebrew",
        prepare: "open-homebrew-editor:feat",
      },
    ],
  },
  {
    id: "region",
    group: "playable",
    steps: [
      {
        id: "open",
        ways: ["blank"],
        system: "region",
      },
    ],
  },
  {
    id: "map",
    group: "playable",
    steps: [
      {
        id: "make",
        ways: ["blank", "upload"],
        system: "maps",
        prepare: "open-map-create",
      },
    ],
  },
  {
    id: "encounter",
    group: "playable",
    steps: [
      {
        id: "editor",
        ways: ["blank"],
        system: "encounters",
        prepare: "open-encounter-editor",
      },
    ],
  },
  {
    id: "table",
    group: "playable",
    steps: [
      {
        id: "editor",
        ways: ["blank", "draft"],
        system: "tables",
        prepare: "open-table-editor",
        drafts: "story",
      },
    ],
  },
  {
    id: "illustration",
    group: "picture",
    steps: [
      {
        id: "portrait",
        ways: ["upload", "draft"],
        system: "cast",
        drafts: "images",
      },
      {
        id: "atlas",
        ways: ["upload"],
        system: "world",
        view: "atlas",
      },
      {
        id: "backdrop",
        ways: ["upload"],
        system: "region",
      },
    ],
  },
];

// What a choice says: its name, what it is, and where it lands, in the hub's
// own words. Each reads the dictionary by the choice's id.
type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function choiceLabel(t: Translator, id: string): string {
  return t(`workshop.create.${id}.label`);
}

export function choiceBlurb(t: Translator, id: string): string {
  return t(`workshop.create.${id}.blurb`);
}

// Where the result lives, in the words the hub uses.
export function choiceLands(t: Translator, id: string): string {
  return t(`workshop.create.${id}.lands`);
}

export function stepLabel(t: Translator, choiceId: string, stepId: string): string {
  return t(`workshop.create.${choiceId}.${stepId}.label`);
}

export function stepDetail(t: Translator, choiceId: string, stepId: string): string {
  return t(`workshop.create.${choiceId}.${stepId}.detail`);
}

// The ways a step offers on this server: drafting only where its model is.
export function offeredWays(step: CreateStep, models: { story: boolean; images: boolean }): CreateWay[] {
  return step.ways.filter((way) => way !== "draft" || !step.drafts || models[step.drafts]);
}

// A step the server cannot do at all: every way it has needs a missing model.
export function stepUnavailable(step: CreateStep, models: { story: boolean; images: boolean }): boolean {
  return (step.needs !== undefined && !models[step.needs]) || offeredWays(step, models).length === 0;
}

// Why a way is missing, and how to get it: what a server without AI still
// offers, and where an admin switches drafting on. Keys, read with the
// translator (`workshop.create.needs.*`).
export const ENABLE_DRAFT_KEYS: Record<"story" | "images", MessageKey> = {
  story: "workshop.create.needs.story",
  images: "workshop.create.needs.images",
};

// The models a choice would draft with that this server lacks: one line
// each in the chooser, so a missing "Draft with AI" is explained, not just
// absent.
export function missingModels(choice: CreateChoice, models: { story: boolean; images: boolean }): Array<"story" | "images"> {
  const wanted = new Set(choice.steps.flatMap((step) => [step.needs, step.drafts]).filter((model): model is "story" | "images" => model !== undefined));
  return [...wanted].filter((model) => !models[model]);
}
