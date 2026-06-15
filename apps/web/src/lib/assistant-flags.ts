// Single flip for the in-app assistant. The assistant (v2 + cited retrieval) is
// built and tested but descoped from the production launch: it needs a real
// Claude API key (BYO-key, per-user via Vault) that isn't available at launch.
//
// While false, both on-ramps are gated off — the sidebar "Ask Lumen" entry is a
// disabled span and the settings key form is disabled — but the /assistant page
// itself stays fully functional so it works in dev and the moment this flips.
//
// Phase 2 of docs/exec-plans/queued/post-prod/assistant-launch.md flips this to
// true after the prod instance exists and a key is configured.
export const ASSISTANT_ENABLED = false;
