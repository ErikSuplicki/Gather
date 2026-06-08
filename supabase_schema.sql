-- ============================================================
-- GATHER APP – Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Profiles table
create table public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  username      text unique,
  avatar_url    text,
  city          text,
  region        text,
  latitude      double precision,
  longitude     double precision,
  onboarding_complete boolean default false,
  created_at    timestamp with time zone default timezone('utc', now())
);

-- 2. TCGs per user (skill levels)
create table public.user_tcgs (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles on delete cascade not null,
  tcg         text not null check (tcg in ('mtg','pokemon','yugioh','starwars','lorcana')),
  skill_level integer not null check (skill_level between 1 and 10),
  created_at  timestamp with time zone default timezone('utc', now()),
  unique(user_id, tcg)
);

-- 3. TCG-specific profile details (flexible JSONB)
create table public.user_tcg_details (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles on delete cascade not null,
  tcg         text not null check (tcg in ('mtg','pokemon','yugioh','starwars','lorcana')),
  details     jsonb default '{}'::jsonb,
  created_at  timestamp with time zone default timezone('utc', now()),
  unique(user_id, tcg)
);

-- 4. Imported decks (paste-decklist import; many per user+tcg)
create table public.user_decks (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles on delete cascade not null,
  tcg         text not null check (tcg in ('mtg','pokemon','yugioh','starwars','lorcana')),
  name        text not null,
  format      text,
  cards       jsonb not null default '[]'::jsonb,
  card_count  integer not null default 0,
  created_at  timestamp with time zone default timezone('utc', now())
);

-- ── Row Level Security ──────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.user_tcgs       enable row level security;
alter table public.user_tcg_details enable row level security;
alter table public.user_decks      enable row level security;

-- Profiles: public read, own write
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- user_tcgs: public read, own write
create policy "TCGs are publicly readable"
  on public.user_tcgs for select using (true);
create policy "Users manage their own TCGs"
  on public.user_tcgs for all using (auth.uid() = user_id);

-- user_tcg_details: public read, own write
create policy "TCG details are publicly readable"
  on public.user_tcg_details for select using (true);
create policy "Users manage their own TCG details"
  on public.user_tcg_details for all using (auth.uid() = user_id);

-- user_decks: public read, own write
create policy "Decks are publicly readable"
  on public.user_decks for select using (true);
create policy "Users manage their own decks"
  on public.user_decks for all using (auth.uid() = user_id);

-- ── Auto-create profile on signup ──────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Storage bucket for avatars ──────────────────────────────
-- Run these separately in the SQL Editor after the tables above:

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
