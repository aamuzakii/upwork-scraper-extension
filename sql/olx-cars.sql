-- Car listings schema (Supabase / Postgres)
--
-- Goal: quick look at what price a specific car model usually goes for.
-- One row per listing; upserted on listing_id. No timeline, no status.
-- Sourced from multiple marketplaces, hence the generic name.
--
-- Run this in the Supabase SQL editor once.

create table if not exists public.cars (
  id             bigint generated always as identity primary key,
  source         text   not null,                 -- "olx" | "facebook" | ...
  listing_id     text   not null,                 -- marketplace item id, e.g. "947429554"
  url            text   not null,                 -- full listing url
  title          text,                            -- card title, e.g. "Mazda Biante"
  full_title     text,                            -- e.g. "Dijual MAZDA Biante Skyactiv 2014"
  brand          text,                            -- normalized lowercase, e.g. "mazda"
  model          text,                            -- e.g. "biante"
  variant        text,                            -- e.g. "skyactiv"
  year           integer,                         -- e.g. 2014
  mileage_min_km integer,                         -- e.g. 125000
  mileage_max_km integer,                         -- e.g. 130000
  price          bigint,                          -- normalized IDR number, e.g. 100000000
  currency       text   not null default 'IDR',
  location       text,                            -- e.g. "Pamulang"
  posted_date    date,                            -- best-effort parse of "12 Agu"
  description    text,                            -- seller description (detail pages)
  locked         boolean not null default false,   -- set true to stop the scraper from overwriting
  unique (source, listing_id)
);

create index if not exists cars_brand_model_year_idx
  on public.cars (brand, model, variant, year);

-- Allow the browser extension (anon / publishable key) to write and read.
alter table public.cars enable row level security;

drop policy if exists "anon select cars" on public.cars;
create policy "anon select cars"
  on public.cars for select to anon using (true);

drop policy if exists "anon insert cars" on public.cars;
create policy "anon insert cars"
  on public.cars for insert to anon with check (true);

drop policy if exists "anon update cars" on public.cars;
create policy "anon update cars"
  on public.cars for update to anon using (true) with check (true);

-- Example query: typical price for a car model + year:
--   select model, year, count(*) as listings,
--          min(price) as min_price,
--          avg(price) as avg_price,
--          max(price) as max_price
--   from cars
--   where model = 'biante' and year = 2014
--   group by model, year;