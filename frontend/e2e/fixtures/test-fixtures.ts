/**
 * @file test-fixtures.ts
 * @description Custom Playwright fixtures for authentication and common test setup
 *
 * @input Playwright test context
 * @output Extended test fixtures with auth helpers
 * @position frontend/e2e/fixtures
 *
 * @lastModified 2026-01-02
 */

import {
  type BrowserContext,
  test as base,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";

// Server availability check cache
let serverAvailable: boolean | null = null;

/**
 * Check if the dev server is running
 */
export async function checkServerAvailability(
  baseURL: string
): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable;

  try {
    const response = await fetch(baseURL, { method: "HEAD" });
    serverAvailable = response.ok || response.status < 500;
  } catch {
    serverAvailable = false;
  }

  return serverAvailable;
}

/**
 * Skip test if server is not available
 */
export function skipIfNoServer(testInfo: TestInfo): void {
  if (serverAvailable === false) {
    testInfo.skip(true, "Dev server not running. Start with: npm run dev");
  }
}

// Test user data (for mocked auth or Clerk test mode)
export interface TestUser {
  id: string;
  email: string;
  fullName: string;
  username: string;
}

export const TEST_USERS = {
  default: {
    id: "test-user-001",
    email: "test@example.com",
    fullName: "Test User",
    username: "testuser",
  },
  admin: {
    id: "test-admin-001",
    email: "admin@example.com",
    fullName: "Admin User",
    username: "adminuser",
  },
} as const;

// Extended fixtures
interface TestFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
}

interface WorkerFixtures {
  authContext: BrowserContext;
}

/**
 * Custom test fixture that provides an authenticated page
 *
 * Usage:
 * ```ts
 * test('my test', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/projects')
 * })
 * ```
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Provide test user data
  testUser: [TEST_USERS.default, { option: true }],

  // Create authenticated browser context (worker-scoped for efficiency)
  authContext: [
    async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: process.env.AUTH_STATE_PATH || undefined,
      });
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],

  // Provide an authenticated page
  authenticatedPage: async ({ authContext, testUser }, use) => {
    const page = await authContext.newPage();

    // Inject mock auth state for testing
    // This simulates being logged in without going through Clerk OAuth
    await page.addInitScript((user) => {
      // Mock Clerk user state in localStorage/sessionStorage
      window.localStorage.setItem("__clerk_test_user__", JSON.stringify(user));
      window.localStorage.setItem("__e2e_test_mode__", "true");
    }, testUser);

    await use(page);
    await page.close();
  },
});

export { expect };

/**
 * Helper to wait for page to be fully loaded
 * Note: In E2E tests with mocked APIs, spinners may persist if mocks aren't complete
 */
export async function waitForPageLoad(
  page: Page,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;

  // Wait for DOM content loaded
  await page.waitForLoadState("domcontentloaded");

  // Try to wait for network idle, but don't fail if it times out
  try {
    await page.waitForLoadState("networkidle", { timeout: timeout / 2 });
  } catch {
    // Network might not settle due to mocked/blocked requests - this is OK
  }

  // Check for loading spinners, but don't wait too long
  // This is lenient because in test environments the app may have perpetual loaders
  const spinner = page.locator('[data-testid="loading-spinner"]').first();
  try {
    if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
      await spinner.waitFor({ state: "hidden", timeout });
    }
  } catch {
    // Spinner may never disappear in test environment without real backend - this is OK
  }
}

/**
 * Helper to wait for toast notifications
 */
export async function waitForToast(
  page: Page,
  options?: { text?: string; type?: "success" | "error" }
): Promise<void> {
  const toastSelector = options?.type
    ? `[data-sonner-toast][data-type="${options.type}"]`
    : "[data-sonner-toast]";

  const toast = page.locator(toastSelector).first();
  await toast.waitFor({ state: "visible", timeout: 5000 });

  if (options?.text) {
    await expect(toast).toContainText(options.text);
  }
}

/**
 * Helper to fill form fields reliably
 */
export async function fillFormField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const field = page.locator(selector);
  await field.click();
  await field.clear();
  await field.fill(value);
}

/**
 * Helper to select option from custom dropdown
 */
export async function selectOption(
  page: Page,
  triggerSelector: string,
  optionText: string
): Promise<void> {
  await page.locator(triggerSelector).click();
  await page.locator(`[role="option"]:has-text("${optionText}")`).click();
}

/**
 * Mock API response for testing
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: { status?: number; body: unknown }
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status: response.status || 200,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
}

/**
 * Wait for API request to complete
 */
export async function waitForApiRequest(
  page: Page,
  urlPattern: string | RegExp,
  options?: { method?: string }
): Promise<void> {
  await page.waitForRequest((request) => {
    const matchesUrl =
      typeof urlPattern === "string"
        ? request.url().includes(urlPattern)
        : urlPattern.test(request.url());
    const matchesMethod = options?.method
      ? request.method() === options.method
      : true;
    return matchesUrl && matchesMethod;
  });
}
