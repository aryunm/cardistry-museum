# 花切博物馆 · Cardistry Museum

纸牌花切动作（cardistry）的线上档案馆。每个动作一个条目，写清分类、难度、前置动作、谱系与来源，
无法溯源的条目进「待考据」而不是混进正馆。

站点以**维基模式**运行：内容默认对所有人开放阅读，修改权按角色发放。当前公开编辑是关闭的，
条目修改只开放给站长，其余角色的通路已经建好并留作后续开启。

## 为什么是这样做的

- **零成本**：公开页面全部预渲染，构建产物 0.16 MB，托管在 GitHub Pages 免费额度内；
  只有登录、账号、后台、编辑这几条特权路由需要服务端。
- **唯一依赖是 Astro**：没有 Tailwind、没有 UI 框架。样式是一份手写 CSS。
- **视频一律外链**：这是全站唯一可能产生费用的地方，外链嵌入 + 完整署名即可彻底归零。
- **来源是硬门槛**：Schema 强制每个影像资产带 `credit` 与 `license`，缺字段构建就过不去。
- **权限只在服务端判定**：路由守卫在中间件里，改前端代码不会放行；数据库侧还有一层 RLS 兜底。
- **不持有密钥**：全站只用 Supabase 的 anon key（设计上就是公开的），安全边界在 RLS 策略，
  不引入 service_role key，因此静态页面里内联 anon key 没有额外风险。


## 本地运行

```powershell
npm install --cache .npm-cache   # 本机 npm 全局缓存目录无写权限，故用项目内缓存
npm run dev                      # http://localhost:4321
npm run validate                 # 内容规则校验（CI 跑的就是这个）
npm run build                    # 产物输出到 dist/
npm run preview                  # 预览构建产物
```

`--cache .npm-cache` 是因为本机 npm 全局缓存在 `C:\Program Files\nodejs\node_cache`，普通权限无法写入。
若已把全局缓存改到可写目录，可以直接 `npm install`。

不配任何环境变量直接 `npm run dev`，会走**本地 mock 身份**：登录页可以一键切换读者 / 贡献者 / 管理员 / 站长，
用来验证权限边界，不需要 Supabase 账号。要接真身份服务时，把 `.env.example` 复制成 `.env` 再填。

## 目录结构

```
src/
  content.config.ts        内容 Schema（zod 校验，来源与授权字段在此强制）
  content/moves/*.md       动作条目，一件一文件
  content/artists/*.md     创作者
  content/decks/*.md       牌组与厂牌
  data/categories.ts       八个动作分类的定义
  data/glossary.ts         术语表
  data/timeline.ts         时间线
  layouts/ components/     版式与展品卡片
  pages/                   路由
  lib/access.ts            角色、能力矩阵、站点开关、访问上下文
  lib/auth/                身份适配层：supabase / mock / disabled 三种实现
  lib/audit.ts             审计写入的薄封装
  middleware.ts            路由守卫：未登录跳登录，权限不足回 403
  pages/api/ pages/auth/   会话查询与 OAuth 回调
  pages/account/ pages/admin/ pages/edit/
supabase/migrations/       Postgres 迁移：表、触发器、RLS 与 RPC
scripts/validate-content.mjs
```

## 页面

| 路径 | 说明 |
| --- | --- |
| `/` | 首页：统计、分类入口、今日常设展品、待考据区 |
| `/categories/` `/categories/[分类]/` | 动作分类，按难度升序 |
| `/moves/` | 馆藏索引，可按分类 / 难度 / 考据状态 / 关键词筛选，条件同步到地址栏 |
| `/moves/[动作]/` | 条目页：展签、谱系、说明、影像、来源 |
| `/artists/` `/artists/[人物]/` | 人物 |
| `/decks/` | 器物 |
| `/timeline/` | 史线 |
| `/glossary/` | 术语表与难度评分规则 |
| `/credits/` | 版权规则、考据标准、撤下通道 |
| `/random/` | 随机漫游 |
| `/login/` | 身份入口，需服务端 |
| `/account/` `/account/sessions/` | 本人资料与设备会话，需登录 |
| `/admin/` | 待审修订与审计日志，需管理员以上 |
| `/admin/users/` | 成员与角色，仅站长 |
| `/edit/[类型]/[条目]/` | 提交修订，默认仅管理员以上；条目未开放时只显示原因 |
| `/logout/` `/auth/callback/` `/api/session/` | 登出、OAuth 回调、登录态查询 |


## 动作分类

