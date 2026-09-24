import type { DeviceSession, Protection, Role, SessionUser, SitePolicy } from "../access";

export type AuthMode = "supabase" | "mock" | "disabled";

export interface SignInResult
{
	url: string | null;
	error: string | null;
}

export interface AuditEvent
{
	action: string;
	targetType?: string;
	targetId?: string;
	detail?: Record<string, unknown>;
}

export interface AuditRow
{
	at: string;
	actor: string | null;
	role: string | null;
	action: string;
	targetType: string | null;
	targetId: string | null;
	detail: Record<string, unknown>;
}

export interface WikiStats
{
	registeredEntries: number;
	revisionsPending: number;
	revisionsPublished: number;
	users: number;
}

export interface MemberRow
{
	id: string;
	email: string;
	displayName: string;
	role: Role;
	suspended: boolean;
	createdAt: string;
	lastSeenAt: string;
}

export type RevisionStatus = "pending" | "approved" | "rejected" | "published";

export interface RevisionRow
{
	id: string;
	collection: string;
	slug: string;
	title: string;
	authorId: string;
	authorEmail: string | null;
	note: string;
	body: string;
	status: RevisionStatus;
	createdAt: string;
	reviewedAt: string | null;
	reviewNote: string | null;
}

export interface RevisionInput
{
	collection: string;
	slug: string;
	title: string;
	note: string;
	body: string;
}

export interface RevisionQuery
{
	collection?: string;
	slug?: string;
	status?: RevisionStatus;
	limit: number;
}

export interface EntryGuard
{
	protection: Protection;
	canEdit: boolean;
	reason: string;
}

export interface AuthProvider
{
	mode: AuthMode;
	getUser(): Promise<SessionUser | null>;
	getPolicy(): Promise<SitePolicy>;
	signInWithGitHub(redirectTo: string): Promise<SignInResult>;
	signInWithEmailOtp(email: string, redirectTo: string): Promise<SignInResult>;
	completeSignIn(code: string): Promise<{ error: string | null }>;
	signOut(scope: "local" | "others" | "global"): Promise<{ error: string | null }>;
	listSessions(): Promise<DeviceSession[]>;
	revokeSession(sessionId: string): Promise<{ error: string | null }>;
	logAudit(event: AuditEvent): Promise<void>;
	listAudit(limit: number): Promise<AuditRow[]>;
	stats(): Promise<WikiStats>;
	listMembers(): Promise<MemberRow[]>;
	setMemberRole(targetId: string, role: Role): Promise<{ error: string | null }>;
	setMemberSuspended(targetId: string, suspended: boolean): Promise<{ error: string | null }>;
	listRevisions(query: RevisionQuery): Promise<RevisionRow[]>;
	submitRevision(input: RevisionInput): Promise<{ id: string | null; error: string | null }>;
	reviewRevision(id: string, decision: "approved" | "rejected", note: string): Promise<{ error: string | null }>;
	getEntryGuard(collection: string, slug: string): Promise<EntryGuard>;
	devSignIn?(role: Role): Promise<void>;
}
