import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { S3R2Store, WranglerR2Store } from "../geodata/src/r2.mjs";

export class R2ObjectStore {
  constructor({ env = process.env, ...options }) {
    const values = [
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ];
    if (values.some(Boolean) && !values.every(Boolean)) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY must be set together");
    }
    this.store = values.every(Boolean)
      ? new S3R2Store({
        ...options,
        accountId: values[0],
        accessKeyId: values[1],
        secretAccessKey: values[2]
      })
      : new WranglerR2Store({ ...options, env });
  }

  async get(key) {
    const directory = await mkdtemp(path.join(tmpdir(), "bca-firms-get-"));
    const destination = path.join(directory, "object");
    try {
      if (!await this.store.getOptional(key, destination)) return null;
      return await readFile(destination);
    } finally {
      await rm(directory, { recursive: true });
    }
  }

  async put(key, bytes, contentType) {
    const directory = await mkdtemp(path.join(tmpdir(), "bca-firms-put-"));
    const source = path.join(directory, "object");
    try {
      await writeFile(source, bytes, { flag: "wx" });
      await this.store.putFile(key, source, contentType);
    } finally {
      await rm(directory, { recursive: true });
    }
  }
}
