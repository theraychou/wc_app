"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden>
        😵
      </div>
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-neutral-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-200"
        >
          Go home
        </a>
      </div>
    </main>
  );
}
