import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const [, , recordPath] = process.argv;
assert.ok(recordPath, "launch acceptance record path is required");
const [schema, record] = await Promise.all([
  readFile(new URL("../../schemas/launch-acceptance-record.schema.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(recordPath, "utf8").then(JSON.parse)
]);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
assert.equal(validate(record), true, ajv.errorsText(validate.errors));
process.stdout.write(`${recordPath}: valid launch acceptance record\n`);
