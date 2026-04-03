// Vercel Serverless Function — public Supabase config
// Returns the project URL and anon key for the TV display page.
// Set SUPABASE_URL and SUPABASE_ANON_KEY in your Vercel project settings.

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
  });
};
