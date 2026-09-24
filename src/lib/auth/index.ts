import type { APIContext } from "astro";
import { CLOSED_POLICY, type SessionUser, type SitePolicy } from "../access";
import { hasSupabaseCredentials } from "../env";
import { createMockProvider } from "./mock";
import type { AuthMode, AuthProvider } from "./provider";
import { createSupabaseProvider } from "./supabase";

function disabledProvider(): AuthProvider
{
	const blocked = "本站未配置身份服务，登录功能不可用。";
	return {
		mode: "disabled",
		async getUser(): Promise<SessionUser | null>
		{
			return null;
		},
		async getPolicy(): Promise<SitePolicy>
		{
			return CLOSED_POLICY;
		},
		async signInWithGitHub()
		{
			return { url: null, error: blocked };
		},
		async signInWithEmailOtp()
		{
			return { url: null, error: blocked };
		},
		async completeSignIn()
		{
			return { error: blocked };
		},
		async signOut()
		{
			return { error: blocked };
		},
		async listSessions()
		{
			return [];
		},
		async revokeSession()
		{
			return { error: blocked };
		},
		async logAudit()
		{
			return;
		},
		async listAudit()
		{
			return [];
		},
		async stats()
		{
			return {
				registeredEntries: 0,
				revisionsPending: 0,
				revisionsPublished: 0,
				users: 0
			};
		},
		async listMembers()
		{
			return [];
		},
		async setMemberRole()
		{
			return { error: blocked };
		},
		async setMemberSuspended()
		{
			return { error: blocked };
		},
		async listRevisions()
		{
			return [];
		},
		async submitRevision()
		{
			return { id: null, error: blocked };
		},
		async reviewRevision()
		{
			return { error: blocked };
		},
		async getEntryGuard()
		{
			return { protection: "owner_only", canEdit: false, reason: blocked };
		}
	};
}

export function getAuthProvider(context: APIContext): AuthProvider
{
	if (hasSupabaseCredentials())
	{
		return createSupabaseProvider(context);
	}
	if (import.meta.env.DEV)
	{
		return createMockProvider(context);
	}
	return disabledProvider();
}

export const AUTH_MODE_LABEL: Record<AuthMode, string> = {
	supabase: "Supabase 身份服务",
	mock: "本地开发模式",
	disabled: "未配置"
};

export type { AuthMode, AuthProvider };
