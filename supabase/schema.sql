-- ============================================================
-- 가치 경매 — Supabase 스키마
-- Supabase SQL Editor에 전체를 붙여넣고 실행하세요.
-- 기존 프로젝트 공유를 위해 모든 객체에 auction_ 접두사 사용.
-- ============================================================

-- gen_random_bytes() (교사 키 발급용) 사용을 위해 필요
create extension if not exists pgcrypto;

-- ---------- 테이블 ----------

create table if not exists auction_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  initial_budget int not null default 1000,
  max_wins int not null default 3,
  twist_enabled boolean not null default true,
  reflect_q1 text not null default '이번 경매에서 내가 가장 많은 돈을 쓴 가치는 무엇이고, 그 이유는 무엇인가요?',
  reflect_q2 text not null default '예산이 부족해 포기했던 가치 중 가장 아쉬운 것은 무엇인가요? 그것이 없어도 나는 괜찮을까요?',
  reflect_q3 text not null default '오늘 등장한 가치들 중, 사실은 돈이 없어도 얻을 수 있는 것이 있었다면 무엇인가요?',
  happiness_prompt text not null default '내가 생각하는 진정한 행복이란',
  status text not null default 'setup'
    check (status in ('setup','propose','auction','twist','reflect','done')),
  created_at timestamptz not null default now()
);

-- 이미 예전 스키마로 생성된 DB에 대한 idempotent 마이그레이션 (재실행 안전)
alter table auction_classes drop column if exists school_badge_enabled;
alter table auction_items drop column if exists school;
alter table auction_classes add column if not exists reflect_q1 text not null default '이번 경매에서 내가 가장 많은 돈을 쓴 가치는 무엇이고, 그 이유는 무엇인가요?';
alter table auction_classes add column if not exists reflect_q2 text not null default '예산이 부족해 포기했던 가치 중 가장 아쉬운 것은 무엇인가요? 그것이 없어도 나는 괜찮을까요?';
alter table auction_classes add column if not exists reflect_q3 text not null default '오늘 등장한 가치들 중, 사실은 돈이 없어도 얻을 수 있는 것이 있었다면 무엇인가요?';
alter table auction_classes add column if not exists happiness_prompt text not null default '내가 생각하는 진정한 행복이란';

-- 교사 키는 별도 테이블: RLS로 읽기 차단 + Realtime 미발행 → 학생에게 노출되지 않음
create table if not exists auction_class_keys (
  class_id uuid primary key references auction_classes(id) on delete cascade,
  teacher_key text not null
);

create table if not exists auction_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references auction_classes(id) on delete cascade,
  name text not null,
  balance int not null,
  win_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists auction_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references auction_classes(id) on delete cascade,
  name text not null,
  source text not null default 'seed' check (source in ('seed','student')),
  proposed_by uuid references auction_students(id) on delete set null,
  approved boolean not null default false,
  tag text not null default 'in' check (tag in ('ex','in')),
  status text not null default 'waiting'
    check (status in ('waiting','active','sold','passed','rejected')),
  winner_id uuid references auction_students(id) on delete set null,
  final_price int,
  order_no int,
  countdown_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auction_bids (
  id bigint generated always as identity primary key,
  item_id uuid not null references auction_items(id) on delete cascade,
  class_id uuid not null references auction_classes(id) on delete cascade,
  student_id uuid not null references auction_students(id) on delete cascade,
  student_name text not null,
  amount int not null,
  created_at timestamptz not null default now()
);

create table if not exists auction_reflections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references auction_classes(id) on delete cascade,
  student_id uuid not null references auction_students(id) on delete cascade,
  q1 text not null default '',
  q2 text not null default '',
  q3 text not null default '',
  happiness text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id)
);

create index if not exists auction_bids_item_idx on auction_bids (item_id, amount desc, created_at);
create index if not exists auction_items_class_idx on auction_items (class_id);
create index if not exists auction_students_class_idx on auction_students (class_id);

-- ---------- RLS: 읽기는 공개(anon), 쓰기는 RPC(security definer)로만 ----------

