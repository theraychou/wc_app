-- ============================================================================
-- Milestone 14: group owner can remove members.
--
-- The group OWNER is its creator (groups.created_by). This adds an owner-only
-- function to remove another member. Joining stays self-service via code;
-- members can still leave themselves via leave_group.
--
-- Run in the Supabase SQL Editor AFTER 0001-0004.
-- ============================================================================

create or replace function remove_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- only the group's creator (owner) may remove others
  if not exists (
    select 1 from groups where id = p_group_id and created_by = auth.uid()
  ) then
    raise exception 'Only the group owner can remove members';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Use Leave to remove yourself';
  end if;

  delete from group_members
  where group_id = p_group_id and user_id = p_user_id;

  -- repoint the removed member's primary group if it was this one
  update profiles set group_id = (
    select group_id from group_members where user_id = p_user_id
    order by joined_at limit 1
  ) where id = p_user_id and group_id = p_group_id;
end;
$$;

grant execute on function remove_member(uuid, uuid) to authenticated;
