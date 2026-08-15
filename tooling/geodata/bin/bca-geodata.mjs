#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";
import {
  acquireRelease,
  buildRelease,
  loadContracts,
  reproduceRelease,
  reuseAcquisition,
  verifyArchive
} from "../src/pipeline.mjs";
import {
  publishRelease,
  restoreCurrentPointer,
  S3R2Store,
  stageRelease,
  withdrawRelease,
  WranglerR2Store
} from "../src/r2.mjs";
import { readJson } from "../src/runtime.mjs";

const execFileAsync = promisify(execFile);

const help = `BCA immutable geodata publication toolchain

Usage:
  bca-geodata validate --registry FILE --recipe FILE
  bca-geodata acquire --registry FILE --recipe FILE --workspace DIR [--commit SHA] [--allow-network]
  bca-geodata reuse-acquisition --archive DIR --registry FILE --recipe FILE --workspace DIR [--commit SHA]
  bca-geodata build --release-root DIR
  bca-geodata reproduce --archive DIR --workspace DIR
  bca-geodata verify-archive --release-root DIR
  bca-geodata stage --release-root DIR --bucket NAME --identity LOGIN [--jurisdiction eu|fedramp]
  bca-geodata publish --release-root DIR --bucket NAME --identity LOGIN [--jurisdiction eu|fedramp] [--mode manual|automatic]
  bca-geodata restore-pointer --bucket NAME --release-id ID --manifest-sha256 SHA --identity LOGIN [--jurisdiction eu|fedramp] [--asset-origin URL]
  bca-geodata withdraw --release-root DIR --bucket NAME --release-id ID --identity LOGIN --reason TEXT [--jurisdiction eu|fedramp] [--replacement FILE]

Acquisition never uses the network unless --allow-network is present. Build
steps run shell-free inside the pinned, network-disabled geodata container.
Publishing uploads and verifies immutable assets before replacing current.json.
`;

function parse(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === "allow-network") options[key] = true;
    else {
      const value = tokens[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a value`);
      options[key] = value;
      index += 1;
    }
  }
  return { command, options };
}

function required(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.length === 0) throw new Error(`--${name} is required`);
  return value;
}

function absolute(value) {
  return path.resolve(process.cwd(), value);
}

function r2Store(options) {
  const bucket = required(options, "bucket");
  const jurisdiction = options.jurisdiction ?? null;
  const s3Values = [
    process.env.CLOUDFLARE_ACCOUNT_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  ];
  if (s3Values.some(Boolean)) {
    if (!s3Values.every(Boolean)) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY must be set together");
    }
    return new S3R2Store({
      bucket,
      jurisdiction,
      accountId: s3Values[0],
      accessKeyId: s3Values[1],
      secretAccessKey: s3Values[2]
    });
  }
  return new WranglerR2Store({ bucket, jurisdiction });
}

async function gitCommit() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: process.cwd() });
  return stdout.trim();
}

async function main() {
  if (process.argv.includes("--help") || process.argv.length < 3) {
    process.stdout.write(help);
    return;
  }
  const { command, options } = parse(process.argv.slice(2));
  let result;

  if (command === "validate") {
    const contracts = await loadContracts({
      registryPath: absolute(required(options, "registry")),
      recipePath: absolute(required(options, "recipe"))
    });
    result = {
      registry_id: contracts.registry.registry_id,
      recipe_id: contracts.recipe.recipe_id,
      release_id: contracts.recipe.release_id,
      valid: true
    };
  } else if (command === "acquire") {
    result = await acquireRelease({
      registryPath: absolute(required(options, "registry")),
      recipePath: absolute(required(options, "recipe")),
      workspaceRoot: absolute(required(options, "workspace")),
      codeCommit: options.commit ?? await gitCommit(),
      allowNetwork: options["allow-network"] === true
    });
    result = { release_root: result.releaseRoot, inputs: result.manifest.inputs.length };
  } else if (command === "reuse-acquisition") {
    result = await reuseAcquisition({
      archiveRoot: absolute(required(options, "archive")),
      registryPath: absolute(required(options, "registry")),
      recipePath: absolute(required(options, "recipe")),
      workspaceRoot: absolute(required(options, "workspace")),
      codeCommit: options.commit ?? await gitCommit()
    });
    result = { release_root: result.releaseRoot, inputs: result.manifest.inputs.length };
  } else if (command === "build") {
    const built = await buildRelease({ releaseRoot: absolute(required(options, "release-root")) });
    result = {
      release_id: built.candidate.release_id,
      gate: built.qa.result,
      hard_failures: built.qa.hard_failures.length,
      warnings: built.qa.warnings.length
    };
    if (built.qa.result === "fail") process.exitCode = 2;
  } else if (command === "reproduce") {
    const reproduced = await reproduceRelease({
      archiveRoot: absolute(required(options, "archive")),
      workspaceRoot: absolute(required(options, "workspace"))
    });
    result = { release_root: reproduced.releaseRoot, verified_outputs: reproduced.outputs.length };
  } else if (command === "verify-archive") {
    result = await verifyArchive(absolute(required(options, "release-root")));
  } else if (command === "stage") {
    const store = r2Store(options);
    const staged = await stageRelease({
      releaseRoot: absolute(required(options, "release-root")),
      store,
      identity: required(options, "identity")
    });
    result = { release_id: staged.release.release_id, uploads: staged.uploads };
  } else if (command === "publish") {
    const store = r2Store(options);
    const published = await publishRelease({
      releaseRoot: absolute(required(options, "release-root")),
      store,
      identity: required(options, "identity"),
      mode: options.mode ?? "manual"
    });
    result = { release_id: published.release.release_id, current: published.pointer, uploads: published.uploads };
  } else if (command === "withdraw") {
    const replacement = options.replacement ? await readJson(absolute(options.replacement)) : null;
    const store = r2Store(options);
    const withdrawn = await withdrawRelease({
      releaseRoot: absolute(required(options, "release-root")),
      store,
      expectedReleaseId: required(options, "release-id"),
      identity: required(options, "identity"),
      reason: required(options, "reason"),
      replacement
    });
    result = { release_id: withdrawn.record.release_id, current: withdrawn.pointer };
  } else if (command === "restore-pointer") {
    const store = r2Store(options);
    const restored = await restoreCurrentPointer({
      store,
      releaseId: required(options, "release-id"),
      expectedManifestSha256: required(options, "manifest-sha256"),
      identity: required(options, "identity"),
      publicAssetOrigin: options["asset-origin"] ?? "https://assets.bca.wales"
    });
    result = {
      release_id: restored.release.release_id,
      current: restored.pointer,
      verified_assets: restored.verifiedAssets
    };
  } else {
    throw new Error(`Unknown command: ${command}\n\n${help}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`bca-geodata: ${error.message}\n`);
  process.exitCode = 1;
});
