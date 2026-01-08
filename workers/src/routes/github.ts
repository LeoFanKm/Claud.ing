/**
 * @file github.ts
 * @description GitHub App Webhook and API routes
 */

import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../index";
import {
  createGitHubAppService,
  GitHubAppError,
  type InstallationEvent,
  type PullRequestEvent,
  type PushEvent,
  verifyWebhookSignature,
} from "../services/github";

type AppContext = Context<{ Bindings: Bindings }>;
const githubRoutes = new Hono<{ Bindings: Bindings }>();

githubRoutes.post("/webhook", async (c) => {
  if (!c.env.GITHUB_WEBHOOK_SECRET) {
    return c.json({ error: "Webhook not configured" }, 500);
  }
  const signature = c.req.header("X-Hub-Signature-256");
  if (!signature) return c.json({ error: "Missing signature" }, 401);
  const eventType = c.req.header("X-GitHub-Event");
  if (!eventType) return c.json({ error: "Missing event type" }, 400);
  const rawBody = await c.req.text();
  const isValid = await verifyWebhookSignature(
    c.env.GITHUB_WEBHOOK_SECRET,
    signature,
    rawBody
  );
  if (!isValid) return c.json({ error: "Invalid signature" }, 401);
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  try {
    switch (eventType) {
      case "ping":
        return c.json({ message: "pong" });
      case "pull_request":
        return await handlePullRequestEvent(c, payload as PullRequestEvent);
      case "installation":
        return await handleInstallationEvent(c, payload as InstallationEvent);
      case "push":
        return await handlePushEvent(c, payload as PushEvent);
      default:
        return c.json({ message: "Event received" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

async function handlePullRequestEvent(c: AppContext, event: PullRequestEvent) {
  const { action, pull_request, repository, installation } = event;
  if (!installation) return c.json({ error: "Missing installation" }, 400);
  return c.json({
    message: "PR event processed",
    action,
    pr: pull_request.number,
    repo: repository.full_name,
  });
}

async function handleInstallationEvent(
  c: AppContext,
  event: InstallationEvent
) {
  const { action, installation } = event;
  if (!installation) return c.json({ error: "Missing installation" }, 400);
  return c.json({
    message: "Installation event processed",
    action,
    account: installation.account.login,
  });
}

async function handlePushEvent(c: AppContext, event: PushEvent) {
  const { ref, commits, repository, installation } = event;
  if (!installation) return c.json({ error: "Missing installation" }, 400);
  return c.json({
    message: "Push event processed",
    ref,
    repo: repository.full_name,
    commits: commits.length,
  });
}

githubRoutes.get("/installations", async (c) => c.json({ installations: [] }));

githubRoutes.get("/installations/:installationId/repos", async (c) => {
  const installationId = Number.parseInt(c.req.param("installationId"), 10);
  if (isNaN(installationId)) return c.json({ error: "Invalid ID" }, 400);
  try {
    const github = createGitHubAppService(c);
    const repos = await github.listInstallationRepos(installationId);
    return c.json({ repositories: repos });
  } catch (error) {
    if (error instanceof GitHubAppError) {
      return c.json(
        { error: error.message },
        (error.status || 500) as 400 | 500
      );
    }
    return c.json({ error: "Unknown error" }, 500);
  }
});

githubRoutes.get("/repos/:owner/:repo/pulls/:prNumber", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const prNumber = Number.parseInt(c.req.param("prNumber"), 10);
  const installationId = Number.parseInt(
    c.req.query("installation_id") || "",
    10
  );
  if (!(owner && repo) || isNaN(prNumber) || isNaN(installationId)) {
    return c.json({ error: "Invalid parameters" }, 400);
  }
  try {
    const github = createGitHubAppService(c);
    const pr = await github.getPrDetails(installationId, owner, repo, prNumber);
    return c.json(pr);
  } catch (error) {
    if (error instanceof GitHubAppError) {
      return c.json(
        { error: error.message },
        (error.status || 500) as 400 | 500
      );
    }
    return c.json({ error: "Unknown error" }, 500);
  }
});

const commentSchema = z.object({
  body: z.string().min(1),
  installation_id: z.number(),
});

githubRoutes.post("/repos/:owner/:repo/pulls/:prNumber/comments", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const prNumber = Number.parseInt(c.req.param("prNumber"), 10);
  if (!(owner && repo) || isNaN(prNumber))
    return c.json({ error: "Invalid params" }, 400);
  let body: z.infer<typeof commentSchema>;
  try {
    body = commentSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Invalid body" }, 400);
  }
  try {
    const github = createGitHubAppService(c);
    await github.postPrComment(
      body.installation_id,
      owner,
      repo,
      prNumber,
      body.body
    );
    return c.json({ message: "Comment posted" });
  } catch (error) {
    if (error instanceof GitHubAppError) {
      return c.json(
        { error: error.message },
        (error.status || 500) as 400 | 500
      );
    }
    return c.json({ error: "Unknown error" }, 500);
  }
});

const createPrSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional().default(""),
  head: z.string().min(1),
  base: z.string().min(1),
  installation_id: z.number(),
});

githubRoutes.post("/repos/:owner/:repo/pulls", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  if (!(owner && repo)) return c.json({ error: "Invalid params" }, 400);
  let body: z.infer<typeof createPrSchema>;
  try {
    body = createPrSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Invalid body" }, 400);
  }
  try {
    const github = createGitHubAppService(c);
    const pr = await github.createPr(
      body.installation_id,
      owner,
      repo,
      body.title,
      body.body,
      body.head,
      body.base
    );
    return c.json(pr, 201);
  } catch (error) {
    if (error instanceof GitHubAppError) {
      return c.json(
        { error: error.message },
        (error.status || 500) as 400 | 500
      );
    }
    return c.json({ error: "Unknown error" }, 500);
  }
});

githubRoutes.get("/install-url", (c) => {
  if (!c.env.GITHUB_APP_SLUG) return c.json({ error: "Not configured" }, 500);
  return c.json({
    url:
      "https://github.com/apps/" + c.env.GITHUB_APP_SLUG + "/installations/new",
  });
});

export default githubRoutes;
