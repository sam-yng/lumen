# Connecting an MCP host to Lumen

Endpoint: `POST {APP_URL}/api/mcp` (Streamable HTTP, stateless).
Auth: `Authorization: Bearer <supabase-access-token>`.

Obtain a token from an authenticated browser session (Supabase
`getSession().access_token`) or the Supabase CLI for a test user.

Example (generic MCP host config):

```json
{
  "mcpServers": {
    "lumen": {
      "url": "https://<app-url>/api/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Verify with an `initialize` request followed by `tools/list`; you should see
search_notes, get_document, get_transcript, create_note, list_by_tag.
