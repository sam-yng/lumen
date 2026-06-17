import { readFileSync } from "node:fs";

const dockerfilePath = "apps/web/worker/Dockerfile";
const dockerfile = readFileSync(dockerfilePath, "utf8");

const requiredSnippets = [
  {
    label: "worker image explicitly configures whisper.cpp with CMake",
    snippet:
      "cmake -S node_modules/nodejs-whisper/cpp/whisper.cpp -B node_modules/nodejs-whisper/cpp/whisper.cpp/build",
  },
  {
    label: "worker image builds whisper.cpp before runtime",
    snippet:
      "cmake --build node_modules/nodejs-whisper/cpp/whisper.cpp/build --config Release",
  },
  {
    label: "worker image verifies whisper-cli exists",
    snippet:
      "test -x node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-cli",
  },
];

const failures: string[] = [];

const aptInstallBlock = dockerfile.match(
  /apt-get install -y --no-install-recommends[\s\S]*?&& rm -rf \/var\/lib\/apt\/lists\/\*/,
)?.[0];

if (!aptInstallBlock || !/\bgit\b/.test(aptInstallBlock)) {
  failures.push(
    "Missing: native package list installs git for whisper.cpp CMake configure",
  );
}

for (const requirement of requiredSnippets) {
  if (!dockerfile.includes(requirement.snippet)) {
    failures.push(`Missing: ${requirement.label}`);
  }
}

if (dockerfile.includes("bun run worker:download-model || true")) {
  failures.push("worker:download-model must not be allowed to fail silently");
}

if (failures.length > 0) {
  console.error(`${dockerfilePath} failed worker bootstrap checks:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`${dockerfilePath} worker bootstrap checks passed.`);
