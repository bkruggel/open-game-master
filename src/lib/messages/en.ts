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
} as const;

export type MessageDictionary = typeof en;
export type MessageKey = keyof MessageDictionary;
