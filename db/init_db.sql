create table if not exists surveys (
  id uuid not null default gen_random_uuid() primary key,
  question text not null,
  created_at timestamp with time zone not null default now(),
  active boolean not null default true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

create table if not exists votes (
  id uuid not null default gen_random_uuid() primary key,
  survey_id uuid not null references surveys (id) on delete cascade,
  wallet_address text not null,
  vote_option text check (vote_option in ('yes','no')) not null,
  created_at timestamp with time zone not null default now()
);