按力学结构分，不按难度或人气。分类存在的意义是让同类动作能放在一起比较。

| key | 名称 | 英文 |
| --- | --- | --- |
| `one-handed-cuts` | 单手切 | One-Handed Cuts |
| `two-handed-cuts` | 双手切 | Two-Handed Cuts & Packets |
| `aerials` | 空中动作 | Aerials |
| `fans-spreads` | 展扇 | Fans & Spreads |
| `dribbles-springs` | 落牌与弹牌 | Dribbles, Springs & Cascades |
| `isolations-spins` | 隔离与旋转 | Isolations & Spins |
| `displays-freezes` | 展示与定格 | Displays & Freezes |
| `combos` | 连招 | Combos & Sequences |

## 录入一个新动作

在 `src/content/moves/` 新建 `<kebab-case-id>.md`，文件名就是 URL 里的 slug：

```yaml
---
title: "中文主名"
titleEn: "English Name"
aliases: ["常见别名"]
category: "one-handed-cuts"    # 见 data/categories.ts
difficulty: 3                  # 1–5
firstPublicYear: null          # 不确定就写 null，别猜
creators: []                   # 人物 id，如 dan-and-dave
prerequisites: ["charlier-cut"]
derivedFrom: ["charlier-cut"]
hands: "one"                   # one / two / either
packets: 2
tags: ["标签"]
status: "verified"             # verified / disputed / stub
summary: "一句话展签"
curatorNote: "策展人注，可选"
sources:
  - type: "wiki"               # book / video / forum / wiki / interview / article
    title: "Charlier cut"
    url: "https://en.wikipedia.org/wiki/Charlier_Cut"
---
正文用 Markdown 写做法、要点与常见问题。
```

规则：

- `status` 为 `stub` 的条目**不要**填 `creators` 和 `firstPublicYear`。
- 归属或年代有冲突时用 `disputed`，并在 `curatorNote` 里把冲突说明白，不要替读者裁决。
- 没有来源支撑的判断，一律降级成 `stub`。

## 影像授权规则

每个 `media` 条目必须同时具备 `credit`（署名）与 `license`（授权说明），并尽量带上 `sourceUrl`。
优先级：自制拍摄或已获授权素材 → 平台标准嵌入（外链，不转载）→ 暂缺影像并显示「影像待补」。

**不使用他人影像的本地副本**，即使是二次剪辑。撤下请求按 `/credits/` 页面的说明处理。

## 维基模式：角色与权限

四档角色，逐级包含下级能力。角色存在数据库的 `profiles.role` 里，判定在服务端。

| 角色 | 能做什么 |
| --- | --- |
| `reader` 读者 | 浏览全部条目 |
| `contributor` 贡献者 | 提交条目修订，须经管理员以上审核才发布；仅在条目与站点双层闸门都开放时可用 |
| `moderator` 管理员 | 审核修订、处理条目、停用账号、看审计日志；**不能调整他人角色** |
| `owner` 站长 | 全部权限，含角色分配与站点开关 |

能力矩阵写在 `src/lib/access.ts` 的 `MINIMUM_ROLE` 里，是唯一事实来源：

| 能力 | 最低角色 |
| --- | --- |
| `entry.read` | 任何人（含未登录） |
| `entry.propose` | 管理员；仅当 `open_editing` 为真时降为贡献者 |
| `entry.publish` / `entry.delete` / `revision.review` / `user.invite` / `user.suspend` / `site.audit` | 管理员 |
| `user.manage_role` / `site.settings` | 站长 |

守卫在 `src/middleware.ts`，按前缀匹配并优先取最长前缀：

| 路径 | 要求 |
| --- | --- |
| `/admin/users` | `user.manage_role`，仅站长 |
| `/admin/settings` | `site.settings`，仅站长（页面本身待做，守卫已预留） |
| `/admin` | `site.audit`，管理员以上 |
| `/edit` | `entry.propose` |
| `/account` | 登录即可 |

未登录一律 302 到 `/login?next=<原路径>`；已登录但权限不足返回 403 HTML，页面里直接写明当前身份与所需最低角色。
公开页面在构建期预渲染，中间件对它们直接放行并注入「全部关闭」的空策略，读路径不依赖数据库。

## 编辑权限的两层闸门

「多词条不开放修改权限」落成两道独立的闸，任何一道关着，贡献者就改不了：

1. **站点级** `site_settings.open_editing`，默认 `false`；
2. **条目级** `entries.protection`，默认 `owner_only`。

