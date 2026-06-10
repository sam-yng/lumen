import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/library$/);
}

test("demo user manages the library through routes", async ({ page }) => {
  const consoleWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });

  await login(page);
  await expect(page.getByRole("heading", { name: "Lumen" })).toBeVisible();

  // Create a folder through the dialog (multiple "New folder" triggers exist).
  await page.getByRole("button", { name: "New folder" }).first().click();
  await page.getByLabel("Folder name").fill("Testing");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(
    page.getByRole("button", { name: "Testing" }).first(),
  ).toBeVisible();

  // Create a note and open it on its own route.
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByLabel("Note title").fill("Route note");
  await page.getByRole("button", { name: "Create note" }).click();
  await page.getByRole("button", { name: "Route note" }).first().click();
  await expect(page).toHaveURL(/\/library\/notes\/[0-9a-f-]+$/i);
  await page.getByRole("link", { name: "Back to library" }).click();
  await expect(page).toHaveURL(/\/library$/);

  // Search opens the seeded note on its route.
  await page.getByLabel("Search notes and transcripts").fill("mitochondria");
  const result = page.getByRole("button", { name: /Welcome to Lumen/i });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/library\/notes\/[0-9a-f-]+$/i);
  await expect(
    page.getByRole("heading", { name: "Welcome to Lumen" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to library" }).click();
  await expect(page).toHaveURL(/\/library$/);

  expect(
    consoleWarnings.filter((warning) =>
      warning.includes("Duplicate extension names"),
    ),
  ).toEqual([]);
});

test("upload picker shows and clears a selected file", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Upload" }).first().click();
  await page.getByLabel("Choose file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByText("notes.txt")).toBeVisible();

  await page.getByRole("button", { name: "Remove selected file" }).click();
  await expect(page.getByText("notes.txt")).not.toBeVisible();
});

test("tags are created with a preset color", async ({ page }) => {
  await login(page);

  await page.getByLabel("Tag name").fill("Exam");
  await page.getByLabel("Tag color").selectOption({ label: "Blue" });
  await page.getByRole("button", { name: "Create tag" }).click();

  // The new tag shows in the sidebar tag panel; exact match avoids the
  // "Rename Exam" / "Delete Exam" control buttons, and scoping to the
  // sidebar avoids the content-area filter chip duplicate.
  await expect(
    page
      .getByRole("complementary")
      .getByRole("button", { name: "Exam", exact: true }),
  ).toBeVisible();
});
