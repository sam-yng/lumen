const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const missing = requiredEnv.filter((name) => {
  const value = process.env[name];
  return !value || value.endsWith("_xxx");
});

if (missing.length > 0) {
  console.error(
    [
      "Missing E2E environment values:",
      ...missing.map((name) => `- ${name}`),
      "",
      "Start the local Supabase stack and set the app env before running Playwright.",
      "In CI, .github/workflows/ci.yml exports these values from `supabase status -o env`.",
    ].join("\n"),
  );
  process.exit(1);
}