判定逻辑是 `src/lib/access.ts` 的 `canProposeEntry`，数据库里的 `can_propose_entry()` 保持同一套规则：

- 管理员以上：不受两道闸限制，可改任何条目；
- 贡献者：必须 `open_editing = true` **且** 该条目 `protection = 'open'`；
- 其余：不可改。

所以站长即使把站点开关打开，未显式开放的条目依然只有自己能改。新条目的 `protection` 一律从 `owner_only`
起步（`revisions_after_insert` 触发器保证），开放是站长的显式动作。

修订的 `status` 由服务端裁决，客户端传什么都不算数：管理员以上直接在 `revisions_before_insert` 触发器里落成
`published`，其余角色一律 `pending`。`published_commit` 字段留给后续「审核通过 → 落到 git」的发布步骤。

审核、提权、停用、提审、审计写入全部走 `security definer` 函数，`profiles` 表刻意不设 update 策略，
因此**不存在绕过函数直接改角色的通路**。

## 登录与身份服务

只支持两种登录，都不涉及密码，也就不存在口令泄露与重置的问题：

- **GitHub OAuth**（PKCE）：授权范围只取公开资料与邮箱，不申请仓库权限；
- **邮箱一次性链接**（Magic Link）：邮件里点开即完成登录；同一链接换设备打开会失败，这是刻意设计。

登录策略：

- **不开放自助注册**。`open_registration` 默认 `false` 时，未受邀邮箱不会建号；登录页会如实说明。
- **首次登录默认 `reader`**。`handle_new_user()` 触发器建档，`role` 一律 `reader`。
- **唯一的例外是站长**：邮箱命中 `site_settings.owner_emails` 时直接给 `owner`。这是为了让第一个站长能进后台，
  之后所有人（包括站长自己）都只能经 `set_member_role()` 由站长显式提权。登录资料里的任何字段都不参与判定。
- 已停用（`suspended`）的账号可以登录，但角色视为空，等同于未登录。

身份适配层在 `src/lib/auth/`，同一套接口三种实现：

| 实现 | 何时启用 |
| --- | --- |
| `supabase` | 配置了 `PUBLIC_SUPABASE_URL` 与 `PUBLIC_SUPABASE_ANON_KEY` |
| `mock` | 未配置凭据**且**处于开发环境。登录页可一键切四种角色，数据落在 `.local-data/`（已 gitignore） |
| `disabled` | 未配置凭据且是生产环境。登录入口关闭，公开阅读不受影响 |

`mock` 只用于本地开发：它把设备、成员、修订、条目写进 `.local-data/mock-auth.json`，审计追加到
`.local-data/audit.jsonl`。想验证贡献者通路时，用 `MOCK_OPEN_EDITING=true npm run dev` 配合把目标条目改成
`protection: "open"`。

## 多端会话与吊销

每台设备登录后各持有一条会话记录。`/account/sessions/` 列出全部设备，支持三种操作：吊销指定设备、
吊销除本设备以外的全部设备、登出全部设备（后者直接清所有会话）。

- **「本设备」怎么认**：Supabase 路径读 access token 的 `session_id` claim（JWT 载荷解码，不依赖 Node API，
  Workers 上同样可用）；mock 路径认 cookie 里的设备 id。
- **吊销的生效时机**：吊销删掉的是 `auth.sessions` 里那一行（连带刷新令牌），所以**刷新令牌立刻失效，
  但已签发的 access token 仍有效到自然过期，最长 1 小时**。文案里已经写明这一点，不要在前端假装它是瞬时的。
- **踩过的坑**：`supabase-js` 的 `signOut({ scope })` 无论 scope 是什么都会清掉本地会话（源码里是 `finally`
  无条件 `_removeSession()`），照它实现「吊销其他设备」会把当前设备一起登出。所以这一条改走
  `my_sessions()` 列出会话、对除当前以外的每一条调用 `revoke_session()`。mock 实现有同样的坑，cookie 只在
  scope 不是 `others` 时才清。

## 接入 Supabase

公开阅读不需要这一步；要让登录与编辑真正可用才需要。整套流程零成本，Supabase 免费额度足够。

1. 建一个 Supabase 项目，记下 Project URL 与 anon public key。
2. 在 SQL Editor 里执行 `supabase/migrations/0001_init.sql`。它会建表、触发器、RLS 策略与全部 RPC。
3. **先写站长邮箱，再去登录**（顺序反了就得手工改库补救）：

   ```sql
   update site_settings set value = '["你的邮箱@example.com"]'::jsonb where key = 'owner_emails';
   ```

   改完再登录，`handle_new_user()` 才会把 `owner` 直接给你。若已经以 `reader` 登录过，可以直接
   `update profiles set role = 'owner' where email = '你的邮箱@example.com';`。
