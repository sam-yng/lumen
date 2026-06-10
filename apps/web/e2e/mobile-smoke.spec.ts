import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/library$/);
}

test("mobile drawer + row actions happy path", async ({ page }) => {
  // Unique per run so leftovers from interrupted runs can't collide.
  const noteName = `Mobile note ${Date.now()}`;
  const renamedName = `${noteName} renamed`;

  await login(page);

  // No horizontal overflow.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  // Drawer: open, create a note from the sidebar action, drawer closes.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New note" })
    .click();
  await page.getByLabel("Note title").fill(noteName);
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(
    page.getByRole("button", { name: noteName }).first(),
  ).toBeVisible();

  // Row ⋯ menu: rename through the bottom-sheet dialog.
  await page.getByRole("button", { name: `Actions for ${noteName}` }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByLabel("Name", { exact: true }).fill(renamedName);
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(
    page.getByRole("button", { name: renamedName }).first(),
  ).toBeVisible();

  // Cleanup: delete it.
  await page
    .getByRole("button", { name: `Actions for ${renamedName}` })
    .click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: renamedName })).toHaveCount(0);
});
