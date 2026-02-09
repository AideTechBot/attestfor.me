#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Try to get app URL from environment, or prompt user
let tunnelUrl = process.env.APP_URL;

if (!tunnelUrl) {
  // Check if a URL was passed as command line argument
  tunnelUrl = process.argv[2];

  if (!tunnelUrl) {
    console.error("Error: No tunnel URL provided");
    console.error("");
    console.error("Usage:");
    console.error("  pnpm update-oauth-url <tunnel-url>");
    console.error("");
    console.error("Example:");
    console.error("  pnpm update-oauth-url https://your-tunnel.devtunnels.ms");
    process.exit(1);
  }
}

// Validate URL format
try {
  new URL(tunnelUrl);
} catch {
  console.error(`Error: Invalid URL format: ${tunnelUrl}`);
  process.exit(1);
}

const metadataPath = join(
  process.cwd(),
  "public",
  "oauth",
  "client-metadata.json",
);
const envPath = join(process.cwd(), ".env");

// Read the current metadata
interface OAuthClientMetadata {
  client_id: string;
  client_uri: string;
  redirect_uris: string[];
}
let metadata: OAuthClientMetadata;
try {
  const content = readFileSync(metadataPath, "utf-8");
  metadata = JSON.parse(content);
} catch (error) {
  console.error(`Error reading ${metadataPath}:`, error);
  process.exit(1);
}

// Update the URLs
const newMetadataUrl = `${tunnelUrl}/oauth/client-metadata.json`;
const newCallbackUrl = `${tunnelUrl}/api/auth/callback`;

metadata.client_id = newMetadataUrl;
metadata.client_uri = tunnelUrl;
metadata.redirect_uris = [newCallbackUrl];

// Write back to file
try {
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log("✓ Updated OAuth client metadata:");
  console.log(`  client_id: ${newMetadataUrl}`);
  console.log(`  client_uri: ${tunnelUrl}`);
  console.log(`  redirect_uris: ${newCallbackUrl}`);
} catch (error) {
  console.error(`Error writing ${metadataPath}:`, error);
  process.exit(1);
}

// Update .env file
try {
  let envContent = "";
  try {
    envContent = readFileSync(envPath, "utf-8");
  } catch {
    // .env doesn't exist, create it
  }

  // Update or add APP_URL
  const lines = envContent.split("\n");
  let found = false;
  const newLines = lines.map((line) => {
    if (line.startsWith("APP_URL=")) {
      found = true;
      return `APP_URL=${tunnelUrl}`;
    }
    return line;
  });

  if (!found) {
    newLines.unshift(`APP_URL=${tunnelUrl}`);
  }

  writeFileSync(envPath, newLines.join("\n"));
  console.log("\n✓ Updated .env file:");
  console.log(`  APP_URL=${tunnelUrl}`);
} catch (error) {
  console.error(`Error updating ${envPath}:`, error);
  process.exit(1);
}
