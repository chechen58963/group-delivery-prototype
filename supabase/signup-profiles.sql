-- 회원가입 시 프로필 생성, 이메일 인증 시 자동 활성화. 기존 수동 계정은 유지합니다.
begin;
alter table public.gd_testers add column if not exists joined_at timestamptz not null default now();
alter table public.gd_testers add column if not exists registration_source text not null default 'manual';
alter table public.gd_testers add column if not exists email_activation_done boolean not null default false;

create or replace function public.gd_handle_signup_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_nickname text;
begin
  v_nickname:=btrim(coalesce(new.raw_user_meta_data->>'nickname',''));
  if char_length(v_nickname)<2 or char_length(v_nickname)>20 then
    v_nickname:='배프'||left(replace(new.id::text,'-',''),6);
  end if;
  -- active/admin 등 사용자 메타데이터는 권한 결정에 사용하지 않습니다.
  insert into public.gd_testers(user_id,nickname,active,registration_source,email_activation_done)
    values(new.id,v_nickname,new.email_confirmed_at is not null,'signup',new.email_confirmed_at is not null)
    on conflict(user_id) do nothing;
  if tg_op='UPDATE' and new.email_confirmed_at is not null then
    update public.gd_testers set active=true,email_activation_done=true
      where user_id=new.id and registration_source='signup' and not email_activation_done;
  end if;
  return new;
end;
$$;
drop trigger if exists gd_create_signup_profile on auth.users;
create trigger gd_create_signup_profile after insert on auth.users
for each row execute function public.gd_handle_signup_profile();
drop trigger if exists gd_activate_confirmed_signup on auth.users;
create trigger gd_activate_confirmed_signup after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.gd_handle_signup_profile();
revoke all on function public.gd_handle_signup_profile() from public,anon,authenticated;
commit;

-- 새 가입자는 Authentication > Users와 Table Editor > gd_testers에서 확인할 수 있습니다.
-- 이메일 인증 후 active가 자동으로 true가 됩니다. 운영자 승인 절차는 없습니다.
-- 기존 setup.sql의 SELECT 전용 RLS가 유지되며, 가입자가 스스로 active를 변경할 수 없습니다.
