create table public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  contact_label text not null default '비회원',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.support_inquiries(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index support_inquiries_status_updated_idx on public.support_inquiries (status, updated_at desc);
create index support_messages_inquiry_created_idx on public.support_messages (inquiry_id, created_at);

create trigger support_inquiries_set_updated_at before update on public.support_inquiries for each row execute procedure public.set_updated_at();

create or replace function public.touch_support_inquiry()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.support_inquiries set updated_at = now() where id = new.inquiry_id;
  return new;
end;
$$;

create trigger support_messages_touch_inquiry after insert on public.support_messages for each row execute procedure public.touch_support_inquiry();

alter table public.support_inquiries enable row level security;
alter table public.support_messages enable row level security;
