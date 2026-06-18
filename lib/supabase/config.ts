/**
 * True when the public Supabase env vars are present. Used to degrade
 * gracefully (show a setup notice instead of crashing) before `.env.local`
 * is filled in.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
