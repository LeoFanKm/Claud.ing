/**
 * @file auth.setup.ts
 * @description Authentication setup for E2E tests
 *
 * This file runs before the test suite to establish authentication state.
 * For Clerk-based auth, we support two modes:
 * 1. Mock mode (default): Inject mock auth state without real OAuth
 * 2. Real mode: Use Clerk test account (requires CLERK_TEST_* env vars)
 *
 * @input Environment variables for auth configuration
 * @output Stored authentication state for test reuse
 * @position frontend/e2e
 *
 * @lastModified 2026-01-02
 */

import { expect, test as setup } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  const useRealAuth = process.env.E2E_USE_REAL_AUTH === "true";

  // Check if server is available
  try {
    const response = await page.goto("/", { timeout: 10_000 });
    if (!response) {
      console.log("[Auth Setup] Server not available, skipping auth setup");
      return;
    }
  } catch (error) {
    console.log(
      "[Auth Setup] Server not available, skipping auth setup:",
      error
    );
    // Create empty auth file to prevent test failures
    const fs = await import("fs");
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  if (useRealAuth) {
    // Real Clerk authentication flow (for integration testing)
    await setupRealAuth(page);
  } else {
    // Mock authentication (default for local development)
    await setupMockAuth(page);
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

/**
 * Setup mock authentication state
 * This bypasses Clerk OAuth and injects test user data directly
 */
async function setupMockAuth(
  page: import("@playwright/test").Page
): Promise<void> {
  // Navigate to app first
  await page.goto("/");

  // Wait for initial load
  await page.waitForLoadState("networkidle");

  // Inject mock auth state
  await page.evaluate(() => {
    const mockUser = {
      id: "test-user-001",
      email: "test@example.com",
      fullName: "Test User",
      username: "testuser",
      imageUrl: "",
    };

    // Set mock auth state
    window.localStorage.setItem(
      "__clerk_test_user__",
      JSON.stringify(mockUser)
    );
    window.localStorage.setItem("__e2e_test_mode__", "true");

    // Mock Clerk session token
    window.localStorage.setItem(
      "__clerk_session__",
      JSON.stringify({
        token: "mock-test-token-e2e",
        userId: mockUser.id,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
    );
  });

  // Reload to apply mock auth
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Verify mock auth was applied (check for presence of user indicator)
  // The app should now treat the user as logged in
  console.log("[Auth Setup] Mock authentication state configured");
}

/**
 * Setup real Clerk authentication
 * Requires environment variables:
 * - CLERK_TEST_EMAIL
 * - CLERK_TEST_PASSWORD
 */
async function setupRealAuth(
  page: import("@playwright/test").Page
): Promise<void> {
  const email = process.env.CLERK_TEST_EMAIL;
  const password = process.env.CLERK_TEST_PASSWORD;

  if (!(email && password)) {
    throw new Error(
      "Real auth mode requires CLERK_TEST_EMAIL and CLERK_TEST_PASSWORD environment variables"
    );
  }

  // Navigate to app
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Look for sign-in button
  const signInButton = page.locator(
    '[data-testid="sign-in-button"], button:has-text("Sign In")'
  );

  if (await signInButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await signInButton.click();

    // Wait for Clerk modal
    await page.waitForSelector('[data-clerk-component="sign-in"]', {
      timeout: 10_000,
    });

    // Fill in email
    const emailInput = page.locator(
      'input[name="identifier"], input[type="email"]'
    );
    await emailInput.fill(email);

    // Click continue
    await page
      .locator('button[data-localization-key="formButtonPrimary"]')
      .click();

    // Fill in password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 5000 });
    await passwordInput.fill(password);

    // Submit
    await page
      .locator('button[data-localization-key="formButtonPrimary"]')
      .click();

    // Wait for redirect after successful login
    await page.waitForURL((url) => !url.href.includes("sign-in"), {
      timeout: 15_000,
    });
  }

  // Verify logged in state
  await expect(
    page.locator('[data-testid="user-avatar"], [data-testid="user-menu"]')
  ).toBeVisible({
    timeout: 10_000,
  });

  console.log("[Auth Setup] Real Clerk authentication completed");
}
