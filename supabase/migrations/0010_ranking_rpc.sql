-- RPC для рейтинга участника (тай-брейк: раньше достиг суммы — выше)
create or replace function get_user_rank(p_user_id bigint)
returns table(rank bigint, total_points integer)
language sql
stable
as $$
  with ranked as (
    select
      id,
      users.total_points,
      row_number() over (
        order by users.total_points desc, users.last_points_at asc nulls last
      ) as rank
    from users
  )
  select ranked.rank, ranked.total_points
  from ranked
  where id = p_user_id;
$$;
