import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();
  // The node-tree app roots at "/"; wait for the authenticated mobile shell
  // rather than a specific URL.
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
}

test("mobile drawer + node lifecycle happy path", async ({ page }) => {
  // Unique per run so leftovers from interrupted runs can't collide.
  const noteName = `Mobile note ${Date.now()}`;

  await login(page);

  // No horizontal overflow.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  // Inputs must compute to >=16px below sm or iOS Safari zooms on focus.
  // (Tailwind v4 utilities beat @layer base, so this guards the component
  // classes, not the global fallback rule.)
  const searchFontSize = await page
    .getByLabel("Search notes and transcripts")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(searchFontSize).toBeGreaterThanOrEqual(16);

  const nodes = page.getByRole("list", { name: "Library nodes" });

  // Open the seeded "Course notes" workspace (double-tap opens a node).
  await nodes.getByRole("button", { name: "Course notes" }).dblclick();
  await expect(page).toHaveURL(/\/course-notes/);

  // Drawer: create a note from the sidebar action. Notes open in the
  // standalone editor rather than staying inside the workspace shell.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New note" })
    .click();
  await page.getByLabel("Note title").fill(noteName);
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/library\/notes\/[0-9a-f-]+$/i);
  await expect(
    page
      .getByTestId("document-editor-shell")
      .getByRole("heading", { name: noteName }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Back to library" }).click();
  await nodes.getByRole("button", { name: "Course notes" }).dblclick();
  await expect(nodes.getByRole("button", { name: noteName })).toBeVisible();

  // The node tree has no per-row menu: select the row, then delete through the
  // bulk action bar + confirmation dialog.
  await nodes.getByRole("button", { name: noteName }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(nodes.getByRole("button", { name: noteName })).toHaveCount(0);
});

test("tag rename from the drawer survives the drawer close-on-click handler", async ({
  page,
}) => {
  const tagName = `Tag ${Date.now()}`;
  const renamedTag = `${tagName} renamed`;

  await login(page);

  // Create a tag inside the drawer; the create form is marked data-drawer-stay
  // so the drawer must remain open afterwards.
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Tag name").fill(tagName);
  await drawer.getByRole("button", { name: "Create tag" }).click();
  // Compact tag rows render the tag as a "Filter by <name>" toggle button.
  const tagButton = drawer.getByRole("button", {
    name: `Filter by ${tagName}`,
  });
  await expect(tagButton).toBeVisible();

  // Rename through the tag controls; the dialog is owned by drawer content,
  // so this regresses if the drawer closes (and unmounts it) on that click.
  // The Rename/Delete controls only reveal on hover/focus of the row.
  await tagButton.hover();
  await drawer.getByRole("button", { name: `Rename ${tagName}` }).click();
  await page.getByLabel("Tag name").last().fill(renamedTag);
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const renamedButton = drawer.getByRole("button", {
    name: `Filter by ${renamedTag}`,
  });
  await expect(renamedButton).toBeVisible();

  // Cleanup.
  await renamedButton.hover();
  await drawer.getByRole("button", { name: `Delete ${renamedTag}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(renamedButton).toHaveCount(0);
});
