# Upwork Spider extension

## Build and load

Run `yarn build`, then load or reload the `dist/` directory as the unpacked Chrome extension.

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

## Rumah123 hydration timing

Rumah123 uses React hydration. Do not change the page DOM as soon as the content script loads: React can replace that early DOM, which makes injected controls disappear and may trigger React hydration error #418.

`content/rumah123.js` waits for the page `load` event and then waits one more second before it starts its observer or injects any controls. Keep this startup sequence when adding page UI or modifying listing elements.

If a future UI needs to run earlier, test it with a hard reload and confirm that it remains in the Elements panel after Rumah123 finishes rendering.
