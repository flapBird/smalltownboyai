import { reconcile } from "./lib/jobs";
import type { Bindings } from "./lib/env";
export default {
  async scheduled(
    _event: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(reconcile(env));
  },
};
