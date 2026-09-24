# 花切博物馆 · Cardistry Museum

纸牌花切动作（cardistry）的线上档案馆。每个动作一个条目，写清分类、难度、前置动作、谱系与来源，
无法溯源的条目进「馆藏室」而不是混进正馆。

## 为什么是这样做的

- **零成本**：静态站，构建产物 0.16 MB，托管在 GitHub Pages 免费额度内，不需要数据库与服务器。
- **唯一依赖是 Astro**：没有 Tailwind、没有 UI 框架、没有后端。样式是一份手写 CSS。
- **视频一律外链**：这是全站唯一可能产生费用的地方，外链嵌入 + 完整署名即可彻底归零。
- **来源是硬门槛**：Schema 强制每个影像资产带 `credit` 与 `license`，缺字段构建就过不去。

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
```

## 页面

| 路径 | 说明 |
| --- | --- |
| `/` | 首页：统计、分类入口、今日常设展品、馆藏室 |
| `/categories/` `/categories/[分类]/` | 动作分类，按难度升序 |
| `/moves/` | 馆藏索引，可按分类 / 难度 / 考据状态 / 关键词筛选，条件同步到地址栏 |
| `/moves/[动作]/` | 展品页：展签、谱系、展品说明、影像、来源 |
| `/artists/` `/artists/[人物]/` | 人物馆 |
| `/decks/` | 器物馆 |
| `/timeline/` | 史馆 |
| `/glossary/` | 术语表与难度评分规则 |
| `/credits/` | 版权规则、考据标准、撤下通道 |
| `/random/` | 随机漫游 |

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

仓库设置 → Pages → Source 选 **GitHub Actions**，用官方 Astro 模板即可。若部署在子路径
（`https://<用户名>.github.io/<仓库名>/`），构建时传入环境变量：

```powershell
$env:SITE_URL="https://<用户名>.github.io"; $env:BASE_PATH="/<仓库名>/"; npm run build
```

`astro.config.mjs` 读的就是这两个变量。本地开发不设置时，`base` 为 `/`。

## 现状与后续

已交付：完整骨架 + 12 件种子馆藏 + 人物馆 + 器物馆 + 史馆 + 术语表 + 版权页。
种子数据里 3 件标为「待考据」，属于刻意保留，用于验证馆藏室流程。

待做：Pagefind 站内搜索、特展页、谱系图可视化、多角度播放器、别名 slug 重定向、中英双语路由。