alter table auction_classes enable row level security;
alter table auction_class_keys enable row level security; -- 정책 없음 → 읽기/쓰기 모두 차단
alter table auction_students enable row level security;
alter table auction_items enable row level security;
alter table auction_bids enable row level security;
alter table auction_reflections enable row level security;

drop policy if exists auction_classes_read on auction_classes;
create policy auction_classes_read on auction_classes for select using (true);
drop policy if exists auction_students_read on auction_students;
create policy auction_students_read on auction_students for select using (true);
drop policy if exists auction_items_read on auction_items;
create policy auction_items_read on auction_items for select using (true);
drop policy if exists auction_bids_read on auction_bids;
create policy auction_bids_read on auction_bids for select using (true);
drop policy if exists auction_reflections_read on auction_reflections;
create policy auction_reflections_read on auction_reflections for select using (true);
-- insert/update/delete 정책 없음 → 직접 쓰기 차단 (RPC로만 가능)

-- ---------- Realtime 발행 ----------

do $$
begin
  begin
    alter publication supabase_realtime add table auction_classes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table auction_students;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table auction_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table auction_bids;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------- 헬퍼 ----------

create or replace function auction_now()
returns timestamptz language sql stable as $$ select now() $$;

create or replace function auction__auth_teacher(p_class_id uuid, p_key text)
returns void language plpgsql as $$
begin
  if not exists (
    select 1 from auction_class_keys where class_id = p_class_id and teacher_key = p_key
  ) then
    raise exception '교사 키가 올바르지 않습니다';
  end if;
end $$;

-- ---------- 반 생성 (+ 기본 가치 35개 시드) ----------

-- 예전 버전이 남아있다면 제거 (파라미터 목록이 달라 create or replace로 덮어써지지 않음)
drop function if exists auction_create_class(int, int, boolean);
drop function if exists auction_create_class(int, int, boolean, boolean, text, text, text, text);

create or replace function auction_create_class(
  p_budget int default 1000,
  p_max_wins int default 3,
  p_twist boolean default true,
  p_q1 text default null,
  p_q2 text default null,
  p_q3 text default null,
  p_happiness_prompt text default null
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  v_key text;
  v_id uuid;
  v_seed record;
begin
  if p_budget < 100 or p_budget > 100000 then
    raise exception '초기 예산은 100~100000 사이여야 합니다';
  end if;
  if p_max_wins < 1 or p_max_wins > 9 then
    raise exception '1인 최대 낙찰 수는 1~9 사이여야 합니다';
  end if;

  loop
    -- 헷갈리는 문자(0,O,1,I,L) 제외한 6자리 코드
    select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (random()*30)::int + 1, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from auction_classes where code = v_code);
  end loop;

  v_key := encode(gen_random_bytes(16), 'hex');

  insert into auction_classes (
    code, initial_budget, max_wins, twist_enabled,
    reflect_q1, reflect_q2, reflect_q3, happiness_prompt
  )
  values (
    v_code, p_budget, p_max_wins, p_twist,
    coalesce(nullif(trim(p_q1), ''), '이번 경매에서 내가 가장 많은 돈을 쓴 가치는 무엇이고, 그 이유는 무엇인가요?'),
    coalesce(nullif(trim(p_q2), ''), '예산이 부족해 포기했던 가치 중 가장 아쉬운 것은 무엇인가요? 그것이 없어도 나는 괜찮을까요?'),
    coalesce(nullif(trim(p_q3), ''), '오늘 등장한 가치들 중, 사실은 돈이 없어도 얻을 수 있는 것이 있었다면 무엇인가요?'),
    coalesce(nullif(trim(p_happiness_prompt), ''), '내가 생각하는 진정한 행복이란')
  )
  returning id into v_id;

  insert into auction_class_keys (class_id, teacher_key) values (v_id, v_key);

  -- 기본 가치 세트 35개 (외재적/내재적 골고루)
  insert into auction_items (class_id, name, source, approved, tag)
  select v_id, s.name, 'seed', true, s.tag from (values
    ('평생 건강',              'in'),
    ('진실한 우정',            'in'),
    ('마음의 평온',            'in'),
    ('지혜',                   'in'),
    ('자아실현',               'in'),
    ('소박한 식사',            'in'),
    ('운명을 받아들이는 힘',   'in'),
    ('가족의 화목',            'in'),
    ('배움의 즐거움',          'in'),
    ('자연 속의 여유',         'in'),
    ('절제하는 힘',            'in'),
    ('감사하는 마음',          'in'),
    ('어떤 상황에도 꺾이지 않는 용기', 'in'),
    ('정직함',                 'in'),
    ('몰입의 즐거움',          'in'),
    ('깊고 편안한 잠',         'in'),
    ('흔들리지 않는 신념',     'in'),
    ('유머 감각',              'in'),
    ('봉사의 보람',            'in'),
    ('사랑하고 사랑받는 것',   'in'),
    ('100억 원의 자산',        'ex'),
    ('사회적 명예',            'ex'),
    ('감각적 즐거움',          'ex'),
    ('최신형 스포츠카',        'ex'),
    ('세계 여행 자유이용권',   'ex'),
    ('명문대 합격증',          'ex'),
    ('한강이 보이는 펜트하우스', 'ex'),
    ('유명인의 인기',          'ex'),
    ('구독자 100만 채널',      'ex'),
    ('최고급 미식 여행',       'ex'),
    ('높은 지위와 권력',       'ex'),
    ('명품으로 가득한 옷장',   'ex'),
    ('평생 걱정 없는 노후 자금', 'ex'),
    ('최신 스마트폰과 게임기', 'ex'),
    ('전국 대회 우승 트로피',  'ex')
  ) as s(name, tag);

  return json_build_object('class_id', v_id, 'code', v_code, 'teacher_key', v_key);
