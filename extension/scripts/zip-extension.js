const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

const extensionDir = path.join(__dirname, "..");
const distDir = path.join(extensionDir, "dist");
const zipPath = path.join(extensionDir, "frontify-template-checker-extension.zip");

if (!fs.existsSync(distDir)) {
  console.error("dist/ not found. Run npm run build first.");
  process.exit(1);
}

// Remove existing zip so we don't get a prompt about overwriting
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

execSync(`zip -r "${zipPath}" .`, { cwd: distDir, stdio: "inherit" });
console.log("\n✓ Created:", zipPath);
