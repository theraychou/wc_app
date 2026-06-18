export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden>
        🧭
      </div>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-sm text-neutral-400">
        That page doesn&apos;t exist or has moved.
      </p>
      <a
        href="/"
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Go home
      </a>
    </main>
  );
}
