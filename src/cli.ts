#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { readFile } from "node:fs/promises";
import { convert, defaults, type Options } from "./convert.js";

const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const program = new Command()
  .name("image-toolkit")
  .version(version)
  .description("Safe batch image conversion")
  .exitOverride();
program
  .command("convert")
  .argument("[directory]", "Input directory", ".")
  .description("Convert PNG, JPEG, TIFF and AVIF to WebP")
  .option("--format <format>", "Output format", defaults.format)
  .option("--quality <number>", "Quality 1-100", Number, defaults.quality)
  .option("--effort <number>", "WebP effort 0-6", Number, defaults.effort)
  .option("--width <pixels>", "Target width", Number)
  .option("--height <pixels>", "Target height", Number)
  .option(
    "--fit <strategy>",
    "cover, contain, fill, inside, outside",
    defaults.fit,
  )
  .option("--output <directory>", "Output directory")
  .option("--recursive", "Include subdirectories")
  .option("--overwrite", "Replace existing output")
  .option("--dry-run", "Preview without writes")
  .option("--max-size-kb <number>", "Maximum size in KiB", Number)
  .option("--verbose", "Detailed logging")
  .action(async (directory: string, options: Options) => {
    process.exitCode = await convert(directory, options);
  });
try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError)
    process.exitCode = error.exitCode === 0 ? 0 : 2;
  else {
    console.error((error as Error).message);
    process.exitCode = 2;
  }
}
