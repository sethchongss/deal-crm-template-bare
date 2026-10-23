/** True when the public Supabase URL and anon key are set. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return /^https?:\/\//.test(url) && !url.includes("YOUR_PROJECT_REF") && key.length > 0;
}
