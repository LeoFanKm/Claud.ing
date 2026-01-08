import * as __MIDDLEWARE_0__ from "D:\\Project_Vibe_Coding\\claud.ing\\node_modules\\.pnpm\\wrangler@4.56.0_@cloudflare+workers-types@4.20260101.0\\node_modules\\wrangler\\templates\\middleware\\middleware-ensure-req-body-drained.ts";
import * as __MIDDLEWARE_1__ from "D:\\Project_Vibe_Coding\\claud.ing\\node_modules\\.pnpm\\wrangler@4.56.0_@cloudflare+workers-types@4.20260101.0\\node_modules\\wrangler\\templates\\middleware\\middleware-miniflare3-json-error.ts";
import worker from "D:\\Project_Vibe_Coding\\claud.ing\\workers\\src\\index.ts";

export * from "D:\\Project_Vibe_Coding\\claud.ing\\workers\\src\\index.ts";

const MIDDLEWARE_TEST_INJECT = "__INJECT_FOR_TESTING_WRANGLER_MIDDLEWARE__";
export const __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  __MIDDLEWARE_0__.default,
  __MIDDLEWARE_1__.default,
];
export default worker;
