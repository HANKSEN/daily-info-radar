import test from "node:test";
import assert from "node:assert/strict";

import { collectSourceItemsWithHealth } from "../src/collectors/index.ts";

test("source collection preserves failures without blocking healthy sources", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;

  try {
    const result = await collectSourceItemsWithHealth([
      {
        id: "v2ex-hot",
        name: "V2EX 热门",
        kind: "api",
        url: "https://www.v2ex.com/api/topics/hot.json",
      },
      {
        id: "optional-empty-api",
        name: "Optional empty API",
        kind: "api",
        url: "https://example.com/unused",
      },
    ]);

    assert.equal(result.health.configured, 2);
    assert.equal(result.health.succeeded, 1);
    assert.equal(result.health.failed, 1);
    assert.equal(result.health.failures[0]?.sourceId, "v2ex-hot");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
