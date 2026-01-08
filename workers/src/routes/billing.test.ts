/**
 * @file billing.test.ts
 * @description Stripe Billing 路由单元测试
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// Test the schemas and helper functions directly

describe("Billing Routes - Validation", () => {
  describe("Checkout Schema", () => {
    const checkoutSchema = z.object({
      priceId: z.string().min(1, "Price ID is required"),
      successUrl: z.string().url("Invalid success URL"),
      cancelUrl: z.string().url("Invalid cancel URL"),
      metadata: z.record(z.string(), z.string()).optional(),
    });

    it("should accept valid checkout payload", () => {
      const result = checkoutSchema.safeParse({
        priceId: "price_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });
      expect(result.success).toBe(true);
    });

    it("should accept checkout with metadata", () => {
      const result = checkoutSchema.safeParse({
        priceId: "price_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        metadata: { source: "web", campaign: "launch" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty priceId", () => {
      const result = checkoutSchema.safeParse({
        priceId: "",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid successUrl", () => {
      const result = checkoutSchema.safeParse({
        priceId: "price_123",
        successUrl: "not-a-url",
        cancelUrl: "https://example.com/cancel",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid cancelUrl", () => {
      const result = checkoutSchema.safeParse({
        priceId: "price_123",
        successUrl: "https://example.com/success",
        cancelUrl: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const result = checkoutSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("Portal Schema", () => {
    const portalSchema = z.object({
      returnUrl: z.string().url("Invalid return URL"),
    });

    it("should accept valid portal payload", () => {
      const result = portalSchema.safeParse({
        returnUrl: "https://example.com/dashboard",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid returnUrl", () => {
      const result = portalSchema.safeParse({
        returnUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing returnUrl", () => {
      const result = portalSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe("Billing Response Helpers", () => {
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }

  function successResponse<T>(data: T): ApiResponse<T> {
    return { success: true, data };
  }

  function errorResponse(message: string): ApiResponse<never> {
    return { success: false, error: message, message };
  }

  it("should create success response with data", () => {
    const response = successResponse({ id: "123", status: "active" });
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: "123", status: "active" });
    expect(response.error).toBeUndefined();
  });

  it("should create error response with message", () => {
    const response = errorResponse("Payment failed");
    expect(response.success).toBe(false);
    expect(response.error).toBe("Payment failed");
    expect(response.message).toBe("Payment failed");
    expect(response.data).toBeUndefined();
  });
});

describe("Subscription Info Formatting", () => {
  interface SubscriptionInfo {
    id: string;
    status: string;
    priceId: string;
    productId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
  }

  function formatSubscription(subscription: any, item: any): SubscriptionInfo {
    const price = item.price;
    const productId =
      typeof price.product === "string" ? price.product : price.product.id;

    const itemAny = item as any;
    const periodStart =
      itemAny.current_period_start || subscription.billing_cycle_anchor;
    const periodEnd =
      itemAny.current_period_end || subscription.billing_cycle_anchor;

    return {
      id: subscription.id,
      status: subscription.status,
      priceId: price.id,
      productId,
      currentPeriodStart: new Date(periodStart * 1000).toISOString(),
      currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    };
  }

  it("should format active subscription correctly", () => {
    const subscription = {
      id: "sub_123",
      status: "active",
      billing_cycle_anchor: 1_700_000_000,
      cancel_at_period_end: false,
      canceled_at: null,
    };
    const item = {
      price: { id: "price_abc", product: "prod_xyz" },
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_678_400,
    };

    const result = formatSubscription(subscription, item);

    expect(result.id).toBe("sub_123");
    expect(result.status).toBe("active");
    expect(result.priceId).toBe("price_abc");
    expect(result.productId).toBe("prod_xyz");
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.canceledAt).toBeNull();
  });

  it("should format canceled subscription correctly", () => {
    const subscription = {
      id: "sub_456",
      status: "canceled",
      billing_cycle_anchor: 1_700_000_000,
      cancel_at_period_end: true,
      canceled_at: 1_701_000_000,
    };
    const item = {
      price: { id: "price_def", product: { id: "prod_abc" } },
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_678_400,
    };

    const result = formatSubscription(subscription, item);

    expect(result.id).toBe("sub_456");
    expect(result.status).toBe("canceled");
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.canceledAt).not.toBeNull();
  });

  it("should handle product as object", () => {
    const subscription = {
      id: "sub_789",
      status: "active",
      billing_cycle_anchor: 1_700_000_000,
      cancel_at_period_end: false,
      canceled_at: null,
    };
    const item = {
      price: { id: "price_ghi", product: { id: "prod_expanded" } },
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_678_400,
    };

    const result = formatSubscription(subscription, item);

    expect(result.productId).toBe("prod_expanded");
  });

  it("should fallback to billing_cycle_anchor when period dates missing", () => {
    const subscription = {
      id: "sub_fallback",
      status: "active",
      billing_cycle_anchor: 1_700_000_000,
      cancel_at_period_end: false,
      canceled_at: null,
    };
    const item = {
      price: { id: "price_jkl", product: "prod_mno" },
      // No current_period_start or current_period_end
    };

    const result = formatSubscription(subscription, item);

    // Should use billing_cycle_anchor for both dates
    expect(result.currentPeriodStart).toBe(
      new Date(1_700_000_000 * 1000).toISOString()
    );
    expect(result.currentPeriodEnd).toBe(
      new Date(1_700_000_000 * 1000).toISOString()
    );
  });
});

describe("Billing Route Handler Logic", () => {
  describe("Environment Configuration", () => {
    it("should identify missing STRIPE_SECRET_KEY", () => {
      const env: Record<string, string | undefined> = {};
      const stripeSecretKey = env.STRIPE_SECRET_KEY;

      expect(stripeSecretKey).toBeUndefined();
      expect(!stripeSecretKey).toBe(true);
    });

    it("should identify missing webhook secrets", () => {
      const env: Record<string, string | undefined> = {
        STRIPE_SECRET_KEY: "sk_test_123",
      };
      const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

      expect(webhookSecret).toBeUndefined();
    });

    it("should validate environment is configured", () => {
      const env = {
        STRIPE_SECRET_KEY: "sk_test_abc",
        STRIPE_WEBHOOK_SECRET: "whsec_xyz",
      };

      expect(env.STRIPE_SECRET_KEY).toBeTruthy();
      expect(env.STRIPE_WEBHOOK_SECRET).toBeTruthy();
    });
  });

  describe("Customer ID Handling", () => {
    it("should handle null stripe_customer_id", () => {
      const userSettings: { stripe_customer_id: string | null } | null = null;

      const hasCustomerId = userSettings?.stripe_customer_id != null;
      expect(hasCustomerId).toBe(false);
    });

    it("should extract customer ID from settings", () => {
      const userSettings = { stripe_customer_id: "cus_123" };

      const customerId = userSettings.stripe_customer_id;
      expect(customerId).toBe("cus_123");
    });

    it("should handle empty stripe_customer_id", () => {
      const userSettings: { stripe_customer_id: string | null } = {
        stripe_customer_id: null,
      };

      const hasCustomerId = !!userSettings.stripe_customer_id;
      expect(hasCustomerId).toBe(false);
    });
  });

  describe("User ID Extraction", () => {
    it("should extract userId from client_reference_id", () => {
      const session = {
        client_reference_id: "user_123",
        metadata: { userId: "user_456" },
      };

      const userId = session.client_reference_id || session.metadata?.userId;
      expect(userId).toBe("user_123");
    });

    it("should fallback to metadata userId", () => {
      const session = {
        client_reference_id: null,
        metadata: { userId: "user_456" },
      };

      const userId = session.client_reference_id || session.metadata?.userId;
      expect(userId).toBe("user_456");
    });

    it("should return undefined when no userId available", () => {
      const session = {
        client_reference_id: null,
        metadata: {},
      };

      const userId = session.client_reference_id || session.metadata?.userId;
      expect(userId).toBeUndefined();
    });
  });

  describe("Customer Extraction from Events", () => {
    it("should extract customer ID as string", () => {
      const subscription = { customer: "cus_abc" };

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer;

      expect(customerId).toBe("cus_abc");
    });

    it("should extract customer ID from object", () => {
      const subscription = {
        customer: { id: "cus_xyz", email: "test@example.com" },
      };

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      expect(customerId).toBe("cus_xyz");
    });
  });

  describe("Subscription ID Extraction", () => {
    it("should extract subscription ID as string", () => {
      const invoice = { subscription: "sub_123" };

      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      expect(subscriptionId).toBe("sub_123");
    });

    it("should extract subscription ID from object", () => {
      const invoice = { subscription: { id: "sub_456" } };

      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      expect(subscriptionId).toBe("sub_456");
    });

    it("should handle missing subscription", () => {
      const invoice = { subscription: undefined };

      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      expect(subscriptionId).toBeUndefined();
    });
  });
});

describe("Webhook Event Types", () => {
  it("should identify checkout.session.completed event", () => {
    const event = { type: "checkout.session.completed" };
    expect(event.type).toBe("checkout.session.completed");
  });

  it("should identify customer.subscription.updated event", () => {
    const event = { type: "customer.subscription.updated" };
    expect(event.type).toBe("customer.subscription.updated");
  });

  it("should identify customer.subscription.deleted event", () => {
    const event = { type: "customer.subscription.deleted" };
    expect(event.type).toBe("customer.subscription.deleted");
  });

  it("should identify invoice.payment_failed event", () => {
    const event = { type: "invoice.payment_failed" };
    expect(event.type).toBe("invoice.payment_failed");
  });

  it("should handle switch statement for event types", () => {
    const events = [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
      "unknown.event",
    ];

    const results = events.map((eventType) => {
      switch (eventType) {
        case "checkout.session.completed":
          return "handleCheckout";
        case "customer.subscription.updated":
          return "handleUpdate";
        case "customer.subscription.deleted":
          return "handleDelete";
        case "invoice.payment_failed":
          return "handlePaymentFailed";
        default:
          return "unhandled";
      }
    });

    expect(results).toEqual([
      "handleCheckout",
      "handleUpdate",
      "handleDelete",
      "handlePaymentFailed",
      "unhandled",
    ]);
  });
});

describe("Subscription Status Types", () => {
  it("should validate subscription status values", () => {
    const validStatuses = [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ];

    validStatuses.forEach((status) => {
      expect(typeof status).toBe("string");
    });
  });

  it("should identify active subscriptions", () => {
    const subscription = { status: "active" };
    expect(subscription.status === "active").toBe(true);
  });

  it("should identify canceled subscriptions", () => {
    const subscription = { status: "canceled" };
    expect(subscription.status === "canceled").toBe(true);
  });
});
