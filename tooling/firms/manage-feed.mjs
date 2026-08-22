#!/usr/bin/env node

import { restoreOperationalFeed, withdrawOperationalFeed } from "./operational-feed.mjs";
import { R2ObjectStore } from "./r2-object-store.mjs";

function options(argv) {
  const [operation, ...rest] = argv.slice(2);
  const parsed = { operation, bucket: "bca-wales-public-releases", jurisdiction: "eu" };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid option: ${key ?? ""}`);
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

async function main() {
  const args = options(process.argv);
  const store = new R2ObjectStore({ bucket: args.bucket, jurisdiction: args.jurisdiction });
  if (args.operation === "withdraw") {
    const result = await withdrawOperationalFeed({ store, reason: args.reason });
    process.stdout.write(`${JSON.stringify(result.pointer, null, 2)}\n`);
    return;
  }
  if (args.operation === "restore") {
    if (!args.withdrawal) throw new Error("--withdrawal is required");
    const pointer = await restoreOperationalFeed({ store, withdrawalKey: args.withdrawal });
    process.stdout.write(`${JSON.stringify(pointer, null, 2)}\n`);
    return;
  }
  throw new Error("Operation must be withdraw or restore");
}

main().catch((error) => {
  process.stderr.write(`FIRMS feed management failed: ${error.message}\n`);
  process.exitCode = 1;
});
