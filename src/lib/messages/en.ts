// The English dictionary, the source every other language falls back to.
// Keys are flat and dotted by screen (`settings.profile.title`), so a grep
// on a key finds every language that translates it and every call that uses
// it. A placeholder reads `{name}` and is filled by the caller; a string
// whose key ends in `_one`/`_other` is a plural pair picked by the locale's
// own rule (see messages-logic.ts).
export const en = {
  // Shared actions and words.
  "action.loading": "Loading…",
  "action.reset": "Reset",
  "action.remove": "Remove",
  "action.cancel": "Cancel",
  "action.change": "Change",
  "action.clear": "Clear",
  "action.done": "Done",
  "action.customize": "Customize",
  "action.connect": "Connect",

  // Account menu (the avatar's dropdown, on every flat page).
  "menu.account.aria": "Account",
  "menu.tooltip": "Account and app menu",
  "menu.role.admin": "Keeper of this server",
  "menu.role.player": "Adventurer",
  "menu.allCampaigns": "All campaigns",
  "menu.characters": "Characters",
  "menu.rulebook": "Rulebook",
  "menu.friends": "Friends",
  "menu.settings": "Settings",
  "menu.adminPanel": "Admin panel",
  "menu.help": "Help",
  "menu.about": "About",
  "menu.aboutServer": "About this server",
  "menu.appHome": "App home",
  "menu.appSettings": "App settings",
  "menu.appGuide": "App guide",
  "menu.logOut": "Log out",
  "menu.appHome.tooltip": "Back to the app's home screen",
  "menu.appHome.aria": "App home",

  // The settings page and its sections.
  "settings.title": "Account settings",
  "settings.signedInAs": "Signed in as {name}",
  "settings.adminPanel": "Admin panel",
  "settings.nav.profile": "Profile",
  "settings.nav.dice": "Dice",
  "settings.nav.signin": "Sign-in",
  "settings.nav.appearance": "Appearance",
  "settings.nav.language": "Language",
  "settings.nav.dictation": "Dictation",
  "settings.nav.blocked": "Blocked",
  "settings.nav.agents": "Agents",
  "settings.nav.account": "Account",

  "settings.profile.title": "Profile picture",
  "settings.profile.add": "Add picture",
  "settings.profile.change": "Change picture",
  "settings.profile.avatarAlt": "Your avatar",
  "settings.profile.hint":
    "Shown next to your name in lobbies and at the table. Character portraits are set on each character.",

  "settings.dice.title": "Your dice",
  "settings.dice.intro":
    "The virtual dice that tumble across every table you sit at. Follows your account on this server, on every device.",

  "settings.password.title": "Password",
  "settings.password.setTitle": "Set a password",
  "settings.password.submit": "Set password",
  "settings.password.discordHint":
    "You sign in with Discord. Set a password to also log in with your username, for example in the desktop and mobile apps.",
  "settings.password.saved": "Password saved. Other devices were signed out.",

  "settings.discord.title": "Discord",
  "settings.discord.linked": "Linked. You can sign in with Discord.",
  "settings.discord.link": "Link Discord account",
  "settings.discord.notice.linked": "Discord account linked.",
  "settings.discord.notice.taken": "That Discord account is already linked to another user.",

  "settings.deletion.scheduledTitle": "Deletion scheduled",
  "settings.deletion.scheduledRibbon": "Pending",
  "settings.deletion.scheduledIntro":
    "This account will be permanently deleted on {date}. Until then everything still works, and you can call it off.",
  "settings.deletion.keep": "Keep my account",
  "settings.deletion.title": "Delete account",
  "settings.deletion.ribbon": "Irreversible",
  "settings.deletion.graceImmediate":
    "Your account, the campaigns you created, your characters and your pictures are erased immediately.",
  "settings.deletion.graceCopy_one":
    "Your account is signed out everywhere and erased after {count} day, together with the campaigns you created, your characters and your pictures. Signing in before then lets you keep it.",
  "settings.deletion.graceCopy_other":
    "Your account is signed out everywhere and erased after {count} days, together with the campaigns you created, your characters and your pictures. Signing in before then lets you keep it.",
  "settings.deletion.confirmError": "Could not delete your account.",
  "settings.deletion.purged":
    "Your account and everything it owned have been deleted. ",
  "settings.deletion.scheduledNotice":
    "Your account is scheduled for deletion on {date}. You have been signed out everywhere. To keep it, sign in again before then and choose \"Keep my account\". ",
  "settings.deletion.back": "Back to the front door",
  "settings.deletion.logInFirst": "Log in",
  "settings.deletion.logInToManage": "to manage your account.",

  "settings.about.title": "About",
  "settings.about.rulebook": "Rulebook",
  "settings.about.reference": "Rules reference",
  "settings.about.terms": "Terms of service",
  "settings.about.privacy": "Privacy policy",
  "settings.about.licenses": "Licenses and attribution",

  // Appearance (the section the language setting sits beside).
  "appearance.title": "Appearance",
  "appearance.intro":
    "Kept on this device. The board and its canvases draw at their own size whatever the scale.",
  "appearance.theme.aria": "Theme",
  "appearance.theme.auto": "Follow the system",
  "appearance.theme.dark": "Arcane night",
  "appearance.theme.light": "Parchment day",
  "appearance.scale": "Interface scale",

  // Language (new section, same on-device contract as the theme).
  "language.title": "Language",
  "language.intro":
    "The language of the menus and screens, kept on this device. The Game Master narrates in whatever language the table speaks.",
  "language.aria": "Language",
  "language.auto": "Follow the browser",
  "language.english": "English",
  "language.french": "Français",

  // The password form (account settings and the forced reset flow).
  "password.current": "Current password",
  "password.new": "New password",
  "password.confirm": "Confirm new password",
  "password.change": "Change password",
  "password.mismatch": "New passwords don't match.",
  "password.changeFailed": "Could not change the password.",
  "password.unreachable": "Could not reach the server.",

  // The hold-to-dictate key.
  "dictation.title": "Dictation key",
  "dictation.intro":
    "Kept on this device. A key you hold to speak into the table's message box instead of holding the mic. Nothing is sent until you press Send.",
  "dictation.noneSet": "None set",
  "dictation.setKey": "Set a key",
  "dictation.pressKeys": "Press the keys...",
  "dictation.holding": "{held}+...",
  "dictation.saved": "Saved on this device",
  "dictation.listeningHint":
    "Hold Ctrl or Alt with a letter, or press a key that does not type, such as F8 or F9. Escape stops listening.",
  "dictation.holdHint":
    "Hold it at the table, in the message box or anywhere outside another field, to speak as the mic button does. Let go and the words wait in the box; only Send sends them.",

  // Blocked players.
  "blocked.title": "Blocked players",
  "blocked.intro":
    "Blocked players' table messages are hidden from you, and neither of you can open a private chat or send a friend request. Block someone from their message or from the party list.",
  "blocked.loading": "Loading blocked players",
  "blocked.nobody": "Nobody blocked.",
  "blocked.unblock": "Unblock",

  // Connected agents.
  "agents.title": "Connected agents",
  "agents.intro":
    "Let your own Claude Code, Codex or other MCP client act as you here: read your campaigns, play your character, or run a table where you are the Game Master. It gets exactly the access your account has, only the parts you tick, and never your password or the server's settings.",
  "agents.introAssistant":
    " Let ChatGPT, Claude, Grok and Meta Muse act as you too, through the link shown when you connect.",
  "agents.loading": "Loading connected agents",
  "agents.nobody": "No agents connected.",
  "agents.readyBody": "is ready. This is the only time its token is shown; copy the line for your agent now.",
  "agents.copied": "I have copied it",
  "agents.rowMeta": "last used {last} · expires {expires}",
  "agents.never": "never",
  "agents.oneCampaign": "one campaign",
  "agents.pollLink": "Poll link",
  "agents.revoke": "Revoke",
  "agents.connectAnAgent": "Connect an agent",
  "agents.name": "Name",
  "agents.namePlaceholder": "Claude Code on my laptop",
  "agents.whatMayDo": "What it may do",
  "agents.limitToCampaign": "Limit to one campaign",
  "agents.anyCampaign": "Any campaign I belong to",
  "agents.createFailed": "Could not connect an agent.",
  "agents.scope.read.label": "Read",
  "agents.scope.read.hint": "Your campaigns, characters, quests and lore, as you see them.",
  "agents.scope.play.label": "Play",
  "agents.scope.play.hint": "Act, speak and roll at a table as your character.",
  "agents.scope.characters.label": "Characters",
  "agents.scope.characters.hint": "Create, edit and delete your library characters.",
  "agents.scope.campaigns.label": "Campaigns",
  "agents.scope.campaigns.hint": "Create campaigns and change the ones you lead.",
  "agents.scope.dm.label": "Game Master",
  "agents.scope.dm.hint": "Run the rules engine and narrate, only where you hold the GM seat.",

  // The player's dice: the sets, the looks and the editor's words.
  "dice.summary.named": "{name} dice",
  "dice.summary.own": "Your own colours",
  "dice.summary.look": "{texture} pattern, {material} finish",
  "dice.customizeButton": "Customise my dice",
  "dice.customizeTitle": "Choose the colours, pattern and finish of your virtual dice.",
  "dice.followAccount": "Your dice follow your account: every table and every device shows them.",
  "dice.startFrom": "Start from",
  "dice.namedAria": "{name} dice",
  "dice.dieColour": "Die colour",
  "dice.numberColour": "Number colour",
  "dice.numberOutline": "Number outline",
  "dice.outlineColour": "Outline colour",
  "dice.outlineSwitch": "Outline the numbers",
  "dice.pattern": "Pattern",
  "dice.finish": "Finish",
  "dice.webgl": "The 3D preview needs WebGL. Your choices still apply at the table.",
  "dice.preset.radiant": "Radiant",
  "dice.preset.fire": "Fire",
  "dice.preset.ice": "Ice",
  "dice.preset.poison": "Poison",
  "dice.preset.acid": "Acid",
  "dice.preset.thunder": "Thunder",
  "dice.preset.air": "Air",
  "dice.preset.water": "Water",
  "dice.preset.earth": "Earth",
  "dice.preset.force": "Force",
  "dice.preset.necrotic": "Necrotic",
  "dice.preset.bloodmoon": "Blood moon",
  "dice.preset.starrynight": "Starry night",
  "dice.preset.glitterparty": "Glitter party",
  "dice.preset.astralsea": "Astral sea",
  "dice.preset.dragon": "Dragon",
  "dice.preset.bronze": "Bronze",
  "dice.preset.onyx": "Onyx",
  "dice.preset.ivory": "Ivory",
  "dice.texture.none": "Plain",
  "dice.texture.paper": "Paper",
  "dice.texture.marble": "Marble",
  "dice.texture.cloudy": "Clouds",
  "dice.texture.speckles": "Speckles",
  "dice.texture.glitter": "Glitter",
  "dice.texture.stars": "Stars",
  "dice.texture.stainedglass": "Stained glass",
  "dice.texture.wood": "Wood grain",
  "dice.texture.metal": "Brushed metal",
  "dice.texture.fire": "Fire",
  "dice.texture.ice": "Ice",
  "dice.texture.water": "Water",
  "dice.texture.astral": "Astral",
  "dice.texture.skulls": "Skulls",
  "dice.texture.dragon": "Dragon scale",
  "dice.texture.leopard": "Leopard",
  "dice.material.plastic": "Plastic",
  "dice.material.glass": "Glass",
  "dice.material.metal": "Metal",
  "dice.material.wood": "Wood",
  "dice.material.none": "Matte",
} as const;

export type MessageDictionary = typeof en;
export type MessageKey = keyof MessageDictionary;
