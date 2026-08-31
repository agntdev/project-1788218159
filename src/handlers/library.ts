import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton, inlineKeyboard, paginate, readLibrary, writeLibrary, recordId, nowIso,
  type LibraryData, type LibraryFile, type LibrarySubject, type SubjectKind, requireOwner,
  registerMainMenuItem, adminChatId,
} from "../toolkit/index.js";

declare module "../bot.js" {
  interface Session {
    step?: "contact" | "admin-subject-name" | "admin-file" | "admin-title" | "admin-description";
    subjectId?: string;
    sectionId?: string;
    pendingFile?: { fileId: string; kind: "document" | "photo"; fileName?: string };
    pendingTitle?: string;
    replaceFileId?: string;
  }
}

registerMainMenuItem({ label: "إدارة المحتوى", data: "admin:open", order: 90 });

const composer = new Composer<Ctx>();
const back = [inlineButton("العودة للقائمة", "menu:main")];
const unavailable = "المكتبة ليست جاهزة الآن. جرّب مرة أخرى بعد قليل.";
const adminCopy = { unset: "صلاحية الإدارة غير مُعدّة بعد.", denied: "هذه المساحة مخصّصة للإدارة فقط." };
const sectionTemplates = [
  { name: "كتب", icon: "📚" }, { name: "مذكرات", icon: "📝" }, { name: "أخرى", icon: "📄" },
];

function subjectLabel(subject: LibrarySubject): string { return subject.name; }
function byNewest(a: LibraryFile, b: LibraryFile): number { return b.addedAt.localeCompare(a.addedAt); }
function keyboard(rows: ReturnType<typeof inlineButton>[][]) { return inlineKeyboard(rows); }

export async function showSubjects(ctx: Ctx, kind: SubjectKind, page = 0): Promise<void> {
  const library = await readLibrary(ctx);
  if (!library) { await ctx.editMessageText(unavailable, { reply_markup: keyboard([back]) }); return; }
  const subjects = library.subjects.filter((item) => item.kind === kind);
  const title = kind === "science" ? "المواد العلمية" : "المواد الأدبية";
  if (subjects.length === 0) {
    await ctx.editMessageText(`لا توجد ${title} بعد — ستظهر هنا فور إضافتها.`, { reply_markup: keyboard([back]) });
    return;
  }
  const pages = paginate(subjects, { page, perPage: 6, callbackPrefix: `subject-page:${kind}`, prevLabel: "السابق", nextLabel: "التالي" });
  const rows = pages.pageItems.map((subject) => [inlineButton(subjectLabel(subject), `subject-open:${subject.id}`)]);
  rows.push(...pages.controls.inline_keyboard as ReturnType<typeof inlineButton>[][], back);
  await ctx.editMessageText(`اختر مادة من ${title}.`, { reply_markup: keyboard(rows) });
}

async function showSections(ctx: Ctx, subjectId: string): Promise<void> {
  const library = await readLibrary(ctx);
  const subject = library?.subjects.find((item) => item.id === subjectId);
  if (!library || !subject) { await ctx.editMessageText("لم تعد هذه المادة متاحة. اختر مادة أخرى.", { reply_markup: keyboard([back]) }); return; }
  const rows = subject.sections.map((section) => [inlineButton(`${section.icon} ${section.name}`, `section-open:${subject.id}:${section.id}`)]);
  rows.push([inlineButton("العودة للمواد", `subject:${subject.kind}`)], back);
  await ctx.editMessageText(`اختر القسم الذي تريده من ${subject.name}.`, { reply_markup: keyboard(rows) });
}

async function showFiles(ctx: Ctx, subjectId: string, sectionId: string, page = 0): Promise<void> {
  const library = await readLibrary(ctx);
  const subject = library?.subjects.find((item) => item.id === subjectId);
  const section = subject?.sections.find((item) => item.id === sectionId);
  if (!library || !subject || !section) { await ctx.editMessageText("لم يعد هذا القسم متاحًا. اختر مادة أخرى.", { reply_markup: keyboard([back]) }); return; }
  const files = library.files.filter((item) => item.subjectId === subjectId && item.sectionId === sectionId).sort(byNewest);
  if (files.length === 0) {
    await ctx.editMessageText(`لا توجد ملفات في ${section.name} بعد — عد قريبًا.`, { reply_markup: keyboard([[inlineButton("العودة للأقسام", `subject-open:${subjectId}`)], back]) });
    return;
  }
  const pages = paginate(files, { page, perPage: 6, callbackPrefix: `files:${subjectId}:${sectionId}`, prevLabel: "السابق", nextLabel: "التالي" });
  const rows = pages.pageItems.map((file) => [inlineButton(file.title, `file-open:${file.id}`)]);
  rows.push(...pages.controls.inline_keyboard as ReturnType<typeof inlineButton>[][], [inlineButton("العودة للأقسام", `subject-open:${subjectId}`)], back);
  await ctx.editMessageText(`ملفات ${subject.name} — ${section.name}.`, { reply_markup: keyboard(rows) });
}

