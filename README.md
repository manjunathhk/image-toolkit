# Image Toolkit

Generic, cross-platform image conversion CLI built with Sharp. Requires Node.js 24 or later. Version 0.1.0 supports WebP output only.

## Install

```sh
# After publication
npm install -g @manjunathhk/image-toolkit
npx @manjunathhk/image-toolkit convert ./images
# Local development
npm ci
npm run build
npm link
image-toolkit convert
```

The installed executable works from any directory. This repository does not automatically publish packages.

## Usage

```sh
image-toolkit convert [directory] [options]
image-toolkit convert "D:\Images\My Photos" --recursive
image-toolkit convert ./images --width 1200 --height 630 --quality 85
image-toolkit convert ./images --output ./optimized --recursive
image-toolkit convert ./images --max-size-kb 250
image-toolkit convert ./images --recursive --dry-run
image-toolkit convert ./images --overwrite
```

| Argument or option | Default           | Behaviour                                                      |
| ------------------ | ----------------- | -------------------------------------------------------------- |
| directory          | Current directory | Input directory, not an individual file                        |
| --format           | webp              | Only WebP is accepted                                          |
| --quality          | 85                | Integer 1–100                                                  |
| --effort           | 6                 | Integer 0–6                                                    |
| --width            | Original          | Positive integer pixels, maximum 100000                        |
| --height           | Original          | Positive integer pixels, maximum 100000                        |
| --fit              | cover             | cover, contain, fill, inside, outside                          |
| --output           | Source directory  | Output root, relative to current directory                     |
| --recursive        | false             | Traverse subdirectories                                        |
| --overwrite        | false             | Replace existing outputs                                       |
| --dry-run          | false             | List planned conversions without creating files or directories |
| --max-size-kb      | None              | Positive size target, 1 KB means 1024 bytes                    |
| --verbose          | false             | Report encoder settings                                        |
| --help             |                   | Show usage; also available on convert                          |
| --version          |                   | Show package version at the top level                          |

## Conversion behaviour

PNG, JPEG (.jpg/.jpeg), TIFF (.tif/.tiff) and AVIF (.avif) inputs are accepted when the installed Sharp runtime supports their decoder. WebP and other files are skipped with a reason. The bundled Sharp build supports these four input families; unusual TIFF codecs or AVIF profiles may still fail.

Outputs retain the original extension: `photo.png` becomes `photo.png.webp`, while `photo.jpg` becomes `photo.jpg.webp`. This prevents collisions, including across repeated runs and case variants. Recursive processing preserves relative paths. A nested output directory is excluded from traversal. Symlink entries are not traversed or converted.

Sources are never written or deleted. Existing outputs are skipped unless overwrite is enabled. Each completed buffer is written to a unique temporary file beside the destination. Publication uses an atomic rename for overwrite, or a hard link that fails safely if the output appears concurrently. Temporary files are removed on handled failures. Filesystems must support hard links for default conversion. A forced process termination can leave a temporary file, but never a partially published output.

EXIF orientation is applied before resizing. Metadata is stripped and transparency is retained. No resizing occurs unless dimensions are given. One dimension preserves proportions; two dimensions use the selected fit (cover can crop, fill can stretch). Upscaling is disabled. Contain may add padding. Two images are processed concurrently to bound memory use; a single very large input can still consume substantial memory and Sharp's default input pixel limit applies.

Size targeting first tries the requested quality, then a bounded search down to quality 20 (or the requested quality if lower). At most nine encodes are performed. The size is checked on every candidate; if the floor cannot meet the target, conversion fails without replacing any existing output. Dimensions are never reduced to meet a size target. The search does not promise the globally highest possible quality because encoded sizes need not be monotonic.

Each file reports DONE, SKIP, PLAN or FAIL. Successful conversions include byte counts and savings (negative means growth). Summary byte totals and savings include successful conversions only; dry-run plans count as skipped. The summary includes elapsed time.

| Exit code | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| 0         | Completed successfully, including skips, empty directories and dry runs |
| 1         | At least one individual file failed; remaining files were attempted     |
| 2         | Invalid arguments, configuration or input directory/discovery failure   |

## Development and verification

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:package
```

Tests generate small images at runtime. Package verification packs and installs a tarball into an isolated temporary directory, then executes its CLI from another working directory. CI runs all checks on Ubuntu, Windows and macOS with Node 24 and 26. Use `npm run format` to apply formatting.

## Troubleshooting and limitations

- Install dependencies on the target OS so Sharp receives the correct native binaries. Avoid copying node_modules between systems.
- Quote paths containing spaces. Check permissions on input and output directories.
- An existing output is skipped without inspecting its contents. Use overwrite to regenerate it.
- Corrupt inputs, unsupported codec variants and impossible size targets return failures with an explanation.
- Animated and multipage inputs use the first frame/page only. Colour profiles and other metadata are not retained.
- Dry run previews discovery and output conflicts; it does not decode inputs or predict compression sizes.
- Files are discovered before processing. Very large directory trees consume memory proportional to their file count. Input files should remain stable during a run.
- Output roots should be trusted: existing symlink directories inside the output tree are followed by the filesystem.

## Roadmap

Tracked in GitHub issue #2: standalone resize commands, same-format compression, more output formats, thumbnails, metadata inspection/removal, watermarking, optimisation reports and configuration files. These are outside v0.1.0.

MIT licensed.
