import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import process from "node:process";
import console from "node:console";
const root = mkdtempSync(path.join(tmpdir(), "toolkit package "));
const npm = process.env.npm_execpath;
assert.ok(npm, "Run through npm run test:package");
const runNpm = (args, cwd) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd,
    encoding: "utf8",
  });
try {
  runNpm(["pack", "--pack-destination", root], process.cwd());
  const tarball = path.join(
    root,
    readdirSync(root).find((name) => name.endsWith(".tgz")),
  );
  const install = path.join(root, "install");
  mkdirSync(install);
  runNpm(
    ["install", "--prefix", install, tarball, "--no-audit", "--no-fund"],
    root,
  );
  const cli = path.join(
    install,
    "node_modules",
    "@manjunathhk",
    "image-toolkit",
    "dist",
    "cli.js",
  );
  assert.match(
    runNpm(
      [
        "exec",
        "--offline",
        "--prefix",
        install,
        "--",
        "image-toolkit",
        "--version",
      ],
      root,
    ),
    /0\.1\.0/,
  );
  const invoke = (args) => {
    try {
      return {
        code: 0,
        text: execFileSync(process.execPath, [cli, ...args], {
          cwd: root,
          encoding: "utf8",
          stdio: "pipe",
        }),
      };
    } catch (e) {
      return { code: e.status, text: String(e.stdout) + String(e.stderr) };
    }
  };
  assert.match(invoke(["--version"]).text, /0\.1\.0/);
  assert.equal(invoke(["--help"]).code, 0);
  assert.equal(invoke(["convert", "--quality", "bad"]).code, 2);
  assert.equal(invoke(["convert", "--unknown"]).code, 2);
  assert.equal(invoke(["convert", "missing"]).code, 2);
  const input = path.join(root, "images with spaces");
  mkdirSync(input);
  await sharp({
    create: { width: 32, height: 16, channels: 3, background: "red" },
  })
    .png()
    .toFile(path.join(input, "a.png"));
  assert.equal(invoke(["convert", input]).code, 0);
  assert.match(invoke(["convert", input]).text, /Output already exists/);
  writeFileSync(path.join(input, "bad.png"), "broken");
  assert.equal(invoke(["convert", input]).code, 1);
  console.log(
    "Packaged CLI: installation, invocation, conversion, skips and exit codes passed",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
