import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { APIContext } from "astro";
import { atLeast, canProposeEntry, CLOSED_POLICY, proposeBlockReason, type DeviceSession, type Protection, type Role, type SessionUser, type SitePolicy } from "../access";
import { envFlag, envText } from "../env";
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

const COOKIE = "cm_dev_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DATA_DIR = path.resolve(process.cwd(), ".local-data");
const STORE_FILE = path.join(DATA_DIR, "mock-auth.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.jsonl");
const CONTENT_ROOT = path.resolve(process.cwd(), "src", "content");

interface StoredDevice
{
	id: string;
	userId: string;
	userAgent: string;
	ip: string;
	createdAt: string;
	lastSeenAt: string;
	expiresAt: string;
}

interface StoredEntry
{
	collection: string;
	slug: string;
	protection: Protection;
}

interface Store
{
	devices: StoredDevice[];
	members: MemberRow[];
	revisions: RevisionRow[];
	entries: StoredEntry[];
}

const ROLE_ACCOUNT: Record<Role, { email: string; name: string }> = {
	reader: { email: "reader@local.test", name: "本地读者" },
	contributor: { email: "contributor@local.test", name: "本地贡献者" },
	moderator: { email: "moderator@local.test", name: "本地管理员" },
	owner: { email: "owner@local.test", name: "本地站长" }
};

function secret(): string
{
	return envText("DEV_AUTH_SECRET") ?? "cardistry-museum-dev-only-secret";
}

function sign(value: string): string
{
	return createHmac("sha256", secret()).update(value).digest("base64url");
}

function signatureMatches(expected: string, actual: string): boolean
{
	const a = Buffer.from(expected);
	const b = Buffer.from(actual);
	return a.length === b.length && timingSafeEqual(a, b);
}

function nowIso(): string
{
	return new Date().toISOString();
}

function readStore(): Store
{
	try
	{
		const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<Store>;
		return {
			devices: Array.isArray(parsed.devices) ? parsed.devices : [],
			members: Array.isArray(parsed.members) ? parsed.members : [],
			revisions: Array.isArray(parsed.revisions) ? parsed.revisions : [],
			entries: Array.isArray(parsed.entries) ? parsed.entries : []
		};
	}
	catch
	{
		return { devices: [], members: [], revisions: [], entries: [] };
	}
}

function mockPolicy(): SitePolicy
{
	return {
		...CLOSED_POLICY,
		openEditing: envFlag("MOCK_OPEN_EDITING")
	};
}

function writeStore(store: Store): void
{
	mkdirSync(DATA_DIR, { recursive: true });
	writeFileSync(STORE_FILE, `${JSON.stringify(store, null, "\t")}\n`, "utf8");
}

function clientIp(context: APIContext): string
{
	try
	{
		return context.clientAddress;
	}
	catch
	{
		return "127.0.0.1";
	}
}

