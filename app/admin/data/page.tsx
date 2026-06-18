import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Table({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-neutral-500">No rows.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-neutral-900 text-neutral-400">
          <tr>
            {cols.map((c) => (
              <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td
                  key={c}
                  className="whitespace-nowrap px-2 py-1.5 text-neutral-300"
                >
                  {r[c] === null
                    ? "—"
                    : typeof r[c] === "boolean"
                      ? r[c]
                        ? "true"
                        : "false"
                      : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminDataPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/");

  const [{ data: profiles }, { data: tournament }, { data: predictions }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, is_admin, champion_team_id, onboarded")
        .order("created_at"),
      supabase.from("tournament").select("*").eq("id", 1),
      supabase
        .from("predictions")
        .select(
          "user_id, match_id, pred_home_score, pred_away_score, pred_winner_team_id, exact_hit, winner_hit, points_awarded",
        )
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Raw tables</h1>
        <a
          href="/admin"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Admin
        </a>
      </header>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-100">tournament</h2>
        <Table rows={(tournament ?? []) as Record<string, unknown>[]} />
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-100">
          profiles ({profiles?.length ?? 0})
        </h2>
        <Table rows={(profiles ?? []) as Record<string, unknown>[]} />
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-100">
          predictions ({predictions?.length ?? 0})
        </h2>
        <Table rows={(predictions ?? []) as Record<string, unknown>[]} />
      </section>
    </main>
  );
}
