/**
 * Clerk OAuth Proxy for Cloudflare Pages
 *
 * Proxies all /_clerk/* requests to Clerk's Frontend API.
 * Required for OAuth callbacks (Google, GitHub, etc.) to work properly.
 *
 * @see https://clerk.com/docs/advanced-usage/using-proxies
 */

interface Env {
  CLERK_SECRET_KEY?: string;
}

// Clerk Frontend API endpoint - using verified CNAME domain
const CLERK_FAPI = "https://clerk.claud.ing";

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // Get the original URL and construct the proxy URL
    const originalUrl = new URL(request.url);
    const proxyUrl = `${originalUrl.origin}/_clerk`;

    // Replace the proxy path with Clerk FAPI
    const targetUrl = request.url.replace(proxyUrl, CLERK_FAPI);

    // Clone headers and add required Clerk proxy headers
    const headers = new Headers(request.headers);
    headers.set("Clerk-Proxy-Url", proxyUrl);
    headers.set(
      "X-Forwarded-For",
      request.headers.get("CF-Connecting-IP") || ""
    );

    // Add secret key if available
    if (env.CLERK_SECRET_KEY) {
      headers.set("Clerk-Secret-Key", env.CLERK_SECRET_KEY);
    }

    // Forward to Clerk
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
      redirect: "manual",
    });

    // Return the response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Clerk proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Proxy error", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
