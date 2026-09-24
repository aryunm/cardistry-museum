const RAW_BASE = import.meta.env.BASE_URL ?? "/";

const BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

export function withBase(path: string): string
{
	if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//"))
	{
		return path;
	}
	const clean = path.startsWith("/") ? path : `/${path}`;
	return `${BASE}${clean}`;
}
