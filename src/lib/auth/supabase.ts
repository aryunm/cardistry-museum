import { createServerClient } from "@supabase/ssr";
import type { APIContext } from "astro";
import { canProposeEntry, CLOSED_POLICY, isRole, proposeBlockReason, type DeviceSession, type SessionUser, type SitePolicy } from "../access";
import { envText } from "../env";
import type {
	AuditEvent,
	AuditRow,
	AuthProvider,
	EntryGuard,
	MemberRow,
	RevisionInput,
	RevisionQuery,
	RevisionRow,
	SignInResult,
	WikiStats
} from "./provider";

function decodeBase64Url(part: string): string
{
	const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function readSessionId(accessToken: string | undefined): string | null
{
	if (!accessToken)
	{
		return null;
	}
	const part = accessToken.split(".")[1];
	if (!part)
	{
		return null;
	}
	try
	{
		const payload = JSON.parse(decodeBase64Url(part)) as { session_id?: string };
		return payload.session_id ?? null;
	}
	catch
	{
		return null;
	}
}

export function createSupabaseProvider(context: APIContext): AuthProvider
{
	const supabase = createServerClient(envText("PUBLIC_SUPABASE_URL"), envText("PUBLIC_SUPABASE_ANON_KEY"), {
		cookies: {
			getAll: () => context.cookies.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
			setAll: (list) =>
			{
				for (const item of list)
				{
					context.cookies.set(item.name, item.value, { ...item.options, path: item.options?.path ?? "/" });
				}
			}
		}
	});

	async function policy(): Promise<SitePolicy>
	{
		const { data } = await supabase.from("site_settings").select("key, value").in("key", ["open_editing", "open_registration"]);
		const map = new Map((data ?? []).map((row) => [row.key as string, row.value]));
		return {
			openEditing: map.get("open_editing") === true,
			openRegistration: map.get("open_registration") === true
		};
	}

	return {
		mode: "supabase",
		async getUser(): Promise<SessionUser | null>
		{
			const { data, error } = await supabase.auth.getUser();
			if (error || !data.user)
			{
				return null;
			}
			const { data: profile } = await supabase
				.from("profiles")
				.select("role, display_name, avatar_url, suspended, created_at")
				.eq("id", data.user.id)
				.maybeSingle();
			return {
				id: data.user.id,
				email: data.user.email ?? "",
				displayName: profile?.display_name ?? data.user.email ?? "",
				avatarUrl: profile?.avatar_url ?? null,
				role: isRole(profile?.role) ? profile.role : "reader",
				suspended: profile?.suspended === true,
				createdAt: profile?.created_at ?? data.user.created_at ?? new Date().toISOString()
			};
		},
		getPolicy: policy,
		async signInWithGitHub(redirectTo): Promise<SignInResult>
		{
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: "github",
				options: { redirectTo, skipBrowserRedirect: true }
			});
			return { url: data?.url ?? null, error: error?.message ?? null };
		},
		async signInWithEmailOtp(email, redirectTo): Promise<SignInResult>
		{
			const current = await policy();
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo: redirectTo, shouldCreateUser: current.openRegistration }
			});
			return { url: null, error: error?.message ?? null };
		},
		async completeSignIn(code)
		{
			const { error } = await supabase.auth.exchangeCodeForSession(code);
			return { error: error?.message ?? null };
		},
		async signOut(scope)
		{
			if (scope !== "others")
			{
				const { error } = await supabase.auth.signOut({ scope });
				return { error: error?.message ?? null };
			}
			// supabase-js 的 signOut 无论 scope 都会清掉本地会话，会把当前设备一起登出；
			// 「吊销其他设备」改为只吊销 auth.sessions 里除当前会话之外的行。
			const { data: sessionData } = await supabase.auth.getSession();
			const currentId = readSessionId(sessionData.session?.access_token);
			if (!currentId)
			{
				return { error: "未登录。" };
			}
			const { data, error } = await supabase.rpc("my_sessions");
			if (error || !data)
			{
				return { error: error?.message ?? "无法读取设备会话。" };
			}
			const others = (data as { id: string }[]).filter((row) => row.id !== currentId);
			for (const row of others)
			{
				const { error: revokeError } = await supabase.rpc("revoke_session", { target: row.id });
				if (revokeError)
				{
					return { error: revokeError.message };
				}
			}
			return { error: null };
		},
		async listSessions(): Promise<DeviceSession[]>
		{
			const { data: sessionData } = await supabase.auth.getSession();
			const currentId = readSessionId(sessionData.session?.access_token);
			const { data, error } = await supabase.rpc("my_sessions");
			if (error || !data)
			{
				return [];
			}
			return (data as { id: string; created_at: string; updated_at: string; ip: string | null; user_agent: string | null }[])
				.map((row) => ({
					id: row.id,
					current: row.id === currentId,
					userAgent: row.user_agent ?? "unknown",
					ip: row.ip ?? "未知",
					createdAt: row.created_at,
					lastSeenAt: row.updated_at
				}))
				.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
		},
		async revokeSession(sessionId)
		{
			const { error } = await supabase.rpc("revoke_session", { target: sessionId });
			return { error: error?.message ?? null };
		},
		async logAudit(event: AuditEvent): Promise<void>
		{
			await supabase.rpc("log_audit", {
				p_action: event.action,
				p_target_type: event.targetType ?? null,
				p_target_id: event.targetId ?? null,
				p_detail: event.detail ?? {}
			});
		},
		async listAudit(limit: number): Promise<AuditRow[]>
		{
			const { data, error } = await supabase
				.from("audit_log")
				.select("created_at, action, target_type, target_id, detail, actor_role, profiles(email)")
				.order("created_at", { ascending: false })
				.limit(limit);
			if (error || !data)
			{
				return [];
			}
			return data.map((row) =>
			{
				const nested = row.profiles as { email?: string } | { email?: string }[] | null;
				const email = Array.isArray(nested) ? nested[0]?.email : nested?.email;
				return {
					at: row.created_at as string,
					actor: email ?? null,
					role: (row.actor_role as string | null) ?? null,
					action: row.action as string,
					targetType: (row.target_type as string | null) ?? null,
					targetId: (row.target_id as string | null) ?? null,
					detail: (row.detail as Record<string, unknown>) ?? {}
				};
			});
		},
		async stats(): Promise<WikiStats>
		{
			const [entries, pending, published, users] = await Promise.all([
				supabase.from("entries").select("slug", { count: "exact", head: true }),
				supabase.from("revisions").select("id", { count: "exact", head: true }).eq("status", "pending"),
				supabase.from("revisions").select("id", { count: "exact", head: true }).eq("status", "published"),
				supabase.from("profiles").select("id", { count: "exact", head: true })
			]);
			return {
				registeredEntries: entries.count ?? 0,
				revisionsPending: pending.count ?? 0,
				revisionsPublished: published.count ?? 0,
				users: users.count ?? 0
			};
		},
		async listMembers(): Promise<MemberRow[]>
		{
			const { data, error } = await supabase
				.from("profiles")
				.select("id, email, display_name, role, suspended, created_at, last_seen_at")
				.order("created_at", { ascending: true });
			if (error || !data)
			{
				return [];
			}
			return data.map((row) => ({
				id: row.id as string,
				email: (row.email as string) ?? "",
				displayName: (row.display_name as string) ?? "",
				role: isRole(row.role) ? row.role : "reader",
				suspended: row.suspended === true,
				createdAt: row.created_at as string,
				lastSeenAt: row.last_seen_at as string
			}));
		},
		async setMemberRole(targetId, role)
		{
			const { error } = await supabase.rpc("set_member_role", { target: targetId, new_role: role });
			return { error: error?.message ?? null };
		},
		async setMemberSuspended(targetId, suspended)
		{
			const { error } = await supabase.rpc("set_member_suspended", { target: targetId, suspended });
			return { error: error?.message ?? null };
		},
		async listRevisions(query: RevisionQuery): Promise<RevisionRow[]>
		{
			let request = supabase
				.from("revisions")
				.select("id, collection, slug, title, author_id, note, body, status, created_at, reviewed_at, review_note, profiles(email)")
				.order("created_at", { ascending: false })
				.limit(query.limit);
			if (query.collection)
			{
				request = request.eq("collection", query.collection);
			}
			if (query.slug)
			{
				request = request.eq("slug", query.slug);
			}
			if (query.status)
			{
				request = request.eq("status", query.status);
			}
			const { data, error } = await request;
			if (error || !data)
			{
				return [];
			}
			return data.map((row) =>
			{
				const nested = row.profiles as { email?: string } | { email?: string }[] | null;
				const email = Array.isArray(nested) ? nested[0]?.email : nested?.email;
				return {
					id: row.id as string,
					collection: row.collection as string,
					slug: row.slug as string,
					title: row.title as string,
					authorId: row.author_id as string,
					authorEmail: email ?? null,
					note: (row.note as string) ?? "",
					body: (row.body as string) ?? "",
					status: row.status as RevisionRow["status"],
					createdAt: row.created_at as string,
					reviewedAt: (row.reviewed_at as string | null) ?? null,
					reviewNote: (row.review_note as string | null) ?? null
				};
			});
		},
		async submitRevision(input: RevisionInput)
		{
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user)
			{
				return { id: null, error: "未登录。" };
			}
			const { data, error } = await supabase
				.from("revisions")
				.insert({
					collection: input.collection,
					slug: input.slug,
					title: input.title,
					note: input.note,
					body: input.body,
					author_id: userData.user.id
				})
				.select("id")
				.single();
			if (error)
			{
				return { id: null, error: error.message };
			}
			return { id: data.id as string, error: null };
		},
		async reviewRevision(id, decision, note)
		{
			const { error } = await supabase.rpc("review_revision", {
				target: id,
				decision,
				review_note: note
			});
			return { error: error?.message ?? null };
		},
		async getEntryGuard(collection, slug): Promise<EntryGuard>
		{
			const { data: userData } = await supabase.auth.getUser();
			let role: SessionUser["role"] | null = null;
			if (userData.user)
			{
				const { data: profile } = await supabase.from("profiles").select("role, suspended").eq("id", userData.user.id).maybeSingle();
				if (profile && profile.suspended !== true && isRole(profile.role))
				{
					role = profile.role;
				}
			}
			const { data: entry } = await supabase.from("entries").select("protection").eq("collection", collection).eq("slug", slug).maybeSingle();
			const protection = entry?.protection === "open" ? "open" : "owner_only";
			const current = await policy();
			return {
				protection,
				canEdit: canProposeEntry(role, current, protection),
				reason: proposeBlockReason(role, current, protection)
			};
		}
	};
}
