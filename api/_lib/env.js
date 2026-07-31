function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSupabaseConfig() {
  const url = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = process.env.SUPABASE_ANON_KEY || serviceRoleKey;

  return {
    url,
    serviceRoleKey,
    anonKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "physicsstudio-media",
  };
}

module.exports = {
  requireEnv,
  getSupabaseConfig,
};
