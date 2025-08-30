create table if not exists users (
  id uuid primary key,
  email text unique,
  created_at timestamptz default now()
);

create table if not exists images (
  id uuid primary key,
  user_id uuid references users(id),
  gcs_uri text not null,
  thumb_gcs_uri text,
  status text not null check (status in ('PENDING','READY','FAILED')),
  content_type text,
  size_bytes bigint,
  created_at timestamptz default now(),
  ready_at timestamptz
);

create index if not exists idx_images_user_created on images(user_id, created_at desc);