4. Authentication → Providers 打开 GitHub：把 GitHub OAuth App 的 Client ID / Secret 填进去，
   GitHub 那边的 Authorization callback URL 填 `https://<项目>.supabase.co/auth/v1/callback`。
5. Authentication → URL Configuration：Site URL 填站点域名；Redirect URLs 里加上
   `https://<站点域名>/auth/callback/`，本地调试再加 `http://localhost:4321/auth/callback/`。
6. 把 `.env.example` 复制成 `.env`，填 `PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY`、`SITE_URL`。
7. 本地起服务确认登录页显示的「身份服务」变成了 Supabase；此后公开页面仍然预渲染，不查库。

**注意**：编写这套 SQL 的机器上没有 Postgres 也没有 Docker，**该迁移文件未经真实实例执行验证**。
字段与策略是按本仓库代码的读取方式反推的，首次施加时请在一个空项目上跑，并核对
「站点开关 → 登录 → 提权 → 提审 → 审核」这条链路。

## 部署与运行环境

`astro.config.mjs` 里 `output: "static"`：公开页面在构建期全部预渲染，只有特权路由带
`export const prerender = false` 走服务端。适配器按 `DEPLOY_TARGET` 动态选择，默认 `node`。

```powershell
npm run build                       # 产物：dist/ 静态页 + dist/server/entry.mjs
$env:PORT=4331; node dist/server/entry.mjs   # 自托管
```

| 目标 | 做法 |
| --- | --- |
| 公开部分 | 静态产物可直接交给 GitHub Pages / 任意 CDN |
| Cloudflare Pages | `$env:DEPLOY_TARGET="cloudflare"; npm run build` |
| 自托管 | `DEPLOY_TARGET=node`（默认），跑 `node dist/server/entry.mjs` |

**若只把静态产物丢给 GitHub Pages，登录、账号、后台、编辑这几条路由不存在**——它们是服务端路由，
需要上面任意一种带运行时的部署。公开阅读不受影响。

### allowedDomains 与 CSRF 同源校验（自托管必读）

Astro 5 的 `security.checkOrigin` 默认开启，判定方式是把请求的 `Origin` 头和 `Astro.url.origin` 比对；
而 `@astrojs/node` 在构造请求时，会用 `security.allowedDomains` 校验收到的 `Host`，
**白名单为空时会把主机名整个丢掉**，`Astro.url` 退化成 `http://localhost`（端口也没了）。后果不只是
表单 POST 全被 403 拦掉，OAuth 回调原点也会算错。

`astro.config.mjs` 已经处理：把 `SITE_URL` 的 hostname 自动加进白名单，本地回环
（`localhost` / `127.0.0.1`，任意端口、http 与 https）也一并放行。自托管时**必须**把 `SITE_URL` 写成访问者
实际使用的地址，**端口要带上**，例如 `http://192.168.1.10:4331`；否则该地址的表单提交会被拒绝。

Cloudflare 适配器不受影响：它把平台的原生 `Request` 直接交给 Astro，`Astro.url` 天生产生正确。

## 安全现状与已知限制

如实列出，不粉饰：

- **CSRF**：目前只有 Astro 自带的同源校验（`checkOrigin`）与 `SameSite=Lax` 会话 cookie，
  **没有实现 CSRF token**。这是后续加固项。
- **会话吊销有延迟**：见「多端会话与吊销」，最长相当于一次 access token 的生命周期（1 小时）。
- **数据库迁移未经执行验证**：见「接入 Supabase」末段。
- **审计写入对匿名开放**：`log_audit()` 需要记录未登录时的邮箱登录请求，因此匿名可调用，
  意味着审计表存在被刷的风险。生产环境应配合 Supabase 侧的限流与用量告警。
- **角色行不可变**：`set_member_role()` 拒绝改自己的角色、也拒绝改动任何 `owner` 行，
  防止误操作把站点锁死；代价是降级另一位站长只能手工改库。
- **停用有层级限制**：不能停用同级或更高角色，管理员之间无法互相停用。
- **不做软删除**：账号停用是标记位，不做级联清理。

## 内容校验与 CI

`npm run validate` 跑 `scripts/validate-content.mjs`，在构建之前把规矩查一遍。
它读 `src/content/` 里的 frontmatter，规则如下：

