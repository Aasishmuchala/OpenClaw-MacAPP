import { test, expect } from "@playwright/test";

test("app renders shell + sidebar sections", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".oc-brand .oc-title")).toHaveText("OpenClaw");
  await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();

  // Sections
  await expect(page.getByRole("button", { name: "Chats" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gateway" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Models" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permissions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
});

test("navigation switches panels (UI only)", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Gateway", exact: true }).click();
  await expect(page.locator(".oc-main .oc-card-title", { hasText: "Gateway" })).toBeVisible();

  await page.getByRole("button", { name: "Permissions", exact: true }).click();
  await expect(page.getByText("Permissions (guided)")).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Settings")).toBeVisible();
});
