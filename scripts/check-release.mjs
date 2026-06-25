import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const stagedOnly = args.has("--staged");

const versionFiles = [
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/electron/package.json",
  "packages/shared/package.json",
];

const userVisiblePrefixes = [
  "apps/web/src/App.vue",
  "apps/web/src/styles.css",
  "apps/web/src/views/",
  "apps/web/src/components/",
];

const aboutViewPath = "apps/web/src/views/AboutView.vue";

function git(argsList) {
  return execFileSync("git", argsList, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function getChangedFiles() {
  const diffArgs = stagedOnly
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    : ["diff", "--name-only", "HEAD", "--diff-filter=ACMR"];

  const output = git(diffArgs);
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean);
}

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readHeadFile(relativePath) {
  try {
    return git(["show", `HEAD:${relativePath}`]);
  } catch {
    return null;
  }
}

function firstBuildEntry(content) {
  const match = content.match(/build:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

const changedFiles = getChangedFiles();
const userVisibleChanged = changedFiles.some((file) =>
  userVisiblePrefixes.some((prefix) => file.startsWith(prefix)),
);

const versions = versionFiles.map((file) => ({
  file,
  version: readJson(file).version,
}));

const distinctVersions = [...new Set(versions.map((item) => item.version))];
const currentVersion = distinctVersions[0] ?? null;

const errors = [];

if (distinctVersions.length > 1) {
  errors.push(
    `Versões desalinhadas: ${versions.map((item) => `${item.file}=${item.version}`).join(", ")}`,
  );
}

if (userVisibleChanged) {
  if (!changedFiles.includes(aboutViewPath)) {
    errors.push("Mudança visível ao usuário sem atualização de apps/web/src/views/AboutView.vue.");
  }

  const previousRoot = readHeadFile("package.json");
  if (previousRoot) {
    const previousVersion = JSON.parse(previousRoot).version;
    if (currentVersion === previousVersion) {
      errors.push(
        `Mudança visível ao usuário sem bump de versão. Versão atual ainda está em ${currentVersion}.`,
      );
    }
  }

  const aboutContent = fs.readFileSync(path.join(repoRoot, aboutViewPath), "utf8");
  const firstAboutBuild = firstBuildEntry(aboutContent);
  if (currentVersion && firstAboutBuild !== currentVersion) {
    errors.push(
      `A primeira entrada do AboutView.vue deve apontar para a versão atual (${currentVersion}). Encontrado: ${firstAboutBuild ?? "nenhuma"}.`,
    );
  }
}

if (errors.length > 0) {
  console.error("release:check falhou:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("release:check ok");
