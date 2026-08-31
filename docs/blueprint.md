# سند — Bot specification

**Archetype:** content

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

بوت Telegram باللغة العربية موجه لطلاب الشهادة السودانية دفعة 27، يوفر مكتبة منظمة من المواد الدراسية (علمية وأدبية) مع واجهة فخمة وإدارة ملفات ديناميكية عبر Telegram لمدير واحد فقط.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- طلاب الشهادة السودانية دفعة 27
- مشرف محتوى واحد (الادمن)

## Success criteria

- الوصول إلى 1000+ مستخدم نشط شهريًا
- إضافة 50+ ملف دراسي شهريًا عبر الادمن

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — عرض القائمة الرئيسية مع خيارات المواد العلمية/الأدبية ومعلومات التواصل
- **المواد العلمية** (button, actor: user, callback: subject:science) — فتح قائمة المواد العلمية مع أزرار قابلة للتمرير
  - outputs: قائمة المواد العلمية
- **المواد الأدبية** (button, actor: user, callback: subject:literature) — فتح قائمة المواد الأدبية مع أزرار قابلة للتمرير
  - outputs: قائمة المواد الأدبية
- **تواصل مع الإدارة** (button, actor: user, callback: contact_admin) — فتح نموذج رسالة تُعاد توجيهها للادمن
  - inputs: نص الرسالة
  - outputs: تأكيد إرسال الرسالة

## Flows

### تصفح المواد
_Trigger:_ /start أو زر المواد

1. اختيار نوع المادة (علمية/أدبية)
2. اختيار مادة محددة
3. اختيار قسم (كتب/مذكرات/ฯل)
4. عرض قائمة الملفات
5. معاينة أو تنزيل ملف

_Data touched:_ المادة, القسم, الملف

### إدارة المحتوى من الادمن
_Trigger:_ دخول الادمن عبر ADMIN_CHAT_ID

1. رفع ملف جديد
2. اختيار مادة وقسم
3. إدخال عنوان ووصف
4. نشر الملف تلقائيًا

_Data touched:_ المادة, القسم, الملف

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — حساب الادمن الذي يُرسل له الإشعارات وإدارة المحتوى
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **المادة** _(retention: persistent)_ — موضوع دراسي أساسي (مثل الرياضيات أو اللغة العربية)
  - fields: اسم المادة, نوع (علمية/أدبية)
- **القسم** _(retention: persistent)_ — تصنيف داخلي للمادة (كتب/مذكرات/ฯل)
  - fields: اسم القسم, رمز الرسوم التوضيحية
- **الملف** _(retention: persistent)_ — ملف دراسي قابل للتنزيل أو المعاينة
  - fields: عنوان الملف, وصف اختياري, نوع الملف (PDF/صورة), تاريخ الإضافة, مسار الملف
- **الادمن** _(retention: persistent)_ — المستخدم الوحيد الذي يملك صلاحيات الإدارة
  - fields: Telegram ID

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- إضافة/حذف/استبدال ملفات
- إنشاء/حذف مواد دراسية
- عرض الإشعارات عند إضافة ملف جديد

## Notifications

- إشعار تلقائي للادمن عند إضافة ملف جديد

## Permissions & privacy

- الوصول إلى الملفات محدود للمستخدمين العاديين فقط
- صلاحيات الإدارة محجوزة لـ ADMIN_CHAT_ID فقط

## Edge cases

- رفع ملفات كبيرة الحجم
- التعامل مع الملفات التي لا يمكن معاينتها
- التأكد من أن القوائم تُولد ديناميكيًا عند إضافة/حذف مواد

## Required tests

- اختبار تدفق المستخدم من القائمة الرئيسية إلى تنزيل ملف
- اختبار إضافة ملف جديد من الادمن وظهوره فورًا للمستخدمين
- اختبار توجيه الرسائل من المستخدمين للادمن

## Assumptions

- القوائم تُولد ديناميكيًا من البيانات
- العرض الافتراضي للأحدث أول
- الادمن يملك كل الصلاحيات عبر Telegram فقط
