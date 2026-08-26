// ============================================================================
// Supabase connection for the Sri Cine Hub console.
//
// TO GO LIVE:
//   1. Create a Supabase project (https://supabase.com).
//   2. In the SQL editor, run  ../schema/schema.sql  then  ../schema/seed.sql
//   3. Project Settings → API → "Exposed schemas": add  srchub
//   4. Paste your Project URL and anon (public) key below.
//
// Leave these blank to keep running fully offline on the built-in seed data
// (console-data.js). No credentials in the page = no network calls.
// ============================================================================
window.SUPABASE_CONFIG = {
  url: "https://bjciguzquacvecygjeni.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqY2lndXpxdWFjdmVjeWdqZW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MTMzNDQsImV4cCI6MjEwMzI4OTM0NH0.DBufwLWsOU9Ax985vUODcs9FNKdMfTdW5tvYVhN2D-Y",
  schema: "srchub"
};
