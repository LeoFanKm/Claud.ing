/**
 * @file billing.ts
 * @description Stripe Billing API 路由 - 订阅、支付、客户门户、Webhook
 *
 * @input HTTP 请求 (GET/POST)
 * @output Stripe 会话/订阅数据
 * @position workers/src/routes (路由层)
 *
 * Endpoints:
 * - POST /checkout - 创建 Checkout 会话
 * - GET /subscription - 查询订阅状态
 * - POST /portal - 创建客户门户会话
 * - POST /webhook - Stripe Webhook 处理
 *
 * @lastModified 2026-01-02
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import {
  type AuthBindings,
  authMiddleware,
  getUserId,
  requireAuth,
} from "../middleware/auth";
import { createDatabaseService } from "../services/database";

// Stripe 实例将在请求时创建（需要访问环境变量）
function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
    typescript: true,
  });
}

// API 响应包装器
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

// Checkout 会话创建 Schema
const createCheckoutSchema = z.object({
  priceId: z.string().min(1, "Price ID is required"),
  successUrl: z.string().url("Invalid success URL"),
  cancelUrl: z.string().url("Invalid cancel URL"),
  metadata: z.record(z.string(), z.string()).optional(),
});

// Portal 会话创建 Schema
const createPortalSchema = z.object({
  returnUrl: z.string().url("Invalid return URL"),
});

// 订阅状态类型
export interface SubscriptionInfo {
  id: string;
  status: Stripe.Subscription.Status;
  priceId: string;
  productId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

// Checkout 响应
export interface CheckoutResponse {
  sessionId: string;
  url: string;
}

// Portal 响应
export interface PortalResponse {
  url: string;
}

// Billing 路由
export const billingRoutes = new Hono<AuthBindings>();

// 应用认证中间件
billingRoutes.use("*", authMiddleware);

/**
 * POST /api/billing/checkout - 创建 Stripe Checkout 会话
 */
billingRoutes.post(
  "/checkout",
  requireAuth,
  zValidator("json", createCheckoutSchema),
  async (c) => {
    const userId = getUserId(c);
    const payload = c.req.valid("json");

    const stripeSecretKey = (c.env as unknown as { STRIPE_SECRET_KEY?: string })
      .STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("[Billing] STRIPE_SECRET_KEY not configured");
      return c.json(errorResponse("Payment service not configured"), 503);
    }

    const stripe = createStripe(stripeSecretKey);
    const db = createDatabaseService(c);

    try {
      let customerId: string | undefined;

      const userSettings = await db.queryOne<{
        stripe_customer_id: string | null;
      }>("SELECT stripe_customer_id FROM user_settings WHERE user_id = $1", [
        userId,
      ]);

      if (userSettings?.stripe_customer_id) {
        customerId = userSettings.stripe_customer_id;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: payload.priceId, quantity: 1 }],
        success_url: payload.successUrl,
        cancel_url: payload.cancelUrl,
        customer: customerId,
        client_reference_id: userId!,
        metadata: { userId: userId!, ...payload.metadata },
        ...(customerId ? {} : { customer_creation: "always" }),
        subscription_data: { metadata: { userId: userId! } },
      });

      if (!session.url) {
        return c.json(errorResponse("Failed to create checkout session"), 500);
      }

      return c.json(
        successResponse<CheckoutResponse>({
          sessionId: session.id,
          url: session.url,
        }),
        201
      );
    } catch (error) {
      console.error("[Billing] Checkout session creation failed:", error);
      if (error instanceof Stripe.errors.StripeError) {
        return c.json(errorResponse(`Stripe error: ${error.message}`), 400);
      }
      return c.json(errorResponse("Failed to create checkout session"), 500);
    }
  }
);

/**
 * GET /api/billing/subscription - 查询用户订阅状态
 */
