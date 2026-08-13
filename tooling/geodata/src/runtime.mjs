import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../.."
);

export function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalise(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalise(value), null, 2)}\n`;
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeCanonical(file, value, options = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, canonicalJson(value), {
    encoding: "utf8",
    flag: options.exclusive ? "wx" : "w"
  });
}

export async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function describeFile(id, file, root) {
  const details = await stat(file);
  if (!details.isFile() || details.size < 1) {
    throw new Error(`${id}: expected a non-empty regular file at ${file}`);
  }
  return {
    id,
    path: path.relative(root, file).split(path.sep).join("/"),
    bytes: details.size,
    sha256: await sha256File(file)
  };
}

export function resolveInside(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new Error(`Path must be a non-empty relative path: ${String(relativePath)}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes its release workspace: ${relativePath}`);
  }
  return resolved;
}

const schemaFiles = {
  registry: "schemas/source-registry.schema.json",
  recipe: "schemas/publication-recipe.schema.json",
  acquisition: "schemas/acquisition-manifest.schema.json",
  lineage: "schemas/build-lineage-manifest.schema.json",
  release: "schemas/release-manifest.schema.json",
  current: "schemas/current-release.schema.json"
};

let validatorsPromise;

async function loadValidators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const entries = await Promise.all(
    Object.entries(schemaFiles).map(async ([name, relative]) => [
      name,
      ajv.compile(await readJson(path.join(repositoryRoot, relative)))
    ])
  );
  return { ajv, validators: new Map(entries) };
}

export async function validateDocument(kind, document, label = kind) {
  validatorsPromise ??= loadValidators();
  const { ajv, validators } = await validatorsPromise;
  const validate = validators.get(kind);
  if (!validate) throw new Error(`Unknown contract type: ${kind}`);
  if (!validate(document)) {
    throw new Error(`${label}: ${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  }
  return document;
}

export function uniqueBy(items, key, label) {
  const values = new Set();
  for (const item of items) {
    const value = item[key];
    if (values.has(value)) throw new Error(`${label} contains duplicate ${key}: ${value}`);
    values.add(value);
  }
  return values;
}

export function isoNow(clock = () => new Date()) {
  return clock().toISOString();
}
