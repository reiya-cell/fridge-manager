create table if not exists public.fridge_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  custom_foods jsonb not null default '{}'::jsonb,
  barcode_cache jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fridge_user_data enable row level security;

drop policy if exists "users can read own fridge" on public.fridge_user_data;
create policy "users can read own fridge"
on public.fridge_user_data for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can insert own fridge" on public.fridge_user_data;
create policy "users can insert own fridge"
on public.fridge_user_data for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own fridge" on public.fridge_user_data;
create policy "users can update own fridge"
on public.fridge_user_data for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own fridge" on public.fridge_user_data;
create policy "users can delete own fridge"
on public.fridge_user_data for delete
to authenticated
using ((select auth.uid()) = user_id);
