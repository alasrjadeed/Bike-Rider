-- ============================================================================
-- Fix: submit_score() ambiguous column (42702)
-- ============================================================================
-- The function's RETURNS TABLE declares output params named `rank` and `score`.
-- Inside PL/pgSQL those names are in scope as variables, so the two unqualified
-- `select score from public.leaderboard ...` subqueries became ambiguous with the
-- table's own `score` column and Postgres refused the whole function.
--
-- Fix: fully qualify every column reference. The output column names still come
-- from the RETURNS TABLE signature, so the REST payload shape is unchanged.
-- ============================================================================

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
  v_best bigint;
begin
  -- validate: the client is untrusted, so everything is clamped, never assumed
  if p_device_id is null then
    raise exception 'device_id is required';
  end if;

  insert into public.leaderboard as l
    (device_id, rider_name, score, earnings, distance_m, jobs, rating, country, updated_at)
  values (
    p_device_id,
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
    score      = greatest(l.score, excluded.score),
    earnings   = greatest(l.earnings, excluded.earnings),
    distance_m = greatest(l.distance_m, excluded.distance_m),
    jobs       = greatest(l.jobs, excluded.jobs),
    rating     = excluded.rating,
    country    = excluded.country,
    updated_at = now();

  select l.score into v_best from public.leaderboard l where l.device_id = p_device_id;

  select count(*) into v_rank
  from public.leaderboard l
  where l.score > v_best;

  -- no `as` aliases here: `rank`/`score` are already the declared output params
  return query select v_rank + 1, v_best;
end;
$$;

revoke all on function public.submit_score(uuid, text, bigint, bigint, bigint, integer, numeric, text) from public;
grant execute on function public.submit_score(uuid, text, bigint, bigint, bigint, integer, numeric, text) to anon, authenticated;
