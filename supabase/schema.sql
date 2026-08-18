create table if not exists app_metadata (
  key text primary key,
  data jsonb not null
);

create table if not exists layers (
  id integer primary key,
  data jsonb not null
);

create table if not exists components (
  id text primary key,
  layer_id integer not null references layers(id),
  name text not null,
  path text not null,
  data jsonb not null
);
create index if not exists components_layer_path_idx on components (layer_id, path);

create table if not exists flows (
  id text primary key,
  layer_id integer not null references layers(id),
  code text not null,
  component_path text,
  status text,
  data jsonb not null
);
create index if not exists flows_layer_code_idx on flows (layer_id, code);

create table if not exists symptoms (
  id text primary key,
  layer_id integer not null references layers(id),
  code text not null,
  component_path text,
  flow_id text references flows(id),
  data jsonb not null
);
create index if not exists symptoms_layer_code_idx on symptoms (layer_id, code);
create index if not exists symptoms_flow_id_idx on symptoms (flow_id);

create table if not exists repair_sessions (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  data jsonb not null
);

create table if not exists session_events (
  id text primary key,
  session_id text not null references repair_sessions(id) on delete cascade,
  created_at timestamptz not null,
  data jsonb not null
);
create index if not exists session_events_session_created_idx on session_events (session_id, created_at);