async function showFile(ctx: Ctx, fileId: string): Promise<void> {
  const library = await readLibrary(ctx);
  const file = library?.files.find((item) => item.id === fileId);
  if (!library || !file) { await ctx.editMessageText("لم يعد هذا الملف متاحًا. اختر ملفًا آخر.", { reply_markup: keyboard([back]) }); return; }
  const body = file.description ? `${file.title}\n${file.description}` : file.title;
  await ctx.editMessageText(body, { reply_markup: keyboard([[inlineButton("فتح الملف", `download:${file.id}`)], [inlineButton("العودة للملفات", `section-open:${file.subjectId}:${file.sectionId}`)], back]) });
}

async function adminHome(ctx: Ctx): Promise<void> {
  if (!(await requireOwner(ctx, adminCopy))) return;
  await ctx.editMessageText("أدِر مكتبتك من هنا. اختر ما تريد تحديثه.", { reply_markup: keyboard([
    [inlineButton("إضافة ملف", "admin:add-file")], [inlineButton("إدارة المواد", "admin:subjects")], [inlineButton("إدارة الملفات", "admin:files")], back,
  ]) });
}

async function adminSubjects(ctx: Ctx): Promise<void> {
  if (!(await requireOwner(ctx, adminCopy))) return;
  const library = await readLibrary(ctx);
  if (!library) { await ctx.editMessageText(unavailable, { reply_markup: keyboard([back]) }); return; }
  const rows = library.subjects.map((item) => [inlineButton(`حذف ${item.name}`, `admin:delete-subject:${item.id}`)]);
  rows.push([inlineButton("إنشاء مادة علمية", "admin:new-subject:science")], [inlineButton("إنشاء مادة أدبية", "admin:new-subject:literature")], [inlineButton("العودة للإدارة", "admin:open")]);
  await ctx.editMessageText(library.subjects.length ? "يمكنك إنشاء مادة أو حذف مادة لم تعد تحتاجها." : "لا توجد مواد بعد — أنشئ أول مادة للمكتبة.", { reply_markup: keyboard(rows) });
}

async function adminFiles(ctx: Ctx): Promise<void> {
  if (!(await requireOwner(ctx, adminCopy))) return;
  const library = await readLibrary(ctx);
  if (!library) { await ctx.editMessageText(unavailable, { reply_markup: keyboard([back]) }); return; }
  const rows = library.files.sort(byNewest).slice(0, 12).map((file) => [inlineButton(file.title, `admin:file:${file.id}`)]);
  rows.push([inlineButton("إضافة ملف", "admin:add-file")], [inlineButton("العودة للإدارة", "admin:open")]);
  await ctx.editMessageText(library.files.length ? "اختر ملفًا لاستبداله أو حذفه." : "لا توجد ملفات بعد — أضف أول ملف.", { reply_markup: keyboard(rows) });
}

