/**
 * load-op-env — Load secrets from a 1Password Environment.
 *
 * Reads all variables from the specified 1Password Environment ID,
 * then exports them as:
 *   1. Masked values in the log (::add-mask::)
 *   2. GITHUB_ENV entries (available to all subsequent steps)
 *   3. A JSON output named "variables" (for step-output consumption)
 */

import { createClient } from "@1password/sdk";
import { appendFileSync, writeFileSync } from "node:fs";

const token = process.env.OP_SERVICE_ACCOUNT_TOKEN;
const environmentId = process.env.OP_ENVIRONMENT_ID;
const exportEnv = process.env.INPUT_EXPORT_ENV !== "false";
const maskValues = process.env.INPUT_MASK_VALUES !== "false";

if (!token) {
  console.error("::error::OP_SERVICE_ACCOUNT_TOKEN is required");
  process.exit(1);
}
if (!environmentId) {
  console.error("::error::OP_ENVIRONMENT_ID is required");
  process.exit(1);
}

const client = await createClient({
  auth: token,
  integrationName: "load-op-env-action",
  integrationVersion: "v1.0.0",
});

const response = await client.environments.getVariables(environmentId);

if (!response.variables || response.variables.length === 0) {
  console.log("::warning::No variables found in environment " + environmentId);
  process.exit(0);
}

const envFile = process.env.GITHUB_ENV;
const outputFile = process.env.GITHUB_OUTPUT;
const result = {};

for (const { name, value, masked } of response.variables) {
  // Mask sensitive values in logs
  if (maskValues && (masked || value.length > 0)) {
    console.log(`::add-mask::${value}`);
  }

  // Export to GITHUB_ENV
  if (exportEnv && envFile) {
    // Use delimiter syntax to handle multiline values safely
    const delimiter = `ghadelim_${name}_${Date.now()}`;
    appendFileSync(envFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
  }

  result[name] = value;
  console.log(`Loaded: ${name} (${masked ? "masked" : "visible"})`);
}

// Set JSON output
if (outputFile) {
  const json = JSON.stringify(result);
  const delimiter = `ghadelim_variables_${Date.now()}`;
  appendFileSync(
    outputFile,
    `variables<<${delimiter}\n${json}\n${delimiter}\n`
  );
}

console.log(`Loaded ${response.variables.length} variables from 1Password Environment`);
