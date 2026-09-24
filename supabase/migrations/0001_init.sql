-- 花切维基 · 身份、修订与审计骨架
-- 施加方式见 README「接入 Supabase」一节。本文件按 Supabase 托管库（Postgres 15）编写。
-- 注意：编写环境没有真实 Postgres 实例，此文件未经实际执行验证。

create extension if not exists "pgcrypto";

create type user_role as enum ('reader', 'contributor', 'moderator', 'owner');
create type revision_status as enum ('pending', 'approved', 'rejected', 'published');
create type entry_protection as enum ('owner_only', 'open');

create table public.profiles
(
	id uuid primary key references auth.users (id) on delete cascade,
	email text not null default '',
	display_name text not null default '',
	avatar_url text,
	role user_role not null default 'reader',
	suspended boolean not null default false,
	created_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now()
);

create table public.site_settings
(
	key text primary key,
	value jsonb not null,
	updated_at timestamptz not null default now()
);

create table public.entries
(
	collection text not null,
	slug text not null,
	title text not null default '',
	protection entry_protection not null default 'owner_only',
	updated_at timestamptz not null default now(),
	primary key (collection, slug)
);

create table public.revisions
(
	id uuid primary key default gen_random_uuid(),
	collection text not null,
	slug text not null,
	title text not null default '',
	author_id uuid not null references auth.users (id) on delete cascade,
	base_sha text,
	body text not null,
	note text not null default '',
	status revision_status not null default 'pending',
	reviewed_by uuid references auth.users (id) on delete set null,
	reviewed_at timestamptz,
	review_note text,
	published_commit text,
	created_at timestamptz not null default now()
);

create index revisions_status_created_idx on public.revisions (status, created_at desc);
create index revisions_entry_created_idx on public.revisions (collection, slug, created_at desc);

