-- One shared Threads session for this personal extension installation.
-- The function is atomic, so opening Threads on another device cannot create
-- a second 15-minute allowance.
create table if not exists public.threads_session_policy (
  id boolean primary key default true check (id),
  session_started_at timestamptz,
  cooldown_until timestamptz
);

alter table public.threads_session_policy enable row level security;

create or replace function public.claim_threads_session()
returns table (
  allowed boolean,
  session_ends_at timestamptz,
  cooldown_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  state public.threads_session_policy%rowtype;
  current_time timestamptz := now();
begin
  -- Serializes requests from every browser/device against the one shared row.
  perform pg_advisory_xact_lock(hashtext('threads_session_policy'));

  select * into state
  from public.threads_session_policy
  where id = true
  for update;

  if not found then
    insert into public.threads_session_policy (id, session_started_at)
    values (true, current_time)
    returning * into state;
  elsif state.cooldown_until is not null and state.cooldown_until > current_time then
    return query select false, null::timestamptz, state.cooldown_until;
    return;
  elsif state.session_started_at is not null
    and state.session_started_at + interval '15 minutes' <= current_time then
    update public.threads_session_policy
    set session_started_at = null,
        cooldown_until = current_time + interval '30 minutes'
    where id = true
    returning * into state;

    return query select false, null::timestamptz, state.cooldown_until;
    return;
  elsif state.session_started_at is null then
    update public.threads_session_policy
    set session_started_at = current_time,
        cooldown_until = null
    where id = true
    returning * into state;
  end if;

  return query select true, state.session_started_at + interval '15 minutes', null::timestamptz;
end;
$$;

revoke all on function public.claim_threads_session() from public;
grant execute on function public.claim_threads_session() to anon;
