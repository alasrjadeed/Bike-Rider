-- ============================================================================
-- BIKE RIDER — global leaderboard (Supabase)
-- ============================================================================
-- The game itself stays offline-first: it boots, plays and saves with no network
-- at all. This table is the ONE thing that talks to Supabase, and only when a
-- rider explicitly opts in. If the API is unreachable, the game simply doesn't
-- show a board — nothing else changes.
--
-- Threat model: every caller here is the anonymous publishable key, so the
-- client is untrusted by definition. Therefore:
--   * anon gets SELECT only — no INSERT/UPDATE/DELETE policies exist;
--   * scores are written exclusively through submit_score(), a SECURITY DEFINER
--     function that clamps every value server-side;
--   * the service_role key is never shipped, so a player cannot become admin.
-- A determined attacker can still post a fake score. That is true of every
-- client-authored leaderboard; the caps below keep it from being trivial or
-- from being used as an unbounded write pump.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
create table if not exists public.leaderboard (
  id          uuid primary key default gen_random_uuid(),
  -- A stable per-install id. NOT a user account and NOT a device fingerprint we
  -- derive: the client generates it once and reuses it, so it only lets a player
  -- replace their own row rather than flood the board.
  device_id   uuid not null,
  rider_name  text not null,
  score       bigint not null check (score between 0 and 100000000),
  earnings    bigint not null default 0 check (earnings between 0 and 100000000),
  distance_m  bigint not null default 0 check (distance_m between 0 and 1000000000),
  jobs        integer not null default 0 check (jobs between 0 and 100000),
  rating      numeric(2,1) not null default 4.5 check (rating between 0 and 5),
  country     text not null default 'bh' check (country in ('bh','sa','ae')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per device: re-submitting replaces your entry instead of stacking up.
create unique index if not exists leaderboard_device_idx on public.leaderboard (device_id);
-- The board is read far more than it is written, always top-first.
create index if not exists leaderboard_score_idx on public.leaderboard (score desc, updated_at asc);

comment on table public.leaderboard is
  'Global best-shift board. Opt-in; written only via submit_score().';

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.leaderboard enable row level security;

-- Anyone with the publishable key may READ the board. That is the whole point.
drop policy if exists "leaderboard is public" on public.leaderboard;
create policy "leaderboard is public"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

-- NOTE: deliberately no insert/update/delete policy for anon. Direct writes are
-- refused by RLS, so the only way onto the board is submit_score() below.

-- ----------------------------------------------------------------------------
-- submit_score() — the single, clamped write path
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it can bypass RLS for the write while still validating
-- everything the client sends. Returns the rider's rank so the UI can say where
-- they landed without a second round trip.
create or replace function public.submit_score(
  p_device_id   uuid,
  p_rider_name  text,
  p_score       bigint,
  p_earnings    bigint default 0,
  p_distance_m  bigint default 0,
  p_jobs        integer default 0,
  p_rating      numeric default 4.5,
  p_country     text default 'bh'
) returns table (rank bigint, score bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank bigint;
begin
  -- validate: the client is untrusted, so everything is clamped, never assumed
  if p_device_id is null then
    raise exception 'device_id is required';
  end if;

  insert into public.leaderboard
    (device_id, rider_name, score, earnings, distance_m, jobs, rating, country, updated_at)
  values (
    p_device_id,
    -- trim + hard length cap; names are rendered as text, never as HTML
    left(trim(coalesce(p_rider_name, 'RIDER')), 24),
    least(greatest(coalesce(p_score, 0), 0), 100000000),
    least(greatest(coalesce(p_earnings, 0), 0), 100000000),
    least(greatest(coalesce(p_distance_m, 0), 0), 1000000000),
    least(greatest(coalesce(p_jobs, 0), 0), 100000),
    least(greatest(coalesce(p_rating, 4.5), 0), 5),
    case when p_country in ('bh','sa','ae') then p_country else 'bh' end,
    now()
  )
  on conflict (device_id) do update set
    -- never let a re-submit lower a stored best
    rider_name = excluded.rider_name,
    score      = greatest(public.leaderboard.score, excluded.score),
    earnings   = greatest(public.leaderboard.earnings, excluded.earnings),
    distance_m = greatest(public.leaderboard.distance_m, excluded.distance_m),
    jobs       = greatest(public.leaderboard.jobs, excluded.jobs),
    rating     = excluded.rating,
    country    = excluded.country,
    updated_at = now();

  select count(*) into v_rank
  from public.leaderboard
  where score > (select score from public.leaderboard where device_id = p_device_id);

  return query select v_rank + 1 as rank,
                      (select score from public.leaderboard where device_id = p_device_id) as score;
end;
$$;

-- The publishable key may execute this and nothing else sensitive.
revoke all on function public.submit_score(uuid, text, bigint, bigint, bigint, integer, numeric, text) from public;
grant execute on function public.submit_score(uuid, text, bigint, bigint, bigint, integer, numeric, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- top_board() — one round trip for the board, already trimmed
-- ----------------------------------------------------------------------------
create or replace function public.top_board(p_limit integer default 20)
returns table (
  rank bigint, rider_name text, score bigint, earnings bigint,
  distance_m bigint, jobs integer, rating numeric, country text
)
language sql
stable
security definer
set search_path = public
as $$
  select row_number() over (order by l.score desc, l.updated_at asc) as rank,
         l.rider_name, l.score, l.earnings, l.distance_m, l.jobs, l.rating, l.country
  from public.leaderboard l
  order by l.score desc, l.updated_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.top_board(integer) from public;
grant execute on function public.top_board(integer) to anon, authenticated;

-- Make sure anon can actually reach both endpoints.
grant usage on schema public to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