**错误（会失败）**

| 规则 | 理由 |
| --- | --- |
| `category` 必须存在于 `data/categories.ts` | 防止写错分类后静默变成死条目 |
| `difficulty` 必须是 1–5 的整数 | 难度分级不给约束就会有人写 3.5 |
| `status: stub` 时不得填 `creators` / `firstPublicYear` | 待考据条目不许猜归属和年代 |
| `status: verified` / `disputed` 必须至少有一条 `sources` | 有主张就要有出处 |
| 媒体资产必须同时有 `credit` 与 `license` | 缺一就不许上架 |
| 本地路径影像只允许 `provider: self` | 禁止存放他人影像的本地副本 |
| `creators` / `prerequisites` / `derivedFrom` 必须指向真实条目 | 引用完整性 |
| `derivedFrom` 必须有向无环 | 谱系图一旦成环就画不出来 |
| `titleEn` 唯一 | 同名动作会互相覆盖 |

**提醒（不失败）**

媒体缺 `sourceUrl`、正文为空、`order` 重复、分类下暂时没有条目。

`.github/workflows/ci.yml` 在 push 与 PR 时依次跑 `npm ci` → `npm run validate` → `npm run build`。
校验器与 Astro 的 zod Schema 是两层：前者管业务规矩，后者管字段类型，`media` 缺 `license` 时两边都会报。

需要本地复现 CI 而手上没有远端时，直接跑 `npm run validate && npm run build` 即可。

## 部署到 GitHub Pages

自动化已经写好：`.github/workflows/deploy-pages.yml`。推送到 `main` 即触发，它自己算出
`SITE_URL` 与 `BASE_PATH`（仓库名不等于 `<用户名>.github.io` 时 base 取 `/<仓库名>/`），
依次跑内容校验、构建、base 链接检查，再上传 `dist/client` 部署。

**首次部署前必须先手动打开 Pages**：**Settings → Pages → Source 选 GitHub Actions**。
用 `GITHUB_TOKEN` 建 Pages 站点会被拒（`Resource not accessible by integration`），
所以工作流里不做这件事，只能人工开一次。仓库公开，Pages 才免费。

本地复现同样的构建：

```powershell
$env:SITE_URL="https://<用户名>.github.io"; $env:BASE_PATH="/<仓库名>/"; npm run build
```

`astro.config.mjs` 读的就是这两个变量。本地开发不设置时，`base` 为 `/`。

**注意 base 要自己传到链接上**：Astro 只会给构建产物（CSS / JS）自动加 base，
`<a href="/moves/">` 这类**手写的站内链接不会自动加**。所以站内链接统一走 `src/lib/url.ts` 的
`withBase()`，`random.astro` 的客户端跳转用 `import.meta.env.BASE_URL`。新增页面时照此办理，
否则子路径部署会出现「页面能打开、点任意链接 404」。
校验办法是 `scripts/check-base-links.mjs`（读 `BASE_PATH`，默认扫 `dist/client`），
部署工作流里跑了一遍：

```powershell
$env:BASE_PATH="/cardistry-museum/"; node scripts/check-base-links.mjs
```

托管在 Pages 上的那份**只有能预渲染的公开页面**：馆藏、人物、器物、史线、术语表、版权、404。
登录、账号、编辑、后台都是服务端路由（`prerender = false`），静态托管上没有运行时，这些地址会落到
`404.html`；页头检测不到身份服务时也不会渲染登录入口。要用完整功能需另配一处服务端（Cloudflare Pages
或自托管），或干脆把整站放在带运行时的平台。详见「部署与运行环境」。


## 现状与后续

已交付：完整骨架 + 12 件种子馆藏 + 人物 + 器物 + 史线 + 术语表 + 版权页 + 404 页；
维基身份层（GitHub / 邮箱登录、四档角色、路由守卫与权限矩阵、修订与审核闭环、多端会话与吊销、审计日志）；
数据库迁移文件。

种子数据里 3 件标为「待考据」，属于刻意保留。

待做：

- Pagefind 站内搜索、谱系图可视化、多角度播放器、别名 slug 重定向、中英双语路由；
- 站长后台的站点开关页（守卫已预留 `/admin/settings`）与条目保护级别管理页（RPC `set_entry_protection` 已就绪）；
- 「审核通过 → 写入 git」的发布步骤，把 `revisions.published_commit` 填起来；
- CSRF token；
- 在真实 Supabase 项目上验证迁移并记录结果。

