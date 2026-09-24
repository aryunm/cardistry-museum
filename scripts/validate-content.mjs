import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

const root = path.resolve(import.meta.dirname, "..");
const errors = [];
const warnings = [];

function fail(where, message)
{
	errors.push(`${where}  ${message}`);
}

function note(where, message)
{
	warnings.push(`${where}  ${message}`);
}

function splitFrontmatter(text)
{
	const normalized = text.replace(/\r\n/g, "\n");
	if (!normalized.startsWith("---\n"))
	{
		return { frontmatter: null, body: normalized };
	}
	const end = normalized.indexOf("\n---", 4);
	if (end === -1)
	{
		return { frontmatter: null, body: normalized };
	}
	return {
		frontmatter: normalized.slice(4, end),
		body: normalized.slice(end + 4)
	};
}

async function loadCollection(dirName)
{
	const dir = path.join(root, "src", "content", dirName);
	const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
	const entries = new Map();
	for (const file of files)
	{
		const id = file.replace(/\.md$/, "");
		const raw = await readFile(path.join(dir, file), "utf8");
		const { frontmatter, body } = splitFrontmatter(raw);
		if (frontmatter === null)
		{
			fail(`${dirName}/${file}`, "缺少 --- 包裹的 frontmatter");
			continue;
		}
		let data;
		try
		{
			data = parseYaml(frontmatter);
		}
		catch (error)
		{
			fail(`${dirName}/${file}`, `frontmatter 不是合法 YAML：${error.message}`);
			continue;
		}
		entries.set(id, { id, file: `${dirName}/${file}`, data, body: body.trim() });
	}
	return entries;
}

async function loadCategoryKeys()
{
	const source = await readFile(path.join(root, "src", "data", "categories.ts"), "utf8");
	const keys = [...source.matchAll(/^\s*key:\s*"([^"]+)"/gm)].map((m) => m[1]);
	if (keys.length === 0)
	{
		fail("src/data/categories.ts", "解析不出任何分类 key，校验无法进行");
	}
	return keys;
}

function findLineageCycle(moves)
{
	const state = new Map();
	const stack = [];

	function visit(id)
	{
		const seen = state.get(id) ?? 0;
		if (seen === 2) return null;
		if (seen === 1)
		{
			const start = stack.indexOf(id);
			return [...stack.slice(start), id];
		}
		state.set(id, 1);
		stack.push(id);
		const parents = moves.get(id).data.derivedFrom ?? [];
		for (const parent of parents)
		{
			if (!moves.has(parent)) continue;
			const cycle = visit(parent);
			if (cycle) return cycle;
		}
		stack.pop();
		state.set(id, 2);
		return null;
	}

	for (const id of moves.keys())
	{
		const cycle = visit(id);
		if (cycle) return cycle;
	}
	return null;
}

const categoryKeys = await loadCategoryKeys();
const categorySet = new Set(categoryKeys);
const moves = await loadCollection("moves");
const artists = await loadCollection("artists");
const decks = await loadCollection("decks");

if (moves.size === 0)
{
	fail("src/content/moves", "一个动作条目都没有");
}

const seenTitleEn = new Map();
const seenOrder = new Map();
const usedCategories = new Set();

for (const move of moves.values())
{
	const where = move.file;
	const d = move.data;

	if (!categorySet.has(d.category))
	{
		fail(where, `category "${d.category}" 不在分类表中（合法值：${categoryKeys.join(", ")}）`);
	}
	usedCategories.add(d.category);

	if (!Number.isInteger(d.difficulty) || d.difficulty < 1 || d.difficulty > 5)
	{
		fail(where, `difficulty 必须是 1–5 的整数，当前为 ${JSON.stringify(d.difficulty)}`);
	}

	if (typeof d.titleEn !== "string" || d.titleEn.trim() === "")
	{
		fail(where, "titleEn 不能为空");
	}
	else if (seenTitleEn.has(d.titleEn))
	{
		fail(where, `titleEn "${d.titleEn}" 与 ${seenTitleEn.get(d.titleEn)} 重复`);
	}
	else
	{
		seenTitleEn.set(d.titleEn, where);
	}

	if (d.status === "stub")
	{
		if ((d.creators ?? []).length > 0)
		{
			fail(where, `status 为 stub 的条目不得填写 creators（当前：${d.creators.join(", ")}）`);
		}
		if (d.firstPublicYear !== null && d.firstPublicYear !== undefined)
		{
			fail(where, `status 为 stub 的条目不得填写 firstPublicYear（当前：${d.firstPublicYear}）`);
		}
	}
	else if ((d.sources ?? []).length === 0)
	{
		fail(where, `status 为 ${d.status} 的条目必须至少有一条 sources`);
	}

	for (const creator of d.creators ?? [])
	{
		if (!artists.has(creator))
		{
			fail(where, `creators 引用了不存在的人物 "${creator}"`);
		}
	}

	for (const field of ["prerequisites", "derivedFrom"])
	{
		for (const ref of d[field] ?? [])
		{
			if (!moves.has(ref))
			{
				fail(where, `${field} 引用了不存在的动作 "${ref}"`);
			}
			if (ref === move.id)
			{
				fail(where, `${field} 不能引用自身`);
			}
		}
	}

	for (const [index, media] of (d.media ?? []).entries())
	{
		const label = `${where} media[${index}]`;
		if (typeof media.credit !== "string" || media.credit.trim() === "")
		{
			fail(label, "缺少 credit（署名），不允许上传");
		}
		if (typeof media.license !== "string" || media.license.trim() === "")
		{
			fail(label, "缺少 license（授权说明），不允许上传");
		}
		if (media.url && media.url.startsWith("/") && media.provider !== "self")
		{
			fail(label, `本地路径 ${media.url} 只允许 provider: self 使用，不得存放他人影像的本地副本`);
		}
		if (!media.sourceUrl)
		{
			note(label, "建议补上 sourceUrl，便于撤下时定位原始出处");
		}
	}

	if (move.body.length === 0)
	{
		note(where, "正文为空，展品说明页会是空白");
	}

	if (typeof d.order === "number")
	{
		if (seenOrder.has(d.order))
		{
			note(where, `order ${d.order} 与 ${seenOrder.get(d.order)} 重复，排序结果不稳定`);
		}
		else
		{
			seenOrder.set(d.order, where);
		}
	}
}

const cycle = findLineageCycle(moves);
if (cycle)
{
	fail("谱系", `derivedFrom 存在环：${cycle.join(" → ")}`);
}

for (const artist of artists.values())
{
	if (artist.body.length === 0)
	{
		note(artist.file, "正文为空");
	}
}

const unused = categoryKeys.filter((key) => !usedCategories.has(key));

const line = "─".repeat(52);
console.log(line);
console.log(`动作 ${moves.size} · 人物 ${artists.size} · 器物 ${decks.size} · 分类 ${categoryKeys.length}`);
console.log(line);

if (unused.length > 0)
{
	console.log(`空分类（${unused.length}）：${unused.join(", ")}`);
}

if (warnings.length > 0)
{
	console.log(`\n提醒 ${warnings.length} 条：`);
	for (const w of warnings) console.log(`  · ${w}`);
}

if (errors.length > 0)
{
	console.log(`\n错误 ${errors.length} 条：`);
	for (const e of errors) console.log(`  ✗ ${e}`);
	console.log(line);
	console.log("校验未通过");
	process.exit(1);
}

console.log(`\n校验通过：0 错误，${warnings.length} 提醒`);