create table public.audit_log
(
	id bigserial primary key,
	actor_id uuid references auth.users (id) on delete set null,
	actor_role user_role,
	action text not null,
	target_type text,
	target_id text,
	detail jsonb not null default '{}'::jsonb,
	ip text,
	user_agent text,
	created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

insert into public.site_settings (key, value)
values
	('open_editing', 'false'::jsonb),
	('open_registration', 'false'::jsonb),
	('owner_emails', '[]'::jsonb)
on conflict (key) do nothing;

create function public.actor_role() returns user_role
language sql stable security definer set search_path = public
as $$
	select p.role from public.profiles p where p.id = auth.uid() and p.suspended = false;
$$;

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = public
as $$
	select coalesce(public.actor_role() >= 'moderator', false);
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public
as $$
	select coalesce(public.actor_role() >= 'owner', false);
$$;

create function public.open_editing() returns boolean
language sql stable security definer set search_path = public
as $$
	select coalesce((select s.value = 'true'::jsonb from public.site_settings s where s.key = 'open_editing'), false);
$$;

create function public.open_registration() returns boolean
language sql stable security definer set search_path = public
as $$
	select coalesce((select s.value = 'true'::jsonb from public.site_settings s where s.key = 'open_registration'), false);
$$;

-- 条目是否可被当前用户提交修订：与 src/lib/access.ts 的 canProposeEntry 保持同一套规则。
create function public.can_propose_entry(p_collection text, p_slug text) returns boolean
language sql stable security definer set search_path = public
as $$
	select case
		when public.actor_role() >= 'moderator' then true
		when public.actor_role() is null then false
		when coalesce(
			(select e.protection from public.entries e where e.collection = p_collection and e.slug = p_slug),
			'owner_only'::entry_protection
		) = 'owner_only' then false
		else public.open_editing() and public.actor_role() >= 'contributor'
	end;
$$;

-- 首次登录自动建档；邮箱命中 site_settings.owner_emails 时直接给 owner，其余一律 reader。
-- 提权只能由站长在后台显式操作，登录资料里的任何字段都不影响这里。
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
	owner_emails jsonb;
	assigned user_role := 'reader';
begin
	select s.value into owner_emails from public.site_settings s where s.key = 'owner_emails';
	if owner_emails is not null
		and jsonb_typeof(owner_emails) = 'array'
		and lower(coalesce(new.email, '')) in (select lower(value) from jsonb_array_elements_text(owner_emails))
	then
		assigned := 'owner';
	end if;
	insert into public.profiles (id, email, display_name, avatar_url, role)
	values (
		new.id,
		coalesce(new.email, ''),
		coalesce(
			nullif(new.raw_user_meta_data ->> 'full_name', ''),
			nullif(new.raw_user_meta_data ->> 'name', ''),
			nullif(new.raw_user_meta_data ->> 'user_name', ''),
			split_part(coalesce(new.email, ''), '@', 1)
		),
		new.raw_user_meta_data ->> 'avatar_url',
		assigned
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 修订状态由服务端裁决，客户端传什么都不算数。
create function public.revisions_before_insert() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
	new.author_id := coalesce(new.author_id, auth.uid());
	if public.actor_role() >= 'moderator' then
		new.status := 'published';
		new.reviewed_by := auth.uid();
		new.reviewed_at := now();
		new.review_note := null;
	else
		new.status := 'pending';
		new.reviewed_by := null;
		new.reviewed_at := null;
		new.review_note := null;
		new.published_commit := null;
	end if;
	return new;
end;
$$;

create trigger revisions_before_insert
before insert on public.revisions
for each row execute function public.revisions_before_insert();

-- 新条目的保护级别一律从「仅站长可改」起步，站长显式开放才转 open。
create function public.revisions_after_insert() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
	insert into public.entries (collection, slug, title)
	values (new.collection, new.slug, new.title)
	on conflict (collection, slug) do nothing;
	return new;
end;
$$;

create trigger revisions_after_insert
after insert on public.revisions
for each row execute function public.revisions_after_insert();

alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.entries enable row level security;
alter table public.revisions enable row level security;
alter table public.audit_log enable row level security;

-- profiles：本人与管理员以上可读。刻意不设 insert/update/delete 策略，
-- 角色、停用状态一律只能经下面的 SECURITY DEFINER 函数改动。
create policy profiles_select_self_or_staff on public.profiles
for select using (id = auth.uid() or public.is_moderator());

-- 站点开关对所有人可读；owner_emails 这类含个人信息的键只对管理员以上可见。
create policy site_settings_select_public_or_staff on public.site_settings
for select using (key in ('open_editing', 'open_registration') or public.is_moderator());

create policy entries_select_all on public.entries
for select using (true);

create policy revisions_select_own_or_staff on public.revisions
for select using (author_id = auth.uid() or public.is_moderator());

create policy revisions_insert_by_author on public.revisions
for insert with check (author_id = auth.uid() and public.can_propose_entry(collection, slug));

create policy audit_log_select_staff on public.audit_log
for select using (public.is_moderator());

create function public.log_audit(
	p_action text,
	p_target_type text default null,
	p_target_id text default null,
	p_detail jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
	headers jsonb := '{}'::jsonb;
	v_ip text := '';
	v_agent text := '';
begin
	begin
		headers := coalesce(current_setting('request.headers', true)::jsonb, '{}'::jsonb);
	exception when others then
		headers := '{}'::jsonb;
	end;
	v_ip := trim(split_part(coalesce(headers ->> 'x-forwarded-for', ''), ',', 1));
	v_agent := left(coalesce(headers ->> 'user-agent', ''), 400);
	if length(coalesce(p_action, '')) = 0 then
		raise exception 'audit action is required';
	end if;
	insert into public.audit_log (actor_id, actor_role, action, target_type, target_id, detail, ip, user_agent)
	values (auth.uid(), public.actor_role(), left(p_action, 100), left(p_target_type, 40), left(p_target_id, 200), coalesce(p_detail, '{}'::jsonb), v_ip, v_agent);
	if auth.uid() is not null then
		update public.profiles set last_seen_at = now() where id = auth.uid();
	end if;
end;
$$;

create function public.my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, ip text, user_agent text)
language sql stable security definer set search_path = public
as $$
	select s.id, s.created_at, s.updated_at, s.ip::text, s.user_agent
	from auth.sessions s
	where s.user_id = auth.uid()
	order by s.updated_at desc nulls last;
$$;

-- 吊销在访问令牌自然过期后生效：删掉的是刷新令牌所依赖的会话行，已签发的 JWT 仍然有效到期。
create function public.revoke_session(target uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
	owner_id uuid;
begin
	if auth.uid() is null then
		raise exception 'not authenticated';
	end if;
	select s.user_id into owner_id from auth.sessions s where s.id = target;
	if owner_id is null then
		raise exception 'session not found';
	end if;
	if owner_id <> auth.uid() and not public.is_moderator() then
		raise exception 'not allowed';
	end if;
	delete from auth.sessions where id = target;
end;
$$;

create function public.set_member_role(target uuid, new_role user_role) returns void
language plpgsql security definer set search_path = public
as $$
declare
	actor_role_value user_role;
begin
	if not public.is_owner() then
		raise exception 'owner only';
	end if;
	if target = auth.uid() then
		raise exception 'refuse to change own role';
	end if;
	select p.role into actor_role_value from public.profiles p where p.id = target;
	if actor_role_value is null then
		raise exception 'member not found';
	end if;
	if actor_role_value = 'owner' then
		raise exception 'owner rows are immutable';
	end if;
	update public.profiles set role = new_role where id = target;
end;
$$;

create function public.set_member_suspended(target uuid, suspended boolean) returns void
language plpgsql security definer set search_path = public
as $$
<<fn>>
declare
	actor_rank int;
	target_role user_role;
begin
	if not public.is_moderator() then
		raise exception 'moderator or above only';
	end if;
	if target = auth.uid() then
		raise exception 'refuse to suspend own account';
	end if;
	select p.role into target_role from public.profiles p where p.id = target;
	if target_role is null then
		raise exception 'member not found';
	end if;
	actor_rank := case public.actor_role()
		when 'owner' then 3
		when 'moderator' then 2
		when 'contributor' then 1
		else 0
	end;
	if (case target_role when 'owner' then 3 when 'moderator' then 2 when 'contributor' then 1 else 0 end) >= actor_rank then
		raise exception 'cannot suspend a member of equal or higher rank';
	end if;
	update public.profiles set suspended = fn.suspended where id = target;
end;
$$;

create function public.review_revision(target uuid, decision revision_status, review_note text default '') returns void
language plpgsql security definer set search_path = public
as $$
<<fn>>
begin
	if not public.is_moderator() then
		raise exception 'moderator or above only';
	end if;
	if decision not in ('approved', 'rejected') then
		raise exception 'decision must be approved or rejected';
	end if;
	update public.revisions
	set status = decision,
		reviewed_by = auth.uid(),
		reviewed_at = now(),
		review_note = nullif(fn.review_note, '')
	where id = target and status = 'pending';
	if not found then
		raise exception 'pending revision not found';
	end if;
end;
$$;

create function public.set_entry_protection(p_collection text, p_slug text, p_protection entry_protection) returns void
language plpgsql security definer set search_path = public
as $$
begin
	if not public.is_moderator() then
		raise exception 'moderator or above only';
	end if;
	insert into public.entries (collection, slug, protection, updated_at)
	values (p_collection, p_slug, p_protection, now())
	on conflict (collection, slug) do update set protection = excluded.protection, updated_at = now();
end;
$$;

revoke execute on function public.set_member_role(uuid, user_role) from anon;
revoke execute on function public.set_member_suspended(uuid, boolean) from anon;
revoke execute on function public.review_revision(uuid, revision_status, text) from anon;
revoke execute on function public.set_entry_protection(text, text, entry_protection) from anon;
revoke execute on function public.my_sessions() from anon;
revoke execute on function public.revoke_session(uuid) from anon;

grant execute on function public.log_audit(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.actor_role() to anon, authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.open_editing() to anon, authenticated;
grant execute on function public.open_registration() to anon, authenticated;
grant execute on function public.can_propose_entry(text, text) to anon, authenticated;
grant execute on function public.set_member_role(uuid, user_role) to authenticated;
grant execute on function public.set_member_suspended(uuid, boolean) to authenticated;
grant execute on function public.review_revision(uuid, revision_status, text) to authenticated;
grant execute on function public.set_entry_protection(text, text, entry_protection) to authenticated;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_session(uuid) to authenticated;
