import { Composer } from "grammy";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "المواد الأدبية", data: "subject:literature" }) if the toolkit exposes it.

const composer = new Composer();

composer.callbackQuery("subject:literature", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("فتح قائمة المواد الأدبية مع أزرار قابلة للتمرير");
});

export default composer;
