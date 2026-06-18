export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden>
        ⚠️
      </div>
      <h1 className="text-xl font-bold">Sign-in link didn&apos;t work</h1>
      <p className="text-sm text-neutral-400">
        The magic link may have expired or already been used. Request a fresh
        one and try again.
      </p>
      <a
        href="/login"
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Back to sign in
      </a>
    </main>
  );
}
