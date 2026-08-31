import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "تواصل مع الإدارة", data: "contact_admin" }) if the toolkit exposes it.

registerMainMenuItem({ label: "تواصل مع الإدارة", data: "contact_admin", order: 30 });
const composer = new Composer<Ctx>();

composer.callbackQuery("contact_admin", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!adminChatId(ctx)) {
    await ctx.reply("التواصل مع الإدارة غير مُعدّ بعد. جرّب لاحقًا.");
    return;
  }
  ctx.session.step = "contact";
  await ctx.reply("اكتب رسالتك للإدارة وسأوصلها كما هي.", {
    reply_markup: inlineKeyboard([[inlineButton("إلغاء", "menu:main")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "contact") return next();
  const text = ctx.message.text.trim();
  if (!text) { await ctx.reply("اكتب رسالتك بكلمات واضحة ثم أرسلها."); return; }
  const owner = adminChatId(ctx);
  if (!owner) { ctx.session.step = undefined; await ctx.reply("التواصل مع الإدارة غير مُعدّ بعد. جرّب لاحقًا."); return; }
  try {
    await ctx.api.forwardMessage(owner, ctx.chat.id, ctx.message.message_id);
    ctx.session.step = undefined;
    await ctx.reply("وصلت رسالتك إلى الإدارة. ستتواصل معك عند الحاجة.");
  } catch {
    await ctx.reply("تعذّر إرسال رسالتك الآن. جرّب مرة أخرى بعد قليل.");
  }
});

export default composer;
