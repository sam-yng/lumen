<!-- GENERATED from supabase/migrations/ by scripts/gen-db-schema.ts — do not edit. -->
<!-- Regenerate with `bun run docs:db-schema`. -->

# Database schema

## Tables

### profiles

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key references auth.users (id) on delete cascade |
| `display_name` | text |
| `created_at` | timestamptz not null default now() |
| `updated_at` | timestamptz not null default now() |

Policies: `profiles_select_own`, `profiles_insert_own`, `profiles_update_own`

