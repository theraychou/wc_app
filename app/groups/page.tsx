import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/data/groups";
import { InviteButton } from "@/components/invite-button";
import {
  JoinAnotherGroup,
  LeaveGroupButton,
  RemoveMemberButton,
} from "./group-controls";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const groups = await getMyGroups(supabase, user.id);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your groups</h1>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Dashboard
        </a>
      </header>

      <p className="mt-3 text-sm text-neutral-400">
        You compete separately in each group, using the same predictions. Join
        as many as you like.
      </p>

      <ul className="mt-5 space-y-2">
        {groups.map((g) => (
          <li
            key={g.id}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-neutral-50">
                  {g.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {g.member_count} member{g.member_count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <InviteButton code={g.join_code} groupName={g.name} />
              </div>
            </div>
            <ul className="mt-3 space-y-1 border-t border-neutral-800 pt-3">
              {g.members.map((m) => {
                const isYou = m.id === user.id;
                const isOwner = m.id === g.owner_id;
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-neutral-200">
                      {m.display_name}
                      {isYou && (
                        <span className="ml-1 text-xs text-emerald-400">you</span>
                      )}
                      {isOwner && (
                        <span className="ml-1 rounded-sm bg-neutral-800 px-1 text-[10px] text-neutral-400">
                          owner
                        </span>
                      )}
                    </span>
                    {g.is_owner && !isYou && (
                      <RemoveMemberButton
                        groupId={g.id}
                        memberId={m.id}
                        memberName={m.display_name}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between">
              <a
                href={`/leaderboard?group=${g.id}`}
                className="text-sm font-medium text-emerald-400"
              >
                View leaderboard →
              </a>
              <LeaveGroupButton groupId={g.id} groupName={g.name} />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-100">
          Join another group
        </h2>
        <JoinAnotherGroup />
      </section>
    </main>
  );
}
