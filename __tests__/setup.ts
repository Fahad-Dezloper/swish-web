// Env stubs — must be set before any module that checks them at import time.
process.env.SWISH_CORE_URL ??= "http://localhost:4000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.DISABLED_PROVIDERS ??= "";
