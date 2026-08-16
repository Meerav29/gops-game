create table if not exists rooms (
  code text primary key,
  state jsonb not null,
  player_ids jsonb not null default '{"p1": null, "p2": null}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table rooms enable row level security;

create policy "public read" on rooms
  for select using (true);

create policy "public insert" on rooms
  for insert with check (true);

create policy "public update" on rooms
  for update using (true);

alter publication supabase_realtime add table rooms;