end $$;

-- ---------- 학생 입장 (반 코드 + 이름, 재입장 지원) ----------

create or replace function auction_join_class(p_code text, p_name text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_class auction_classes%rowtype;
  v_student auction_students%rowtype;
  v_name text := trim(p_name);
begin
  select * into v_class from auction_classes where code = upper(trim(p_code));
  if not found then
    raise exception '반 코드를 찾을 수 없습니다';
  end if;
  if v_class.status = 'done' then
    raise exception '이미 종료된 반입니다';
  end if;
  if length(v_name) < 1 or length(v_name) > 20 then
    raise exception '이름은 1~20자여야 합니다';
  end if;

  select * into v_student from auction_students
   where class_id = v_class.id and name = v_name;

  if not found then
    if (select count(*) from auction_students where class_id = v_class.id) >= 40 then
      raise exception '정원이 가득 찼습니다';
    end if;
    insert into auction_students (class_id, name, balance)
    values (v_class.id, v_name, v_class.initial_budget)
    returning * into v_student;
  end if;

  return json_build_object(
    'class_id', v_class.id, 'code', v_class.code,
    'student_id', v_student.id, 'name', v_student.name
  );
end $$;

-- ---------- 학생 가치 제안 (1인 1개) ----------

create or replace function auction_propose_item(
  p_student_id uuid, p_name text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_student auction_students%rowtype;
  v_class auction_classes%rowtype;
  v_name text := trim(p_name);
  v_id uuid;
begin
  select * into v_student from auction_students where id = p_student_id;
  if not found then raise exception '학생 정보를 찾을 수 없습니다'; end if;
  select * into v_class from auction_classes where id = v_student.class_id;
  if v_class.status not in ('setup','propose') then
    raise exception '지금은 가치를 제안할 수 없습니다';
  end if;
  if length(v_name) < 1 or length(v_name) > 30 then
    raise exception '가치 이름은 1~30자여야 합니다';
  end if;
  if exists (
    select 1 from auction_items
     where proposed_by = p_student_id and status <> 'rejected'
  ) then
    raise exception '이미 가치를 제안했습니다';
  end if;

  insert into auction_items (class_id, name, source, proposed_by, approved, tag)
  values (v_student.class_id, v_name, 'student', p_student_id, false, 'in')
  returning id into v_id;

  return json_build_object('item_id', v_id);
end $$;

-- ---------- 교사: 제안 승인/거절/수정/태그 지정 ----------

drop function if exists auction_update_item(uuid, text, uuid, text, text, text, text);

create or replace function auction_update_item(
  p_class_id uuid, p_key text, p_item_id uuid,
  p_action text,               -- 'approve' | 'reject' | 'edit' | 'delete'
  p_name text default null,
  p_tag text default null      -- 'ex' | 'in'
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform auction__auth_teacher(p_class_id, p_key);

  if p_action = 'approve' then
    update auction_items set approved = true, status = 'waiting',
      name = coalesce(nullif(trim(p_name), ''), name),
      tag = coalesce(p_tag, tag)
    where id = p_item_id and class_id = p_class_id;
  elsif p_action = 'reject' then
    update auction_items set approved = false, status = 'rejected'
    where id = p_item_id and class_id = p_class_id and source = 'student';
  elsif p_action = 'edit' then
    update auction_items set
      name = coalesce(nullif(trim(p_name), ''), name),
      tag = coalesce(p_tag, tag)
    where id = p_item_id and class_id = p_class_id
      and status in ('waiting','rejected');
  elsif p_action = 'delete' then
    delete from auction_items
    where id = p_item_id and class_id = p_class_id and status in ('waiting','rejected');
  else
    raise exception '알 수 없는 동작: %', p_action;
  end if;
end $$;

-- ---------- 교사: 반 상태 변경 ----------

create or replace function auction_set_status(
  p_class_id uuid, p_key text, p_status text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform auction__auth_teacher(p_class_id, p_key);
  if p_status not in ('setup','propose','auction','twist','reflect','done') then
    raise exception '잘못된 상태: %', p_status;
  end if;
  update auction_classes set status = p_status where id = p_class_id;
end $$;

-- ---------- 교사: 성찰 질문·행복 문장 수정 (언제든 가능) ----------

drop function if exists auction_update_settings(uuid, text, boolean, text, text, text, text);

create or replace function auction_update_settings(
  p_class_id uuid, p_key text,
  p_q1 text default null,
  p_q2 text default null,
  p_q3 text default null,
  p_happiness_prompt text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform auction__auth_teacher(p_class_id, p_key);
  update auction_classes set
    reflect_q1 = coalesce(nullif(trim(p_q1), ''), reflect_q1),
    reflect_q2 = coalesce(nullif(trim(p_q2), ''), reflect_q2),
    reflect_q3 = coalesce(nullif(trim(p_q3), ''), reflect_q3),
    happiness_prompt = coalesce(nullif(trim(p_happiness_prompt), ''), happiness_prompt)
  where id = p_class_id;
end $$;

-- ---------- 교사: 매물 올리기 ----------

create or replace function auction_start_item(
  p_class_id uuid, p_key text, p_item_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_next int;
begin
  perform auction__auth_teacher(p_class_id, p_key);

  if exists (
    select 1 from auction_items where class_id = p_class_id and status = 'active'
  ) then
    raise exception '이미 경매 중인 매물이 있습니다. 먼저 낙찰(또는 유찰)을 확정하세요';
  end if;

  select coalesce(max(order_no), 0) + 1 into v_next
    from auction_items where class_id = p_class_id;

  update auction_items
     set status = 'active', countdown_until = null, order_no = v_next
   where id = p_item_id and class_id = p_class_id
     and approved and status in ('waiting','passed');
  if not found then
    raise exception '경매에 올릴 수 없는 매물입니다';
  end if;

  update auction_classes set status = 'auction'
   where id = p_class_id and status <> 'auction';
end $$;

-- ---------- 학생: 입찰 (원자적 검증 — race condition 방지 핵심) ----------

create or replace function auction_place_bid(
  p_item_id uuid, p_student_id uuid, p_amount int
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_item auction_items%rowtype;
  v_class auction_classes%rowtype;
  v_student auction_students%rowtype;
  v_top int;
begin
  -- 매물 행 잠금: 같은 매물에 대한 입찰을 직렬화 (선착순 보장)
  select * into v_item from auction_items where id = p_item_id for update;
  if not found or v_item.status <> 'active' then
    raise exception '지금 경매 중인 매물이 아닙니다';
  end if;

  -- 낙찰 대기 만료 이후의 입찰은 거부 (서버 시간 기준)
  if v_item.countdown_until is not null and now() >= v_item.countdown_until then
    raise exception '낙찰 대기가 이미 끝났습니다';
  end if;

  select * into v_class from auction_classes where id = v_item.class_id;

  select * into v_student from auction_students where id = p_student_id for update;
  if not found or v_student.class_id <> v_item.class_id then
    raise exception '이 반의 학생이 아닙니다';
  end if;
  if v_student.win_count >= v_class.max_wins then
    raise exception '낙찰 한도(%개)에 도달해 더 이상 입찰할 수 없습니다', v_class.max_wins;
  end if;

  select coalesce(max(amount), 0) into v_top
    from auction_bids where item_id = p_item_id;

  if p_amount % 10 <> 0 then
    raise exception '입찰 금액은 10P 단위여야 합니다';
  end if;
  if p_amount < v_top + 10 then
    raise exception '현재 최고가(%P)보다 최소 10P 높게 입찰해야 합니다', v_top;
  end if;
  if p_amount > v_student.balance then
    raise exception '잔액(%P)을 초과할 수 없습니다', v_student.balance;
  end if;

  insert into auction_bids (item_id, class_id, student_id, student_name, amount)
  values (p_item_id, v_item.class_id, p_student_id, v_student.name, p_amount);

  -- 카운트다운 진행 중 새 유효 입찰 → 카운트다운 리셋
  if v_item.countdown_until is not null then
    update auction_items set countdown_until = null where id = p_item_id;
  end if;

  return json_build_object('top', p_amount, 'bidder', v_student.name);
end $$;

-- ---------- 교사: 낙찰 대기 시작/취소 ----------

create or replace function auction_start_countdown(
  p_class_id uuid, p_key text, p_item_id uuid
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_until timestamptz;
begin
  perform auction__auth_teacher(p_class_id, p_key);
  v_until := now() + interval '5 seconds';
  update auction_items set countdown_until = v_until
   where id = p_item_id and class_id = p_class_id and status = 'active';
  if not found then
    raise exception '경매 중인 매물이 아닙니다';
  end if;
  return json_build_object('countdown_until', v_until, 'server_now', now());
end $$;

create or replace function auction_cancel_countdown(
  p_class_id uuid, p_key text, p_item_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform auction__auth_teacher(p_class_id, p_key);
  update auction_items set countdown_until = null
   where id = p_item_id and class_id = p_class_id and status = 'active';
end $$;

-- ---------- 교사: 낙찰 확정 (잔액 차감 + 낙찰 수 + 상태 변경 = 한 트랜잭션) ----------

create or replace function auction_finalize_item(
  p_class_id uuid, p_key text, p_item_id uuid
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_item auction_items%rowtype;
  v_top auction_bids%rowtype;
  v_class auction_classes%rowtype;
begin
  perform auction__auth_teacher(p_class_id, p_key);

  select * into v_item from auction_items where id = p_item_id for update;
  if not found or v_item.status <> 'active' then
    raise exception '경매 중인 매물이 아닙니다';
  end if;
  if v_item.countdown_until is null then
    raise exception '낙찰 대기가 진행되지 않았습니다 (새 입찰로 리셋되었을 수 있습니다)';
  end if;
  if now() < v_item.countdown_until then
    raise exception '아직 낙찰 대기 시간이 끝나지 않았습니다';
  end if;

  select * into v_class from auction_classes where id = p_class_id;

  -- 최고가 + 동액이면 먼저 도달한 입찰(created_at, id) 우선
  select * into v_top from auction_bids
   where item_id = p_item_id
   order by amount desc, created_at asc, id asc
   limit 1;

  if not found then
    update auction_items
       set status = 'passed', countdown_until = null
     where id = p_item_id;
    return json_build_object('result', 'passed');
  end if;

  update auction_students
     set balance = balance - v_top.amount,
         win_count = win_count + 1
   where id = v_top.student_id
     and balance >= v_top.amount
     and win_count < v_class.max_wins;
  if not found then
    -- 방어: 이론상 도달 불가 (입찰 시점에 검증됨)
    update auction_items set status = 'passed', countdown_until = null
     where id = p_item_id;
    return json_build_object('result', 'passed');
  end if;

  update auction_items
     set status = 'sold', winner_id = v_top.student_id,
         final_price = v_top.amount, countdown_until = null
   where id = p_item_id;

  return json_build_object(
    'result', 'sold', 'winner', v_top.student_name, 'price', v_top.amount
  );
end $$;

-- ---------- 학생: 성찰 제출 ----------

create or replace function auction_submit_reflection(
  p_student_id uuid, p_q1 text, p_q2 text, p_q3 text, p_happiness text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_student auction_students%rowtype;
begin
  select * into v_student from auction_students where id = p_student_id;
  if not found then raise exception '학생 정보를 찾을 수 없습니다'; end if;

  insert into auction_reflections (class_id, student_id, q1, q2, q3, happiness)
  values (v_student.class_id, p_student_id,
          left(coalesce(p_q1,''), 1000), left(coalesce(p_q2,''), 1000),
          left(coalesce(p_q3,''), 1000), left(coalesce(p_happiness,''), 200))
  on conflict (student_id) do update
    set q1 = excluded.q1, q2 = excluded.q2, q3 = excluded.q3,
        happiness = excluded.happiness;
end $$;

-- ---------- 교사 재접속: 키로 반 찾기 ----------

create or replace function auction_get_class_by_key(p_code text, p_key text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_class auction_classes%rowtype;
begin
  select c.* into v_class
    from auction_classes c
    join auction_class_keys k on k.class_id = c.id
   where c.code = upper(trim(p_code)) and k.teacher_key = p_key;
  if not found then
    raise exception '반 코드 또는 교사 키가 올바르지 않습니다';
  end if;
  return json_build_object('class_id', v_class.id, 'code', v_class.code);
end $$;

-- ---------- 실행 권한 ----------

grant execute on function auction_now() to anon, authenticated;
grant execute on function auction_create_class(int, int, boolean, text, text, text, text) to anon, authenticated;
grant execute on function auction_update_settings(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function auction_join_class(text, text) to anon, authenticated;
grant execute on function auction_propose_item(uuid, text) to anon, authenticated;
grant execute on function auction_update_item(uuid, text, uuid, text, text, text) to anon, authenticated;
grant execute on function auction_set_status(uuid, text, text) to anon, authenticated;
grant execute on function auction_start_item(uuid, text, uuid) to anon, authenticated;
grant execute on function auction_place_bid(uuid, uuid, int) to anon, authenticated;
grant execute on function auction_start_countdown(uuid, text, uuid) to anon, authenticated;
grant execute on function auction_cancel_countdown(uuid, text, uuid) to anon, authenticated;
grant execute on function auction_finalize_item(uuid, text, uuid) to anon, authenticated;
grant execute on function auction_submit_reflection(uuid, text, text, text, text) to anon, authenticated;
grant execute on function auction_get_class_by_key(text, text) to anon, authenticated;
revoke execute on function auction__auth_teacher(uuid, text) from anon, authenticated;

-- ============================================================
-- 30일 지난 반 데이터 자동 삭제 (pg_cron)
-- auction_classes를 지우면 students/items/bids/reflections/class_keys는
-- 전부 on delete cascade로 함께 정리된다. 매일 새벽 4시(UTC) 실행.
-- ============================================================

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('auction-cleanup');
exception when others then null;
end $$;

select cron.schedule(
  'auction-cleanup',
  '0 4 * * *',
  $cron$ delete from auction_classes where created_at < now() - interval '30 days' $cron$
);
