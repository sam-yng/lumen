const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

// Values that must additionally parse as a URL. A present-but-malformed value
// (e.g. a "http://..." string that leaked surrounding quotes from an env
// export) passes a bare presence check but later crashes the Next server on
// every request — which surfaces as an opaque Playwright `webServer` timeout
// rather than a clear error. Validate the shape here so E2E fails fast.
const urlEnv = ["NEXT_PUBLIC_SUPABASE_URL"];

const isValidUrl = (value: string): boolean => {
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
};

const problems: string[] = [];

for (const name of requiredEnv) {
  const value = process.env[name];
  if (!value || value.endsWith("_xxx")) {
    problems.push(`- ${name} is missing or a placeholder`);
  }
}

for (const name of urlEnv) {
  const value = process.env[name];
  if (value && !value.endsWith("_xxx") && !isValidUrl(value)) {
    problems.push(`- ${name} is set but is not a valid URL: ${value}`);
  }
}

if (problems.length > 0) {
  console.error(
    [
      "E2E environment is not ready:",
      ...problems,
      "",
      "Start the local Supabase stack and set the app env before running Playwright.",
      "In CI, .github/workflows/ci.yml exports these values from `supabase status -o env`.",
    ].join("\n"),
  );
  process.exit(1);
}
