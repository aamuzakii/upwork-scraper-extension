-- House listings schema (Supabase / Postgres)
--
-- One row per listing; upserted on (source, listing_id).
-- Collects the listing URL, an array of image URLs, and the normalized price.
--
-- Run this in the Supabase SQL editor once.

create table if not exists public.houses (
  id         bigint generated always as identity primary key,
  source     text   not null,                 -- "olx" | "facebook" | ...
  listing_id text   not null,                 -- marketplace item id, e.g. "941718629"
  url        text   not null,                 -- full listing url
  images     jsonb  not null default '[]',    -- array of image url strings
  price      bigint,                          -- normalized IDR number, e.g. 33000000
  currency   text   not null default 'IDR',
  unique (source, listing_id)
);

-- Allow the browser extension (anon / publishable key) to write and read.
alter table public.houses enable row level security;

drop policy if exists "anon select houses" on public.houses;
create policy "anon select houses"
  on public.houses for select to anon using (true);

drop policy if exists "anon insert houses" on public.houses;
create policy "anon insert houses"
  on public.houses for insert to anon with check (true);

drop policy if exists "anon update houses" on public.houses;
create policy "anon update houses"
  on public.houses for update to anon using (true) with check (true);

-- Example query: listings in a price range:
--   select listing_id, url, price, images
--   from houses
--   where price between 10000000 and 50000000
--   order by price;
