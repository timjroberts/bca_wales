import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WranglerR2Store } from "../geodata/src/r2.mjs";

export class R2ObjectStore {
  constructor(options) {
    this.store = new WranglerR2Store(options);
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
