import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · World Cup 2026",
  description: "Rules and scoring for the World Cup 2026 prediction pool.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export default function InstructionsPage() {
  return (
    <main className="mx-auto max-w-md space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">How it works</h1>
        <p className="text-sm text-neutral-400">
          One Cup. One Game. One Winner. Here&apos;s everything you can and
          can&apos;t do, and how points are awarded.
        </p>
      </header>

      <Section title="The basics">
        <ul className="list-disc space-y-1 pl-5">
          <li>We predict the World Cup 2026 knockout stage (32 matches).</li>
          <li>
            For each match you predict the <strong>90-minute score</strong> and
            the <strong>team that advances</strong>.
          </li>
          <li>
            You also pick <strong>one champion</strong> — the team you think
            wins the whole tournament.
          </li>
        </ul>
      </Section>

      <Section title="Making &amp; changing predictions">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            You can enter or change a prediction any time{" "}
            <strong>up to 5 minutes before kickoff</strong>.
          </li>
          <li>
            Once that 5-minute mark passes, the match{" "}
            <strong>locks</strong> — your prediction is read-only and taken as
            is.
          </li>
          <li>
            <strong>No prediction = no points.</strong> If you don&apos;t enter
            a prediction before the lock, you score 0 for that match.
          </li>
          <li>
            Until a match kicks off you only see your own picks; everyone&apos;s
            picks are revealed after kickoff.
          </li>
        </ul>
      </Section>

      <Section title="Points per match">
        <p>
          The exact-score and advancing-team points <strong>stack</strong>.
          Points are higher from the semi-finals onward:
        </p>
        <div className="overflow-hidden rounded-lg border border-neutral-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Round</th>
                <th className="px-3 py-2 font-medium">Exact score</th>
                <th className="px-3 py-2 font-medium">Right winner</th>
                <th className="px-3 py-2 font-medium">Perfect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              <tr>
                <td className="px-3 py-2">R32 · R16 · QF</td>
                <td className="px-3 py-2">+5</td>
                <td className="px-3 py-2">+2</td>
                <td className="px-3 py-2 font-semibold">+7</td>
              </tr>
              <tr>
                <td className="px-3 py-2">SF · 3rd · Final</td>
                <td className="px-3 py-2">+10</td>
                <td className="px-3 py-2">+5</td>
                <td className="px-3 py-2 font-semibold">+15</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Exact score</strong> = the result at the end of 90 minutes
            (regulation), not counting extra time. A knockout match can be a
            draw at 90 mins (e.g. 1–1).
          </li>
          <li>
            <strong>Right winner</strong> = the team that actually advances —
            including via extra time or penalties.
          </li>
        </ul>
      </Section>

      <Section title="Champion bonus">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Predict the overall tournament winner correctly →{" "}
            <strong>+20 points</strong>, awarded once after the Final.
          </li>
          <li>
            Your champion pick locks at the first Round-of-32 kickoff and
            can&apos;t change after that.
          </li>
        </ul>
      </Section>

      <Section title="Leaderboard">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The leaderboard updates <strong>automatically after every match</strong>{" "}
            is settled.
          </li>
          <li>The top 3 are shown larger; everyone else in a compact list.</li>
          <li>
            Ties are broken by: most points → most exact-score hits → who joined
            earliest.
          </li>
        </ul>
      </Section>

      <Section title="Groups">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            You compete <strong>within your group</strong> — each group has its
            own separate leaderboard, so you&apos;re only ranked against your own
            people.
          </li>
          <li>
            Join a group with its <strong>invite code</strong>, or create your
            own and share the code (tap <strong>Invite</strong> to copy it).
          </li>
          <li>
            You can be in <strong>more than one group</strong>. Your predictions
            are the <strong>same everywhere</strong> — they just count on each
            group&apos;s leaderboard. Switch between your groups&apos;
            leaderboards with the tabs at the top of the Leaderboard.
          </li>
          <li>
            You can <strong>leave</strong> a group any time from the Groups page;
            your points stay in your other groups.
          </li>
        </ul>
      </Section>

      <Section title="Group owner">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Whoever <strong>creates</strong> a group is its <strong>owner</strong>
            {" "}(shown with an &ldquo;owner&rdquo; badge in the member list).
          </li>
          <li>
            The owner can <strong>remove members</strong> from the group (a
            Remove button next to each member on the Groups page). Other members
            can&apos;t remove anyone.
          </li>
          <li>
            Anyone with the invite code can join — there&apos;s no approval step.
          </li>
          <li>
            Separately, a <strong>game admin</strong> looks after the tournament
            itself (pulling in results) for everyone — that&apos;s not a
            per-group role.
          </li>
        </ul>
      </Section>

      <a
        href="/"
        className="inline-block text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
      >
        ← Back home
      </a>
    </main>
  );
}
