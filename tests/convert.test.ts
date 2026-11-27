import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

sharp.cache({ files: 0 });
import { convert, defaults, validate, supported } from "../src/convert.js";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "image toolkit "));
  roots.push(root);
  const input = path.join(root, "input");
  await mkdir(input);
  await sharp({
    create: {
      width: 80,
      height: 40,
      channels: 4,
      background: { r: 200, g: 0, b: 20, alpha: 0.4 },
    },
  })
    .png()
    .toFile(path.join(input, "photo.png"));
  return { root, input, file: path.join(input, "photo.png") };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const quiet = () => {};
describe("validation", () => {
  it.each([
    { quality: 0 },
    { quality: 101 },
    { width: 0 },
    { height: 1.2 },
    { effort: 7 },
    { maxSizeKb: Infinity },
    { format: "png" },
    { fit: "bad" },
  ])("rejects %j", (invalid) => {
    expect(() =>
      validate({ ...defaults, ...invalid } as typeof defaults),
    ).toThrow();
  });
  it("checks runtime codec support", () => {
    expect(supported(".PNG")).toBe(true);
    expect(supported(".gif")).toBe(false);
    expect(supported(".webp")).toBe(false);
  });
});
describe("conversion", () => {
  it("preserves source, alpha and aspect ratio; skips then overwrites", async () => {
    const { input, file } = await fixture(),
      source = await readFile(file);
    expect(await convert(input, { ...defaults, width: 40 }, quiet)).toBe(0);
    const target = file + ".webp",
      initial = await readFile(target),
      meta = await sharp(initial).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([40, 20, true]);
    await convert(input, { ...defaults, width: 20 }, quiet);
    expect(await readFile(target)).toEqual(initial);
    await convert(input, { ...defaults, overwrite: true, width: 20 }, quiet);
    expect((await sharp(target).metadata()).width).toBe(20);
    expect(await readFile(file)).toEqual(source);
  });
  it("does not upscale and strips EXIF while respecting orientation", async () => {
    const { input, file } = await fixture();
    await sharp({
      create: { width: 80, height: 40, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(path.join(input, "rotated.jpg"));
    await convert(input, { ...defaults, width: 1000 }, quiet);
    expect((await sharp(file + ".webp").metadata()).width).toBe(80);
    const meta = await sharp(path.join(input, "rotated.jpg.webp")).metadata();
    expect([meta.width, meta.height, meta.exif]).toEqual([40, 80, undefined]);
  });
  it("handles recursive output, collisions, spaces and excludes nested output", async () => {
    const { input, file } = await fixture();
    await mkdir(path.join(input, "sub dir"));
    await sharp(file).jpeg().toFile(path.join(input, "photo.jpg"));
    await sharp(file)
      .tiff()
      .toFile(path.join(input, "sub dir", "photo.tif"));
    await sharp(file).avif().toFile(path.join(input, "sample.avif"));
    const output = path.join(input, "output");
    await convert(input, { ...defaults, output, recursive: true }, quiet);
    expect(await readdir(output)).toEqual(
      expect.arrayContaining([
        "photo.png.webp",
        "photo.jpg.webp",
        "sample.avif.webp",
        "sub dir",
      ]),
    );
    expect(
      (await sharp(path.join(output, "sub dir", "photo.tif.webp")).metadata())
        .format,
    ).toBe("webp");
    await convert(input, { ...defaults, output, recursive: true }, quiet);
    expect(await readdir(output)).not.toContain("output");
  });
  it("dry run creates nothing and nonrecursive leaves subdirectories alone", async () => {
    const { root, input } = await fixture();
    const output = path.join(root, "absent");
    await convert(input, { ...defaults, output, dryRun: true }, quiet);
    expect(await readdir(root)).not.toContain("absent");
    await mkdir(path.join(input, "nested"));
    await writeFile(path.join(input, "nested", "bad.png"), "bad");
    expect(await convert(input, defaults, quiet)).toBe(0);
  });
  it("continues on corrupt inputs and skips unsupported inputs", async () => {
    const { input, file } = await fixture();
    await writeFile(path.join(input, "bad.png"), "bad");
    await writeFile(path.join(input, "note.txt"), "text");
    const logs: string[] = [];
    expect(await convert(input, defaults, (s) => logs.push(s))).toBe(1);
    expect(await readFile(file + ".webp")).toBeTruthy();
    expect(logs.join("\n")).toContain("Unsupported input format");
    expect((await readdir(input)).some((f) => f.endsWith(".tmp"))).toBe(false);
  });
  it("achieves feasible size and reports impossible target without replacing output", async () => {
    const { input, file } = await fixture();
    await convert(input, { ...defaults, maxSizeKb: 1 }, quiet);
    const before = await readFile(file + ".webp");
    expect(before.length).toBeLessThanOrEqual(1024);
    const logs: string[] = [];
    expect(
      await convert(
        input,
        { ...defaults, overwrite: true, maxSizeKb: 0.001 },
        (line) => logs.push(line),
      ),
    ).toBe(1);
    expect(logs.join("\n")).toContain("Target size cannot be achieved");
    expect(await readFile(file + ".webp")).toEqual(before);
  });
});