export function createMockProvider(context: APIContext): AuthProvider
{
	async function currentMember(): Promise<MemberRow | null>
	{
		const cookie = context.cookies.get(COOKIE)?.value;
		if (!cookie)
		{
			return null;
		}
		const dot = cookie.lastIndexOf(".");
		if (dot <= 0)
		{
			return null;
		}
		const id = cookie.slice(0, dot);
		if (!signatureMatches(sign(id), cookie.slice(dot + 1)))
		{
			return null;
		}
		const store = readStore();
		const device = store.devices.find((entry) => entry.id === id) ?? null;
		if (!device || Date.parse(device.expiresAt) <= Date.now())
		{
			return null;
		}
		return store.members.find((entry) => entry.id === device.userId) ?? null;
	}

	async function currentUser(): Promise<SessionUser | null>
	{
		const member = await currentMember();
		if (!member)
		{
			return null;
		}
		return {
			id: member.id,
			email: member.email,
			displayName: member.displayName,
			avatarUrl: null,
			role: member.role,
			suspended: member.suspended,
			createdAt: member.createdAt
		};
	}

	async function guardFor(collection: string, slug: string): Promise<EntryGuard>
	{
		const member = await currentMember();
		const role = member && !member.suspended ? member.role : null;
		const policy = mockPolicy();
		const protection = readStore().entries.find((entry) => entry.collection === collection && entry.slug === slug)?.protection ?? "owner_only";
		return {
			protection,
			canEdit: canProposeEntry(role, policy, protection),
			reason: proposeBlockReason(role, policy, protection)
		};
	}

	function currentDeviceId(): string | null
	{
		const cookie = context.cookies.get(COOKIE)?.value;
		if (!cookie)
		{
			return null;
		}
		const dot = cookie.lastIndexOf(".");
		return dot > 0 ? cookie.slice(0, dot) : null;
	}

	function mutate(change: (store: Store) => void): Store
	{
		const store = readStore();
		change(store);
		writeStore(store);
		return store;
	}

	return {
		mode: "mock",
		getUser: currentUser,
		async getPolicy(): Promise<SitePolicy>
		{
			return mockPolicy();
		},
		async signInWithGitHub(): Promise<SignInResult>
		{
			return { url: null, error: "本地开发模式未接 GitHub OAuth，请用下方角色切换登录。" };
		},
		async signInWithEmailOtp(): Promise<SignInResult>
		{
			return { url: null, error: "本地开发模式不发邮件，请用下方角色切换登录。" };
		},
		async completeSignIn()
		{
			return { error: "本地开发模式不走回调，请从登录页直接选择角色。" };
		},
		async signOut(scope)
		{
			const deviceId = currentDeviceId();
			mutate((store) =>
			{
				if (scope === "global")
				{
					store.devices = [];
				}
				else if (scope === "others")
				{
					store.devices = store.devices.filter((entry) => entry.id === deviceId);
				}
				else
				{
					store.devices = store.devices.filter((entry) => entry.id !== deviceId);
				}
			});
			if (scope !== "others")
			{
				context.cookies.delete(COOKIE, { path: "/" });
			}
			return { error: null };
		},
		async listSessions(): Promise<DeviceSession[]>
		{
			const member = await currentMember();
			if (!member)
			{
				return [];
			}
			const deviceId = currentDeviceId();
			return readStore()
				.devices.filter((entry) => entry.userId === member.id)
				.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
				.map((entry) => ({
					id: entry.id,
					current: entry.id === deviceId,
					userAgent: entry.userAgent,
					ip: entry.ip,
					createdAt: entry.createdAt,
					lastSeenAt: entry.lastSeenAt
				}));
		},
		async revokeSession(sessionId)
		{
			const member = await currentMember();
			if (!member)
			{
				return { error: "未登录。" };
			}
			const target = readStore().devices.find((entry) => entry.id === sessionId) ?? null;
			if (!target)
			{
				return { error: "找不到该设备会话，可能已被吊销。" };
			}
			if (target.userId !== member.id)
			{
				return { error: "只能吊销本人设备。" };
			}
			mutate((store) =>
			{
				store.devices = store.devices.filter((entry) => entry.id !== sessionId);
			});
			return { error: null };
		},
		async logAudit(event: AuditEvent): Promise<void>
		{
			mkdirSync(DATA_DIR, { recursive: true });
			const member = await currentMember();
			const line = JSON.stringify({
				at: nowIso(),
				actor: member?.email ?? null,
				role: member?.role ?? null,
				action: event.action,
				targetType: event.targetType ?? null,
				targetId: event.targetId ?? null,
				detail: event.detail ?? {},
				ip: clientIp(context)
			});
			appendFileSync(AUDIT_FILE, `${line}\n`, "utf8");
		},
		async listAudit(limit: number): Promise<AuditRow[]>
		{
			if (!existsSync(AUDIT_FILE))
			{
				return [];
			}
			return readFileSync(AUDIT_FILE, "utf8")
				.split("\n")
				.filter((line) => line.trim() !== "")
				.slice(-limit)
				.reverse()
				.map((line) =>
				{
					try
					{
						return JSON.parse(line) as AuditRow;
					}
					catch
					{
						return null;
					}
				})
				.filter((row): row is AuditRow => row !== null);
		},
		async stats(): Promise<WikiStats>
		{
			let registered = 0;
			for (const folder of ["moves", "artists", "decks"])
			{
				const dir = path.join(CONTENT_ROOT, folder);
				if (existsSync(dir))
				{
					registered += readdirSync(dir).filter((name) => name.endsWith(".md")).length;
				}
			}
			return {
				registeredEntries: registered,
				revisionsPending: 0,
				revisionsPublished: 0,
				users: readStore().members.length
			};
		},
		async listMembers(): Promise<MemberRow[]>
		{
			return readStore().members.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		},
		async setMemberRole(targetId, role)
		{
			const actor = await currentMember();
			if (!actor || !atLeast(actor.role, "owner"))
			{
				return { error: "只有站长可以调整他人角色。" };
			}
			const target = readStore().members.find((entry) => entry.id === targetId) ?? null;
			if (!target)
			{
				return { error: "找不到该成员。" };
			}
			if (target.id === actor.id)
			{
				return { error: "不能调整自己的角色。" };
			}
			mutate((store) =>
			{
				const row = store.members.find((entry) => entry.id === targetId);
				if (row)
				{
					row.role = role;
				}
			});
			return { error: null };
		},
		async setMemberSuspended(targetId, suspended)
		{
			const actor = await currentMember();
			if (!actor || !atLeast(actor.role, "moderator"))
			{
				return { error: "只有管理员以上可以停用账号。" };
			}
			const target = readStore().members.find((entry) => entry.id === targetId) ?? null;
			if (!target)
			{
				return { error: "找不到该成员。" };
			}
			if (target.role === "owner")
			{
				return { error: "站长账号不可停用。" };
			}
			mutate((store) =>
			{
				const row = store.members.find((entry) => entry.id === targetId);
				if (row)
				{
					row.suspended = suspended;
				}
			});
			return { error: null };
		},
		async getEntryGuard(collection, slug): Promise<EntryGuard>
		{
			return guardFor(collection, slug);
		},
		async listRevisions(query: RevisionQuery): Promise<RevisionRow[]>
		{
			return readStore()
				.revisions.filter((row) => !query.collection || row.collection === query.collection)
				.filter((row) => !query.slug || row.slug === query.slug)
				.filter((row) => !query.status || row.status === query.status)
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.slice(0, query.limit);
		},
		async submitRevision(input: RevisionInput)
		{
			const user = await currentUser();
			const guard = await guardFor(input.collection, input.slug);
			if (!guard.canEdit)
			{
				return { id: null, error: guard.reason || "当前角色没有提交权限。" };
			}
			if (input.body.trim() === "")
			{
				return { id: null, error: "正文不能为空。" };
			}
			const direct = atLeast(user?.role ?? null, "moderator");
			const row: RevisionRow = {
				id: randomUUID(),
				collection: input.collection,
				slug: input.slug,
				title: input.title,
				authorId: user?.id ?? "unknown",
				authorEmail: user?.email ?? null,
				note: input.note,
				body: input.body,
				status: direct ? "published" : "pending",
				createdAt: nowIso(),
				reviewedAt: direct ? nowIso() : null,
				reviewNote: null
			};
			mutate((store) =>
			{
				store.revisions.push(row);
				if (!store.entries.some((entry) => entry.collection === row.collection && entry.slug === row.slug))
				{
					store.entries.push({ collection: row.collection, slug: row.slug, protection: "owner_only" });
				}
			});
			return { id: row.id, error: null };
		},
		async reviewRevision(id, decision, note)
		{
			const user = await currentUser();
			if (!user || !atLeast(user.role, "moderator"))
			{
				return { error: "只有管理员以上可以审核修订。" };
			}
			if (!readStore().revisions.some((row) => row.id === id))
			{
				return { error: "找不到该修订。" };
			}
			mutate((store) =>
			{
				const row = store.revisions.find((entry) => entry.id === id);
				if (row)
				{
					row.status = decision;
					row.reviewedAt = nowIso();
					row.reviewNote = note === "" ? null : note;
				}
			});
			return { error: null };
		},
		async devSignIn(role: Role): Promise<void>
		{
			const userId = `mock-user-${role}`;
			const account = ROLE_ACCOUNT[role];
			const device: StoredDevice = {
				id: randomUUID(),
				userId,
				userAgent: context.request.headers.get("user-agent") ?? "unknown",
				ip: clientIp(context),
				createdAt: nowIso(),
				lastSeenAt: nowIso(),
				expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
			};
			mutate((store) =>
			{
				const existing = store.members.find((entry) => entry.id === userId);
				if (existing)
				{
					existing.role = role;
					existing.lastSeenAt = device.createdAt;
				}
				else
				{
					store.members.push({
						id: userId,
						email: account.email,
						displayName: account.name,
						role,
						suspended: false,
						createdAt: device.createdAt,
						lastSeenAt: device.createdAt
					});
				}
				store.devices.push(device);
			});
			context.cookies.set(COOKIE, `${device.id}.${sign(device.id)}`, {
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				maxAge: SESSION_TTL_SECONDS
			});
		}
	};
}
