import {
  readdir,
  stat,
  lstat,
  mkdir,
  writeFile,
  rename,
  link,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp, { type FitEnum, type FormatEnum } from "sharp";

// Do not retain file handles between jobs, especially when replacing files on Windows.
sharp.cache({ files: 0 });

export interface Options {
  format: string;
  quality: number;
  effort: number;
  fit: keyof FitEnum;
  width?: number;
  height?: number;
  output?: string;
  recursive?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
  maxSizeKb?: number;
  verbose?: boolean;
}
export const defaults: Options = {
  format: "webp",
  quality: 85,
  effort: 6,
  fit: "cover",
};
export function validate(o: Options): void {
  if (o.format !== "webp") throw new Error("Only webp output is supported");
  for (const [name, value, min, max] of [
    ["quality", o.quality, 1, 100],
    ["effort", o.effort, 0, 6],
    ["width", o.width, 1, 100000],
    ["height", o.height, 1, 100000],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < min || value > max)
    )
      throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  if (!["cover", "contain", "fill", "inside", "outside"].includes(o.fit))
    throw new Error("Invalid fit strategy");
  if (
    o.maxSizeKb !== undefined &&
    (!Number.isFinite(o.maxSizeKb) || o.maxSizeKb <= 0)
  )
    throw new Error("max-size-kb must be positive");
}
async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
export function supported(extension: string): boolean {
  const id = (
    {
      ".png": "png",
      ".jpg": "jpeg",
      ".jpeg": "jpeg",
      ".tif": "tiff",
      ".tiff": "tiff",
      ".avif": "heif",
    } as Record<string, keyof FormatEnum>
  )[extension.toLowerCase()];
  return !!id && !!sharp.format[id]?.input.file;
}
export async function discover(
  root: string,
  recursive: boolean,
  excluded?: string,
): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = path.join(dir, entry.name);
      if (file === excluded) continue;
      if (entry.isDirectory() && recursive) await walk(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  await walk(root);
  return files;
}
async function encode(file: string, o: Options): Promise<Buffer> {
  const render = (quality: number) => {
    let image = sharp(file, { failOn: "warning" }).autoOrient();
    if (o.width || o.height)
      image = image.resize({
        width: o.width,
        height: o.height,
        fit: o.fit,
        withoutEnlargement: true,
      });
    return image.webp({ quality, effort: o.effort }).toBuffer();
  };
  let result = await render(o.quality);
  if (!o.maxSizeKb || result.length <= o.maxSizeKb * 1024) return result;
  // At most seven further encodes, with a hard quality floor of 20.
  const floor = Math.min(20, o.quality);
  let low = floor,
    high = o.quality - 1;
  result = await render(floor);
  if (result.length > o.maxSizeKb * 1024)
    throw new Error(`Target size cannot be achieved at quality ${floor}`);
  for (let attempt = 0; attempt < 6 && low <= high; attempt++) {
    const quality = Math.floor((low + high) / 2),
      candidate = await render(quality);
    if (candidate.length <= o.maxSizeKb * 1024) {
      result = candidate;
      low = quality + 1;
    } else high = quality - 1;
  }
  return result;
}
export async function convert(
  directory: string,
  o: Options,
  log: (line: string) => void = console.log,
): Promise<number> {
  validate(o);
  const root = path.resolve(directory),
    output = path.resolve(o.output ?? root);
  if (!(await stat(root)).isDirectory())
    throw new Error("Input must be a directory");
  const started = performance.now();
  const files = await discover(
    root,
    !!o.recursive,
    output !== root && output.startsWith(root + path.sep) ? output : undefined,
  );
  let converted = 0,
    skipped = 0,
    failed = 0,
    original = 0,
    total = 0,
    cursor = 0;
  async function processFile(file: string): Promise<void> {
    const relative = path.relative(root, file),
      target = path.join(output, relative + ".webp");
    let temporary: string | undefined;
    try {
      if (!supported(path.extname(file))) {
        skipped++;
        log(`SKIP  ${relative} | Unsupported input format`);
        return;
      }
      if ((await exists(target)) && !o.overwrite) {
        skipped++;
        log(`SKIP  ${relative} | Output already exists`);
        return;
      }
      if (o.dryRun) {
        skipped++;
        log(`PLAN  ${relative} -> ${target}`);
        return;
      }
      const before = (await stat(file)).size,
        data = await encode(file, o);
      await mkdir(path.dirname(target), { recursive: true });
      temporary = path.join(path.dirname(target), `.${randomUUID()}.tmp`);
      await writeFile(temporary, data, { flag: "wx" });
      if (o.overwrite) await rename(temporary, target);
      else {
        await link(temporary, target);
        await unlink(temporary);
      }
      temporary = undefined;
      converted++;
      original += before;
      total += data.length;
      log(
        `DONE  ${relative} -> ${target} | ${before} B -> ${data.length} B | ${(100 * (1 - data.length / before)).toFixed(1)}% savings`,
      );
      if (o.verbose)
        log(`      quality ceiling=${o.quality}, effort=${o.effort}`);
    } catch (error) {
      if (!o.overwrite && (error as NodeJS.ErrnoException).code === "EEXIST") {
        skipped++;
        log(`SKIP  ${relative} | Output appeared during conversion`);
      } else {
        failed++;
        log(`FAIL  ${relative} | ${(error as Error).message}`);
      }
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (cursor < files.length) {
        const file = files[cursor++];
        if (file) await processFile(file);
      }
    }),
  );
  log(
    `========== SUMMARY ==========\nConverted : ${converted}\nSkipped   : ${skipped}\nFailed    : ${failed}\nOriginal  : ${original} B\nConverted : ${total} B\nSavings   : ${original ? (100 * (1 - total / original)).toFixed(1) : "0.0"}%\nDuration  : ${((performance.now() - started) / 1000).toFixed(2)} seconds`,
  );
  return failed ? 1 : 0;
}
