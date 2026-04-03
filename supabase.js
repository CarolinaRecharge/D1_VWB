// Supabase client initialization
//
// This module fetches Supabase credentials from a Vercel serverless function
// so that keys are never embedded in static HTML/JS files.
//
// For LOCAL DEVELOPMENT without Vercel:
//   Option A: Run `vercel dev` which spins up the /api/* functions locally.
//   Option B: Create a local server that serves the /api/config and
//             /api/admin-config endpoints, or temporarily hardcode values
//             directly in initSupabase() below (do NOT commit those values).
//
// The Supabase JS client is loaded via CDN in each HTML file:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// This makes window.supabase.createClient available globally.

/**
 * Initialize and return a Supabase client.
 * @param {boolean} useServiceKey - Pass true on the admin page to use the
 *   service role key (bypasses RLS). Default false uses the anon key.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
async function initSupabase(useServiceKey = false) {
  const endpoint = useServiceKey ? '/api/admin-config' : '/api/config';

  let url, key;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
    ({ url, key } = await res.json());
  } catch (err) {
    console.error('Failed to load Supabase config:', err);
    throw err;
  }

  if (!url || !key) {
    throw new Error(
      'Supabase credentials missing. ' +
      'Set SUPABASE_URL and ' +
      (useServiceKey ? 'SUPABASE_SERVICE_KEY' : 'SUPABASE_ANON_KEY') +
      ' in your Vercel project settings.'
    );
  }

  return window.supabase.createClient(url, key);
}