composer.callbackQuery("admin:open", async (ctx) => { await ctx.answerCallbackQuery(); await adminHome(ctx); });
composer.callbackQuery("admin:subjects", async (ctx) => { await ctx.answerCallbackQuery(); await adminSubjects(ctx); });
composer.callbackQuery("admin:files", async (ctx) => { await ctx.answerCallbackQuery(); await adminFiles(ctx); });
composer.callbackQuery(/^subject-page:(science|literature):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showSubjects(ctx, ctx.match[1] as SubjectKind, Number(ctx.match[2])); });
composer.callbackQuery(/^subject-open:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showSections(ctx, ctx.match[1]); });
composer.callbackQuery(/^section-open:([\w-]+):([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showFiles(ctx, ctx.match[1], ctx.match[2]); });
composer.callbackQuery(/^files:([\w-]+):([\w-]+):(prev|next):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showFiles(ctx, ctx.match[1], ctx.match[2], Number(ctx.match[4])); });
composer.callbackQuery(/^file-open:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showFile(ctx, ctx.match[1]); });
composer.callbackQuery(/^download:([\w-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const file = (await readLibrary(ctx))?.files.find((item) => item.id === ctx.match[1]);
  if (!file) { await ctx.reply("لم يعد هذا الملف متاحًا. اختر ملفًا آخر."); return; }
  try {
    if (!ctx.chat) { await ctx.reply("افتح المحادثة الخاصة بالبوت لتنزيل الملف."); return; }
    if (file.kind === "photo") await ctx.api.sendPhoto(ctx.chat.id, file.fileId, { caption: file.title });
    else await ctx.api.sendDocument(ctx.chat.id, file.fileId, { caption: file.description ? `${file.title}\n${file.description}` : file.title });
  } catch { await ctx.reply("تعذّر فتح هذا الملف الآن. جرّب مرة أخرى لاحقًا."); }
});

composer.callbackQuery("admin:add-file", async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return;
  const library = await readLibrary(ctx); if (!library) { await ctx.editMessageText(unavailable, { reply_markup: keyboard([back]) }); return; }
  if (!library.subjects.length) { await ctx.editMessageText("أنشئ مادة أولًا ثم أضف الملف إليها.", { reply_markup: keyboard([[inlineButton("إدارة المواد", "admin:subjects")], [inlineButton("العودة للإدارة", "admin:open")]]) }); return; }
  await ctx.editMessageText("اختر المادة التي ينتمي إليها الملف.", { reply_markup: keyboard([...library.subjects.map((item) => [inlineButton(item.name, `admin:pick-subject:${item.id}`)]), [inlineButton("العودة للإدارة", "admin:open")]]) });
});
composer.callbackQuery(/^admin:pick-subject:([\w-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return;
  const subject = (await readLibrary(ctx))?.subjects.find((item) => item.id === ctx.match[1]);
  if (!subject) { await ctx.editMessageText("لم تعد هذه المادة متاحة.", { reply_markup: keyboard([[inlineButton("إضافة ملف", "admin:add-file")]]) }); return; }
  ctx.session.subjectId = subject.id;
  await ctx.editMessageText("اختر القسم المناسب للملف.", { reply_markup: keyboard([...subject.sections.map((item) => [inlineButton(`${item.icon} ${item.name}`, `admin:pick-section:${item.id}`)]), [inlineButton("العودة", "admin:add-file")]]) });
});
composer.callbackQuery(/^admin:pick-section:([\w-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy)) || !ctx.session.subjectId) return;
  ctx.session.sectionId = ctx.match[1]; ctx.session.step = "admin-file";
  await ctx.editMessageText("أرسل ملف PDF أو صورة الآن. سننشره بعد العنوان والوصف.", { reply_markup: keyboard([[inlineButton("إلغاء", "admin:open")]]) });
});
composer.callbackQuery(/^admin:new-subject:(science|literature)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return;
  ctx.session.step = "admin-subject-name"; ctx.session.subjectId = ctx.match[1];
  await ctx.editMessageText("اكتب اسم المادة الجديدة.", { reply_markup: keyboard([[inlineButton("إلغاء", "admin:subjects")]]) });
});
composer.callbackQuery(/^admin:delete-subject:([\w-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return;
  await ctx.editMessageText("حذف المادة سيحذف ملفاتها أيضًا. هل تريد المتابعة؟", { reply_markup: keyboard([[inlineButton("حذف المادة", `admin:confirm-delete-subject:${ctx.match[1]}`)], [inlineButton("العودة", "admin:subjects")]]) });
});
composer.callbackQuery(/^admin:confirm-delete-subject:([\w-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return;
  const library = await readLibrary(ctx); if (!library) return;
  const id = ctx.match[1]; library.subjects = library.subjects.filter((item) => item.id !== id); library.files = library.files.filter((item) => item.subjectId !== id); await writeLibrary(ctx, library);
  await ctx.editMessageText("حُذفت المادة وملفاتها.", { reply_markup: keyboard([[inlineButton("إدارة المواد", "admin:subjects")], [inlineButton("العودة للإدارة", "admin:open")]]) });
});
composer.callbackQuery(/^admin:file:([\w-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return;
  const file = (await readLibrary(ctx))?.files.find((item) => item.id === ctx.match[1]); if (!file) return;
  await ctx.editMessageText(`اختر ما تريد فعله بملف ${file.title}.`, { reply_markup: keyboard([[inlineButton("استبدال الملف", `admin:replace:${file.id}`)], [inlineButton("حذف الملف", `admin:delete:${file.id}`)], [inlineButton("العودة للملفات", "admin:files")]]) });
});
composer.callbackQuery(/^admin:replace:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return; ctx.session.replaceFileId = ctx.match[1]; ctx.session.step = "admin-file"; await ctx.editMessageText("أرسل النسخة الجديدة كملف PDF أو صورة.", { reply_markup: keyboard([[inlineButton("إلغاء", "admin:files")]]) }); });
composer.callbackQuery(/^admin:delete:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return; await ctx.editMessageText("هل تريد حذف هذا الملف؟", { reply_markup: keyboard([[inlineButton("حذف الملف", `admin:confirm-delete:${ctx.match[1]}`)], [inlineButton("العودة", "admin:files")]]) }); });
composer.callbackQuery(/^admin:confirm-delete:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, adminCopy))) return; const library = await readLibrary(ctx); if (!library) return; library.files = library.files.filter((item) => item.id !== ctx.match[1]); await writeLibrary(ctx, library); await ctx.editMessageText("حُذف الملف من المكتبة.", { reply_markup: keyboard([[inlineButton("إدارة الملفات", "admin:files")], [inlineButton("العودة للإدارة", "admin:open")]]) }); });

