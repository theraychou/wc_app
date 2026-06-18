-- ============================================================================
-- Milestone 2 (Auth): track first-login onboarding.
--
-- New auth users get a profile row automatically (handle_new_user in 0001) with
-- display_name defaulted to their email local-part. `onboarded` lets the app
-- send a user through the display-name capture step exactly once, with no
-- reliance on guessing whether the default name was customized.
--
-- Run this in the Supabase SQL Editor AFTER 0001_init.sql.
-- ============================================================================

alter table profiles
  add column if not exists onboarded boolean not null default false;
