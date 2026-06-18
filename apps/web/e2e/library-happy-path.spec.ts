import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();
  // The node-tree app roots at "/"; wait for the library surface to load.
  await expect(page.getByLabel("Search notes and transcripts")).toBeVisible();
}

test("demo user manages the library through routes", async ({ page }) => {
  // Unique per run so reruns against the same seed can't collide.
  const stamp = Date.now();
  const workspaceName = `Testing ${stamp}`;
  const pageName = `Route note ${stamp}`;

  const consoleWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });

  await login(page);

  const nodes = page.getByRole("list", { name: "Library nodes" });

  // Create a workspace through the dialog (multiple "New workspace" triggers
  // exist); creating it auto-navigates to its own route.
  await page.getByRole("button", { name: "New workspace" }).first().click();
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/testing-[a-z0-9-]+$/i);

  // Create a page inside it; creating it auto-navigates to its editor route.
  await page.getByRole("button", { name: "New page" }).first().click();
  await page.getByLabel("Page title").fill(pageName);
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/testing-[a-z0-9-]+\/route-note-[a-z0-9-]+$/i);

  // The breadcrumb (a button, distinct from the sidebar "Library" link) returns
  // to the root library.
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Search opens the seeded note on its node route.
  await page.getByLabel("Search notes and transcripts").fill("mitochondria");
  const result = page.getByRole("button", { name: /Welcome to Lumen/i });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(
    /\/course-notes-[a-z0-9-]+\/welcome-to-lumen-[a-z0-9-]+$/i,
  );
  await expect(
    page
      .getByTestId("document-editor-shell")
      .getByRole("heading", { name: "Welcome to Lumen" }),
  ).toBeVisible();

  // Cleanup: delete the created workspace (cascades the page).
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/$/);
  await nodes.getByRole("button", { name: workspaceName }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(nodes.getByRole("button", { name: workspaceName })).toHaveCount(
    0,
  );

  expect(
    consoleWarnings.filter((warning) =>
      warning.includes("Duplicate extension names"),
    ),
  ).toEqual([]);
});

test("tags are created with a preset color", async ({ page }) => {
  const tagName = `Exam ${Date.now()}`;

  await login(page);

  await page.getByLabel("Tag name").fill(tagName);
  await page.getByLabel("Tag color").click();
  await page.getByRole("button", { name: "Use Blue tag color" }).click();
  await page.getByRole("button", { name: "Create tag" }).click();

  // The new tag shows in the sidebar tag panel as a "Filter by <name>" toggle;
  // scoping to the sidebar avoids the content-area filter chip duplicate.
  const sidebar = page.getByRole("complementary");
  const tagButton = sidebar.getByRole("button", {
    name: `Filter by ${tagName}`,
  });
  await expect(tagButton).toBeVisible();

  // Cleanup so reruns against the same seed stay unambiguous.
  await tagButton.hover();
  await sidebar.getByRole("button", { name: `Delete ${tagName}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(tagButton).toHaveCount(0);
});