composer.on(["message:document", "message:photo"], async (ctx, next) => {
  if (ctx.session.step !== "admin-file" || !(await requireOwner(ctx, adminCopy))) return next();
  const document = ctx.message.document; const photo = ctx.message.photo?.at(-1);
  if (document && document.file_size && document.file_size > 50 * 1024 * 1024) { await ctx.reply("الملف كبير جدًا لإرساله عبر Telegram. جرّب نسخة أصغر."); return; }
  ctx.session.pendingFile = document ? { fileId: document.file_id, kind: "document", fileName: document.file_name } : photo ? { fileId: photo.file_id, kind: "photo" } : undefined;
  if (!ctx.session.pendingFile) { await ctx.reply("أرسل ملف PDF أو صورة واضحة."); return; }
  if (ctx.session.replaceFileId) {
    const library = await readLibrary(ctx); const old = library?.files.find((item) => item.id === ctx.session.replaceFileId);
    if (library && old) { old.fileId = ctx.session.pendingFile.fileId; old.kind = ctx.session.pendingFile.kind; old.fileName = ctx.session.pendingFile.fileName; old.addedAt = nowIso(); await writeLibrary(ctx, library); }
    ctx.session.step = undefined; ctx.session.pendingFile = undefined; ctx.session.replaceFileId = undefined;
    await ctx.reply("استُبدل الملف بنجاح.", { reply_markup: keyboard([[inlineButton("إدارة الملفات", "admin:files")]]) }); return;
  }
  ctx.session.step = "admin-title"; await ctx.reply("اكتب عنوانًا واضحًا للملف.");
});
composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (ctx.session.step === "admin-subject-name") {
    if (!(await requireOwner(ctx, adminCopy))) return; if (text.length < 2 || text.length > 60) { await ctx.reply("اكتب اسمًا بين حرفين و60 حرفًا."); return; }
    const library = await readLibrary(ctx); const kind = ctx.session.subjectId as SubjectKind; if (!library || !kind) { await ctx.reply(unavailable); return; }
    library.subjects.push({ id: recordId(), name: text, kind, sections: sectionTemplates.map((item) => ({ ...item, id: recordId() })) }); await writeLibrary(ctx, library); ctx.session.step = undefined; ctx.session.subjectId = undefined;
    await ctx.reply("أُضيفت المادة، وأصبحت جاهزة للملفات.", { reply_markup: keyboard([[inlineButton("إدارة المواد", "admin:subjects")]]) }); return;
  }
  if (ctx.session.step === "admin-title") { if (text.length < 2 || text.length > 100) { await ctx.reply("اكتب عنوانًا بين حرفين و100 حرف."); return; } ctx.session.pendingTitle = text; ctx.session.step = "admin-description"; await ctx.reply("اكتب وصفًا قصيرًا، أو أرسل شرطة إذا لم تحتج وصفًا."); return; }
  if (ctx.session.step === "admin-description") {
    if (!(await requireOwner(ctx, adminCopy))) return; const pending = ctx.session.pendingFile; const title = ctx.session.pendingTitle;
    const library = await readLibrary(ctx); if (!pending || !title || !library || !ctx.session.subjectId || !ctx.session.sectionId) { ctx.session.step = undefined; await ctx.reply("لم تكتمل إضافة الملف. ابدأ من زر إضافة ملف."); return; }
    const file: LibraryFile = { id: recordId(), subjectId: ctx.session.subjectId, sectionId: ctx.session.sectionId, title, description: text === "-" ? undefined : text.slice(0, 500), kind: pending.kind, fileId: pending.fileId, fileName: pending.fileName, addedAt: nowIso() };
    library.files.push(file); const saved = await writeLibrary(ctx, library); ctx.session.step = undefined; ctx.session.subjectId = undefined; ctx.session.sectionId = undefined; ctx.session.pendingFile = undefined; ctx.session.pendingTitle = undefined;
    if (!saved) { await ctx.reply(unavailable); return; }
    await ctx.reply("نُشر الملف في المكتبة.", { reply_markup: keyboard([[inlineButton("إضافة ملف آخر", "admin:add-file")], [inlineButton("إدارة الملفات", "admin:files")]]) });
    const owner = adminChatId(ctx);
    if (owner) {
      try { await ctx.api.sendMessage(owner, `أُضيف ملف جديد إلى المكتبة: ${file.title}`); } catch { /* notification must not undo publishing */ }
    }
    return;
  }
  return next();
});

export default composer;
