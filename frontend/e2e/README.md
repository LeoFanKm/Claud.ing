# E2E Testing Guide

This directory contains end-to-end tests using Playwright for the Vibe Kanban frontend.

## Prerequisites

1. **Node.js** 18+ installed
2. **Playwright browsers** installed:
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### 1. Start the Dev Server

In a separate terminal, start the development server:

```bash
cd frontend
npm run dev
```

Wait until you see the server is ready (usually at `http://localhost:3000`).

### 2. Run E2E Tests

```bash
# Run all tests
npm run test:e2e

# Run tests with UI mode (recommended for debugging)
npm run test:e2e:ui

# Run tests in headed mode (see the browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# View test report after run
npm run test:e2e:report
```

### Running Specific Test Files

```bash
# Run only auth tests
npx playwright test e2e/auth.spec.ts

# Run only task tests
npx playwright test e2e/tasks.spec.ts

# Run only billing tests
npx playwright test e2e/billing.spec.ts
```

## Test Scenarios

### Auth Flow (`auth.spec.ts`)

- Sign-in button visibility for unauthenticated users
- Public page access
- Protected route redirects
- Authentication state persistence
- Sign out flow
- Error handling

### Task Management (`tasks.spec.ts`)

- Kanban board display
- Task creation flow
- Task editing
- Task status updates
- Task deletion
- Task attempt creation

### Billing (`billing.spec.ts`)

- Subscription status display
- Checkout flow initiation
- Customer portal access
- Payment error handling
- Subscription state variations

## Authentication Modes

### Mock Mode (Default)

Tests use mock authentication by injecting test user data into localStorage. This is fast and doesn't require real Clerk credentials.

### Real Auth Mode

To test with real Clerk authentication:

```bash
E2E_USE_REAL_AUTH=true \
CLERK_TEST_EMAIL=your-test@email.com \
CLERK_TEST_PASSWORD=your-password \
npm run test:e2e
```

## Configuration

- **Config file**: `playwright.config.ts`
- **Base URL**: `http://localhost:3000` (or `E2E_BASE_URL` env var)
- **Browsers**: Chromium and Mobile Chrome by default
- **Parallel**: Tests run in parallel (except on CI)
- **Retries**: 2 retries on CI, 0 locally

## Writing New Tests

1. Use the custom fixtures from `fixtures/test-fixtures.ts`:
   ```typescript
   import { test, expect, waitForPageLoad, mockApiResponse } from './fixtures/test-fixtures'
   ```

2. Mock API responses for predictable tests:
   ```typescript
   await mockApiResponse(page, '**/api/tasks', {
     body: { success: true, data: mockTasks }
   })
   ```

3. Use `authenticatedPage` fixture for logged-in tests:
   ```typescript
   test('my test', async ({ authenticatedPage }) => {
     await authenticatedPage.goto('/dashboard')
   })
   ```

## CI Integration

Tests run automatically on CI. Configure the `E2E_BASE_URL` environment variable to point to your staging/preview deployment.

```yaml
# Example GitHub Actions config
- name: Run E2E tests
  run: npm run test:e2e
  env:
    E2E_BASE_URL: ${{ env.PREVIEW_URL }}
```

## Troubleshooting

### Tests fail with "net::ERR_CONNECTION_REFUSED"

The dev server is not running. Start it with `npm run dev` in a separate terminal.

### Tests are flaky

1. Increase timeouts in `playwright.config.ts`
2. Add more specific selectors
3. Use `await page.waitForLoadState('networkidle')` after navigation

### Authentication issues

Clear the auth state and re-run setup:
```bash
rm -rf e2e/.auth
npx playwright test --project=setup
```
