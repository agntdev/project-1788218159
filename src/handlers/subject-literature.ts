import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { showSubjects } from "./library.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "المواد الأدبية", data: "subject:literature" }) if the toolkit exposes it.

registerMainMenuItem({ label: "المواد الأدبية", data: "subject:literature", order: 20 });
const composer = new Composer<Ctx>();

composer.callbackQuery("subject:literature", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSubjects(ctx, "literature");
});

export default composer;
