export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string; next?: string };
}) {
  const { token_hash, type, next } = searchParams;

  if (!token_hash || !type) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="text-4xl" aria-hidden>
          ⚠️
        </div>
        <h1 className="text-xl font-bold">Invalid sign-in link</h1>
        <a
          href="/login"
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to sign in
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="text-5xl" aria-hidden>
        ⚽️
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        World Cup 2026. Here We GO
      </h1>
      <p className="text-sm text-neutral-400">
        Tap below to finish signing in.
      </p>
      <form method="post" action="/auth/callback" className="w-full">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next ?? "/"} />
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white active:scale-[0.99]"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
