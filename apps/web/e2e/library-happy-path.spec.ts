import { expect, test } from "@playwright/test";

test("demo user can open the workspace, search a note, and open the editor", async ({
  page,
}) => {
  const consoleWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });

  await page.goto("/login");

  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "Lumen" })).toBeVisible();

  await page.getByLabel("Search notes and transcripts").fill("mitochondria");
  const result = page.getByRole("button", { name: /Welcome to Lumen/i });
  await expect(result).toBeVisible();

  await result.click();

  await expect(page).toHaveURL(/\/library\/notes\/[0-9a-f-]+$/i);
  await expect(
    page.getByRole("heading", { name: "Welcome to Lumen" }),
  ).toBeVisible();
  await expect(page.getByText("Rich-text note with autosave")).toBeVisible();

  await page.getByRole("link", { name: "Back to library" }).click();
  await expect(page).toHaveURL(/\/library$/);
  expect(
    consoleWarnings.filter((warning) =>
      warning.includes("Duplicate extension names"),
    ),
  ).toEqual([]);
});