billingRoutes.get("/subscription", requireAuth, async (c) => {
  const userId = getUserId(c);

  const stripeSecretKey = (c.env as unknown as { STRIPE_SECRET_KEY?: string })
    .STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("[Billing] STRIPE_SECRET_KEY not configured");
    return c.json(errorResponse("Payment service not configured"), 503);
  }

  const stripe = createStripe(stripeSecretKey);
  const db = createDatabaseService(c);

  try {
    const userSettings = await db.queryOne<{
      stripe_customer_id: string | null;
    }>("SELECT stripe_customer_id FROM user_settings WHERE user_id = $1", [
      userId,
    ]);

    if (!userSettings?.stripe_customer_id) {
      return c.json(
        successResponse({ hasSubscription: false, subscription: null })
      );
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: userSettings.stripe_customer_id,
      status: "active",
      limit: 1,
      expand: ["data.items.data.price.product"],
    });

    if (subscriptions.data.length === 0) {
      const allSubscriptions = await stripe.subscriptions.list({
        customer: userSettings.stripe_customer_id,
        limit: 1,
        expand: ["data.items.data.price.product"],
      });

      if (allSubscriptions.data.length === 0) {
        return c.json(
          successResponse({ hasSubscription: false, subscription: null })
        );
      }

      const subscription = allSubscriptions.data[0];
      const item = subscription.items.data[0];
      return c.json(
        successResponse({
          hasSubscription: false,
          subscription: formatSubscription(subscription, item),
        })
      );
    }

    const subscription = subscriptions.data[0];
    const item = subscription.items.data[0];
    return c.json(
      successResponse({
        hasSubscription: true,
        subscription: formatSubscription(subscription, item),
      })
    );
  } catch (error) {
    console.error("[Billing] Subscription query failed:", error);
    if (error instanceof Stripe.errors.StripeError) {
      return c.json(errorResponse(`Stripe error: ${error.message}`), 400);
    }
    return c.json(errorResponse("Failed to retrieve subscription"), 500);
  }
});

/**
 * POST /api/billing/portal - 创建 Stripe 客户门户会话
 */
billingRoutes.post(
  "/portal",
  requireAuth,
  zValidator("json", createPortalSchema),
  async (c) => {
    const userId = getUserId(c);
    const payload = c.req.valid("json");

    const stripeSecretKey = (c.env as unknown as { STRIPE_SECRET_KEY?: string })
      .STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("[Billing] STRIPE_SECRET_KEY not configured");
      return c.json(errorResponse("Payment service not configured"), 503);
    }

    const stripe = createStripe(stripeSecretKey);
    const db = createDatabaseService(c);

    try {
      const userSettings = await db.queryOne<{
        stripe_customer_id: string | null;
      }>("SELECT stripe_customer_id FROM user_settings WHERE user_id = $1", [
        userId,
      ]);

      if (!userSettings?.stripe_customer_id) {
        return c.json(errorResponse("No billing account found"), 404);
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: userSettings.stripe_customer_id,
        return_url: payload.returnUrl,
      });

      return c.json(successResponse<PortalResponse>({ url: session.url }), 201);
    } catch (error) {
      console.error("[Billing] Portal session creation failed:", error);
      if (error instanceof Stripe.errors.StripeError) {
        return c.json(errorResponse(`Stripe error: ${error.message}`), 400);
      }
      return c.json(errorResponse("Failed to create portal session"), 500);
    }
  }
);

// ============================================================================
// Webhook Handler (无需认证 - 使用 Stripe 签名验证)
// ============================================================================

// Webhook 专用路由 - 不使用 authMiddleware
export const webhookRoutes = new Hono<AuthBindings>();

// 订阅状态映射
type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

interface WebhookEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

/**
 * POST /api/billing/webhook - Stripe Webhook 处理
 *
 * 处理事件:
 * - checkout.session.completed: 首次订阅完成
 * - customer.subscription.updated: 订阅状态变更
 * - customer.subscription.deleted: 订阅取消/过期
 * - invoice.payment_failed: 支付失败
 */
webhookRoutes.post("/webhook", async (c) => {
  const env = c.env as unknown as WebhookEnv;

  const stripeSecretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!(stripeSecretKey && webhookSecret)) {
    console.error(
      "[Webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET"
    );
    return c.json({ error: "Webhook not configured" }, 503);
  }

  const stripe = createStripe(stripeSecretKey);
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    console.error("[Webhook] Missing stripe-signature header");
    return c.json({ error: "Missing signature" }, 400);
  }

  let event: Stripe.Event;

  try {
    // 获取原始 body 用于签名验证
    const rawBody = await c.req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook] Signature verification failed:", message);
    return c.json(
      { error: `Webhook signature verification failed: ${message}` },
      400
    );
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  const db = createDatabaseService(c);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          db,
          stripe
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          db
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          db
        );
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice, db);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true, eventId: event.id });
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    // 返回 200 以避免 Stripe 重试（错误已记录，可以手动处理）
    return c.json({
      received: true,
      eventId: event.id,
      error: "Processing failed",
    });
  }
});

