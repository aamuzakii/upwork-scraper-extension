# Upwork Spider extension

## Build and load

Run `yarn build`, then load or reload the `dist/` directory as the unpacked Chrome extension.

## Firefox XPI

Run `yarn xpi`. It rebuilds `dist/`, creates
`web-ext-artifacts/upwork-spider-0.1.xpi`, verifies that `manifest.json` is at
the archive root, and runs a ZIP integrity test. The generated file is an
unsigned XPI: install it temporarily through `about:debugging` in Firefox
Developer Edition/Nightly, or submit it to AMO for signing before installing it
in standard Firefox.

## Threads productivity flag

Threads is hidden by default. It is shown only when Supabase has an enabled
`threads_access` flag. Create the table and row once in the Supabase SQL editor:

```sql
create table public.extension_flags (
  key text primary key,
  enabled boolean not null default false
);

alter table public.extension_flags enable row level security;

create policy "public can read extension flags"
on public.extension_flags for select
to anon
using (true);

insert into public.extension_flags (key, enabled)
values ('threads_access', false)
on conflict (key) do nothing;
```

Toggle `enabled` to `true` to permit Threads. If the flag is missing or the
Supabase request fails, the site remains hidden.

## Threads session limit

This personal extension uses one shared server-side Threads session: 15 minutes
of access followed by a 30-minute cooldown. Run
[`sql/threads-session-policy.sql`](sql/threads-session-policy.sql) once in the
Supabase SQL editor. Because there is a single database row, all of your
devices share the same session and cooldown automatically.

## Rumah123 hydration timing

Rumah123 uses React hydration. Do not change the page DOM as soon as the content script loads: React can replace that early DOM, which makes injected controls disappear and may trigger React hydration error #418.

`content/rumah123.js` waits for the page `load` event and then waits one more second before it starts its observer or injects any controls. Keep this startup sequence when adding page UI or modifying listing elements.

If a future UI needs to run earlier, test it with a hard reload and confirm that it remains in the Elements panel after Rumah123 finishes rendering.
