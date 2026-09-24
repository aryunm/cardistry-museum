const raw = import.meta.env as unknown as Record<string, string | boolean | undefined>;

export function envText(name: string): string | undefined
{
	const value = raw[name];
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function envFlag(name: string): boolean
{
	const value = raw[name];
	return value === true || value === "true";
}

export function hasSupabaseCredentials(): boolean
{
	return Boolean(envText("PUBLIC_SUPABASE_URL") && envText("PUBLIC_SUPABASE_ANON_KEY"));
}
