-- Local dev seed. Runs on `bunx supabase db reset`. NEVER runs in production.
--
-- Demo login: demo@lumen.test / demo12345
-- Idempotent: fixed UUIDs + `on conflict do nothing`.

-- Demo auth user (email confirmed). The M0 handle_new_user trigger auto-creates
-- the matching public.profiles row.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  -- GoTrue scans these into non-nullable strings; NULL causes a 500 at login.
  confirmation_token, recovery_token, email_change, email_change_token_current,
  email_change_token_new, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000d1',
  'authenticated', 'authenticated', 'demo@lumen.test',
  crypt('demo12345', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
)
on conflict do nothing;

-- Identity row (required for email/password sign-in).
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000d1',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","email":"demo@lumen.test"}'::jsonb,
  'email', now(), now(), now()
)
on conflict do nothing;

-- Sample library for the demo user (library_nodes tree).
-- Workspace node owns the tree (workspace_id = id, parent_id = null).
insert into public.library_nodes (id, user_id, workspace_id, parent_id, kind, title, slug) values
  (
    '00000000-0000-4000-8000-0000000000f1',
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-4000-8000-0000000000f1',
    null,
    'workspace',
    'Course notes',
    'course-notes-000000f1'
  )
on conflict do nothing;

-- A page node nested under the workspace.
insert into public.library_nodes (id, user_id, workspace_id, parent_id, kind, title, slug, content_text) values
  (
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-4000-8000-0000000000f1',
    '00000000-0000-4000-8000-0000000000f1',
    'page',
    'Welcome to Lumen',
    'welcome-to-lumen-000000a1',
    'A seeded note about photosynthesis, mitochondria, and cellular respiration.'
  )
on conflict do nothing;

insert into public.tags (id, user_id, name, color) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'biology', '#22c55e')
on conflict do nothing;

insert into public.tag_links (id, tag_id, node_id) values
  (
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000c1',
    '00000000-0000-4000-8000-0000000000a1'
  )
on conflict do nothing;
