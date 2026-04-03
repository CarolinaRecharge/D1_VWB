// Vercel Serverless Function — admin Supabase config
// Returns the project URL and service role key for the admin page.
// The service role key bypasses Row Level Security — keep it secret.
//
// SECURITY NOTE: This endpoint is not authenticated at the HTTP level.
// Access to destructive operations is protected by the admin page password gate.
// If you need stricter security, add an Authorization header check here.
//
// Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your Vercel project settings.

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_KEY || '',
  });
};