/**
 * 处理 checkout.session.completed
 * 首次订阅完成时，关联 Stripe Customer ID 到用户
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  db: ReturnType<typeof createDatabaseService>,
  stripe: Stripe
): Promise<void> {
  const userId = session.client_reference_id || session.metadata?.userId;
  const customerId = session.customer as string;

  if (!userId) {
    console.error("[Webhook] checkout.session.completed: Missing userId");
    return;
  }

  if (!customerId) {
    console.error("[Webhook] checkout.session.completed: Missing customerId");
    return;
  }

  console.log(
    `[Webhook] Checkout completed: userId=${userId}, customerId=${customerId}`
  );

  // 关联 Stripe Customer ID 到用户
  await db.query(
    `INSERT INTO user_settings (user_id, stripe_customer_id)
     VALUES ($1::uuid, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = NOW()`,
    [userId, customerId]
  );

  // 获取订阅详情（如果需要存储更多信息）
  if (session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.product"],
    });

    console.log(
      `[Webhook] Subscription created: ${subscription.id}, status=${subscription.status}`
    );
  }
}

/**
 * 处理 customer.subscription.updated
 * 订阅状态变更（升级、降级、续费等）
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  db: ReturnType<typeof createDatabaseService>
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const status = subscription.status as SubscriptionStatus;

  // 获取周期日期（从 items.data[0] 获取，而非订阅根对象）
  const item = subscription.items.data[0];
  const itemAny = item as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart =
    itemAny.current_period_start || subscription.billing_cycle_anchor;
  const periodEnd =
    itemAny.current_period_end || subscription.billing_cycle_anchor;

  console.log(
    `[Webhook] Subscription updated: ${subscription.id}, status=${status}, ` +
      `period=${new Date(periodStart * 1000).toISOString()} - ${new Date(periodEnd * 1000).toISOString()}`
  );

  // 可选：存储订阅状态到数据库
  // 目前我们在查询时直接从 Stripe API 获取，所以这里只记录日志
  // 如果需要本地缓存订阅状态，可以在这里更新 user_settings 表

  // 检查是否有用户关联此 customer
  const userSettings = await db.queryOne<{ user_id: string }>(
    "SELECT user_id FROM user_settings WHERE stripe_customer_id = $1",
    [customerId]
  );

  if (!userSettings) {
    console.warn(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  console.log(
    `[Webhook] User ${userSettings.user_id} subscription updated to: ${status}`
  );
}

/**
 * 处理 customer.subscription.deleted
 * 订阅被取消或过期
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: ReturnType<typeof createDatabaseService>
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  console.log(
    `[Webhook] Subscription deleted: ${subscription.id}, customer=${customerId}`
  );

  // 查找关联用户
  const userSettings = await db.queryOne<{ user_id: string }>(
    "SELECT user_id FROM user_settings WHERE stripe_customer_id = $1",
    [customerId]
  );

  if (!userSettings) {
    console.warn(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  console.log(`[Webhook] User ${userSettings.user_id} subscription canceled`);

  // 可选：发送通知、更新用户状态等
  // 订阅取消后，用户仍保留 stripe_customer_id（便于未来重新订阅）
}

/**
 * 处理 invoice.payment_failed
 * 续费支付失败
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof createDatabaseService>
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) {
    console.error("[Webhook] invoice.payment_failed: Missing customerId");
    return;
  }

  // 在新版 Stripe API 中，subscription 字段可能被移除或类型变化
  const invoiceAny = invoice as unknown as {
    subscription?: string | { id: string };
  };
  const subscriptionId =
    typeof invoiceAny.subscription === "string"
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id;

  console.log(
    `[Webhook] Payment failed: invoice=${invoice.id}, subscription=${subscriptionId || "N/A"}, customer=${customerId}`
  );

  // 查找关联用户
  const userSettings = await db.queryOne<{ user_id: string }>(
    "SELECT user_id FROM user_settings WHERE stripe_customer_id = $1",
    [customerId]
  );

  if (!userSettings) {
    console.warn(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  console.log(
    `[Webhook] User ${userSettings.user_id} payment failed, attempt=${invoice.attempt_count}`
  );

  // 可选：发送邮件通知用户更新支付方式
  // Stripe 会自动重试，但可以主动提醒用户
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatSubscription(
  subscription: Stripe.Subscription,
  item: Stripe.SubscriptionItem
): SubscriptionInfo {
  const price = item.price;
  const productId =
    typeof price.product === "string" ? price.product : price.product.id;

  // Period dates are on subscription items in newer Stripe API
  // Fallback to billing_cycle_anchor if not available
  const itemAny = item as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
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

export default billingRoutes;
