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
  "packages/shared/package.json",
];

const userVisiblePrefixes = [
  "apps/web/src/App.vue",
  "apps/web/src/styles.css",
  "apps/web/src/views/",
  "apps/web/src/components/",
];

const releaseHistoryPath = "docs/release-history.json";

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

const releaseHistoryExists = fs.existsSync(path.join(repoRoot, releaseHistoryPath));
if (!releaseHistoryExists) {
  errors.push(`Arquivo ausente: ${releaseHistoryPath}`);
} else {
  const history = readJson(releaseHistoryPath);
  if (currentVersion && history.currentVersion !== currentVersion) {
    errors.push(
      `${releaseHistoryPath} currentVersion=${history.currentVersion} difere dos package.json (${currentVersion}).`,
    );
  }
  const firstEntry = Array.isArray(history.entries) ? history.entries[0] : null;
  if (currentVersion && firstEntry?.version !== currentVersion) {
    errors.push(
      `A primeira entrada de ${releaseHistoryPath} deve ser a versão atual (${currentVersion}). Encontrado: ${firstEntry?.version ?? "nenhuma"}.`,
    );
  }
}

if (userVisibleChanged) {
  if (!changedFiles.includes(releaseHistoryPath)) {
    errors.push(`Mudança visível ao usuário sem atualização de ${releaseHistoryPath}.`);
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
}

if (errors.length > 0) {
  console.error("release:check falhou:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("release:check ok");
