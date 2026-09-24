import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_PATH ?? "/";
const OUT = process.env.OUT_DIR ?? "dist/client";

function walk(dir)
{
	const out = [];
	for (const name of readdirSync(dir))
	{
		const path = join(dir, name);
		if (statSync(path).isDirectory())
		{
			out.push(...walk(path));
		}
		else if (name.endsWith(".html"))
		{
			out.push(path);
		}
	}
	return out;
}

if (BASE === "/")
{
	console.log("base 为 /，跳过站内链接前缀检查。");
	process.exit(0);
}

const files = walk(OUT);
const problems = [];
const attribute = /(?:href|src|action)="([^"]+)"/g;

for (const file of files)
{
	const html = readFileSync(file, "utf8");
	for (const match of html.matchAll(attribute))
	{
		const value = match[1];
		if (!value.startsWith("/") || value.startsWith("//"))
		{
			continue;
		}
		if (value.startsWith(BASE))
		{
			continue;
		}
		problems.push(`${file} -> ${value}`);
	}
}

if (problems.length > 0)
{
	console.error(`发现 ${problems.length} 处未加 base 前缀的站内链接：`);
	for (const line of problems.slice(0, 40))
	{
		console.error(`  ${line}`);
	}
	console.error("站内链接请统一使用 src/lib/url.ts 的 withBase()。");
	process.exit(1);
}

console.log(`站内链接检查通过：${files.length} 个 HTML，全部带 ${BASE} 前缀。`);
