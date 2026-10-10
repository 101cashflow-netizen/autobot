-- Migração: Biblioteca de Vídeos e Reels via Google Drive
-- Execute este script no SQL Editor do seu projeto Supabase:
-- Dashboard > SQL Editor > New query > Cole e execute (RUN).

-- 1. Criação da tabela da biblioteca de vídeos
create table if not exists video_library (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique not null,
  title text not null,
  raw_filename text not null,
  video_url text not null,
  file_size bigint,
  status text not null default 'pending', -- 'pending' | 'scheduled' | 'published' | 'failed'
  scheduled_at timestamptz,
  published_at timestamptz,
  facebook_post_id text,
  error_message text,
  created_at timestamptz not null default now()
);

-- Índices para performance de busca e autopilot
create index if not exists video_library_status_idx on video_library (status);
create index if not exists video_library_created_idx on video_library (created_at desc);

-- 2. Adição dos campos de configuração do Google Drive e Autopilot de Reels
alter table app_settings add column if not exists google_drive_folder_id text;
alter table app_settings add column if not exists google_drive_api_key text;
alter table app_settings add column if not exists google_apps_script_url text;
alter table app_settings add column if not exists reels_auto_post_enabled boolean not null default false;
alter table app_settings add column if not exists reels_posts_per_day smallint not null default 1;
alter table app_settings add column if not exists reels_posting_hours int[] not null default '{11,17}';
alter table app_settings add column if not exists last_reels_auto_post_at timestamptz;
