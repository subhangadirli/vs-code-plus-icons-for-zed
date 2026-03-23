#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ICONS_DIR = path.resolve(__dirname, "../icons");
const OUTPUT_DIR = path.resolve(__dirname, "./icon_themes");
const OUTPUT_FILE = path.resolve(OUTPUT_DIR, "vscode-icons.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeIconKey(key) {
  return typeof key === "string" ? key.replace(/^_+/, "") : key;
}

function extractSvgFilename(iconPathValue) {
  if (!iconPathValue || typeof iconPathValue !== "string") return null;
  return path.basename(iconPathValue);
}

function listSvgBasenames(dir) {
  if (!fs.existsSync(dir)) return new Set();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const set = new Set();
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase().endsWith(".svg")) {
      set.add(e.name);
    }
  }
  return set;
}

function findBuiltThemeJsonPath(rootDir) {
  const candidates = [];

  const explicit = [
    path.join(rootDir, "icons.json"),
    path.join(rootDir, "dist", "icons.json"),
    path.join(rootDir, "out", "icons.json"),
  ];

  for (const p of explicit) {
    if (fs.existsSync(p)) candidates.push(p);
  }

  // Fallback: scan top-level + dist/out for .json files with VS Code icon schema keys
  const scanDirs = [rootDir, path.join(rootDir, "dist"), path.join(rootDir, "out")];
  for (const d of scanDirs) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    for (const name of fs.readdirSync(d)) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      const fp = path.join(d, name);
      try {
        const data = readJson(fp);
        if (
          data &&
          typeof data === "object" &&
          data.iconDefinitions &&
          (data.fileExtensions || data.fileNames || data.folderNames)
        ) {
          candidates.push(fp);
        }
      } catch {
        // ignore invalid JSON in scan
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error("Could not detect built VS Code icon theme JSON. Run the build script first.");
  }

  // Prefer exact icons.json in root if present
  const preferred = candidates.find((p) => path.basename(p) === "icons.json" && path.dirname(p) === rootDir);
  return preferred || candidates[0];
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toZedPath(svgFilename) {
  return `./icons/${svgFilename}`;
}

function build() {
  const builtThemePath = findBuiltThemeJsonPath(ROOT);
  const vscodeTheme = readJson(builtThemePath);
  const availableSvgs = listSvgBasenames(ICONS_DIR);

  console.log(`[info] Built VS Code theme JSON: ${builtThemePath}`);
  console.log(`[info] Icons directory: ${ICONS_DIR}`);
  console.log(`[info] SVG files found: ${availableSvgs.size}`);

  const iconDefinitions = vscodeTheme.iconDefinitions || {};
  const fileExtensions = vscodeTheme.fileExtensions || {};
  const fileNames = vscodeTheme.fileNames || {};
  const folderNames = vscodeTheme.folderNames || {};
  const folderNamesExpanded = vscodeTheme.folderNamesExpanded || {};

  const fileKeyRaw = vscodeTheme.file;
  const folderKeyRaw = vscodeTheme.folder;
  const folderExpandedKeyRaw = vscodeTheme.folderExpanded;

  const fileKey = normalizeIconKey(fileKeyRaw);
  const folderKey = normalizeIconKey(folderKeyRaw);
  const folderExpandedKey = normalizeIconKey(folderExpandedKeyRaw);

  const keyToSvgFilename = new Map(); // normalized key -> filename.svg
  const filenameToNormalizedKey = new Map(); // filename.svg -> normalized key
  const missingSvgWarnings = [];

  for (const [rawKey, def] of Object.entries(iconDefinitions)) {
    const normalized = normalizeIconKey(rawKey);
    const filename = extractSvgFilename(def && def.iconPath);
    if (!filename) continue;
    keyToSvgFilename.set(normalized, filename);
    if (!filenameToNormalizedKey.has(filename)) {
      filenameToNormalizedKey.set(filename, normalized);
    }
    if (!availableSvgs.has(filename)) {
      missingSvgWarnings.push(`[warn] Missing SVG for icon key "${normalized}": ${filename}`);
    }
  }

  for (const w of missingSvgWarnings) console.warn(w);

  const fallbackAliasMap = {
    f_androd: "f_android",
    f_document: "f_file",
    f_nunjucks: "f_html",
    f_pascal: "f_pawn",
    f_dockerdebug: "f_docker",
    f_watchmanconfig: "f_watchman",
    f_conduct: "f_credits",
  };

  function resolveIconKey(rawIconKey) {
    const normalized = normalizeIconKey(rawIconKey);
    if (!normalized) return normalized;
    if (keyToSvgFilename.has(normalized)) return normalized;

    const alias = fallbackAliasMap[normalized];
    if (alias && keyToSvgFilename.has(alias)) {
      console.warn(`[warn] Resolved missing icon key "${normalized}" via alias "${alias}".`);
      return alias;
    }

    const directSvg = `${normalized.replace(/^f_/, "")}.svg`;
    if (availableSvgs.has(directSvg) && filenameToNormalizedKey.has(directSvg)) {
      const inferredKey = filenameToNormalizedKey.get(directSvg);
      console.warn(`[warn] Resolved missing icon key "${normalized}" via SVG "${directSvg}" -> "${inferredKey}".`);
      return inferredKey;
    }

    if (normalized.startsWith("f_")) {
      const base = normalized.slice(2);
      const variants = [`${base}.svg`, `${base.replace(/-/g, "_")}.svg`, `${base.replace(/_/g, "-")}.svg`];
      for (const candidate of variants) {
        if (availableSvgs.has(candidate) && filenameToNormalizedKey.has(candidate)) {
          const inferredKey = filenameToNormalizedKey.get(candidate);
          console.warn(`[warn] Resolved missing icon key "${normalized}" via variant "${candidate}" -> "${inferredKey}".`);
          return inferredKey;
        }
      }

      if (availableSvgs.has(`${base}.svg`)) {
        const syntheticKey = `f_${base}`;
        if (!keyToSvgFilename.has(syntheticKey)) {
          keyToSvgFilename.set(syntheticKey, `${base}.svg`);
          console.warn(
            `[warn] Resolved missing icon key "${normalized}" via synthetic key "${syntheticKey}" from "${base}.svg".`,
          );
        }
        return syntheticKey;
      }
    }

    return normalized;
  }

  const file_icons = {};
  for (const [iconKey, filename] of keyToSvgFilename.entries()) {
    file_icons[iconKey] = { path: toZedPath(filename) };
  }

  function syncResolvedKeysIntoFileIcons() {
    const usedKeys = new Set();
    for (const rawIconKey of Object.values(fileExtensions)) {
      const resolved = resolveIconKey(rawIconKey);
      if (resolved) usedKeys.add(resolved);
    }
    for (const rawIconKey of Object.values(fileNames)) {
      const resolved = resolveIconKey(rawIconKey);
      if (resolved) usedKeys.add(resolved);
    }
    for (const rawIconKey of Object.values(folderNames)) {
      const resolved = resolveIconKey(rawIconKey);
      if (resolved) usedKeys.add(resolved);
    }
    for (const rawIconKey of Object.values(folderNamesExpanded)) {
      const resolved = resolveIconKey(rawIconKey);
      if (resolved) usedKeys.add(resolved);
    }
    if (fileKey) usedKeys.add(resolveIconKey(fileKey));
    if (folderKey) usedKeys.add(resolveIconKey(folderKey));
    if (folderExpandedKey) usedKeys.add(resolveIconKey(folderExpandedKey));

    for (const iconKey of usedKeys) {
      if (!iconKey || file_icons[iconKey]) continue;
      const filename = keyToSvgFilename.get(iconKey);
      if (!filename) continue;
      file_icons[iconKey] = { path: toZedPath(filename) };
    }
  }

  syncResolvedKeysIntoFileIcons();

  // Ensure default key exists and points to "file" icon
  if (fileKey) {
    const resolvedFileKey = resolveIconKey(fileKey);
    const defaultFileName = keyToSvgFilename.get(resolvedFileKey);
    if (!defaultFileName) {
      console.warn(`[warn] Default file icon key "${fileKey}" not found in iconDefinitions.`);
    } else {
      file_icons.default = { path: toZedPath(defaultFileName) };
    }
  } else {
    console.warn("[warn] VS Code theme missing top-level 'file' key.");
  }

  const file_suffixes = {};
  for (const [suffix, rawIconKey] of Object.entries(fileExtensions)) {
    file_suffixes[suffix] = resolveIconKey(rawIconKey);
  }

  const file_stems = {};
  for (const [stem, rawIconKey] of Object.entries(fileNames)) {
    file_stems[stem] = resolveIconKey(rawIconKey);
  }

  const resolvedFolderKey = resolveIconKey(folderKey);
  const resolvedFolderExpandedKey = resolveIconKey(folderExpandedKey);

  const defaultCollapsed =
    resolvedFolderKey && keyToSvgFilename.get(resolvedFolderKey) ? toZedPath(keyToSvgFilename.get(resolvedFolderKey)) : null;
  const defaultExpanded =
    resolvedFolderExpandedKey && keyToSvgFilename.get(resolvedFolderExpandedKey)
      ? toZedPath(keyToSvgFilename.get(resolvedFolderExpandedKey))
      : null;

  if (!defaultCollapsed) {
    console.warn(`[warn] Could not resolve default collapsed folder icon from key "${folderKey}".`);
  }
  if (!defaultExpanded) {
    console.warn(`[warn] Could not resolve default expanded folder icon from key "${folderExpandedKey}".`);
  }

  const directory_icons = {
    collapsed: defaultCollapsed || "./icons/folder.svg",
    expanded: defaultExpanded || "./icons/folder_open.svg",
  };

  const named_directory_icons = {};
  for (const [name, rawCollapsedKey] of Object.entries(folderNames)) {
    const collapsedKey = resolveIconKey(rawCollapsedKey);
    const expandedRaw = folderNamesExpanded[name];
    const expandedKey = resolveIconKey(expandedRaw);

    const collapsedSvg = keyToSvgFilename.get(collapsedKey);
    let expandedSvg = expandedKey ? keyToSvgFilename.get(expandedKey) : null;

    if (!expandedRaw) {
      console.warn(`[warn] folderNamesExpanded missing entry for "${name}", using default expanded icon.`);
    }

    if (!expandedSvg) {
      expandedSvg = directory_icons.expanded.replace("./icons/", "");
    }

    named_directory_icons[name] = {
      collapsed: collapsedSvg ? toZedPath(collapsedSvg) : directory_icons.collapsed,
      expanded: toZedPath(expandedSvg),
    };
  }

  // Optional chevron icons (only if present)
  // Best effort detection for common names.
  const chevronCandidates = [
    ["chevron-right.svg", "chevron-down.svg"],
    ["arrow-right.svg", "arrow-down.svg"],
    ["folder-chevron-right.svg", "folder-chevron-down.svg"],
  ];

  let chevron_icons = null;
  for (const [c, e] of chevronCandidates) {
    if (availableSvgs.has(c) && availableSvgs.has(e)) {
      chevron_icons = {
        collapsed: toZedPath(c),
        expanded: toZedPath(e),
      };
      break;
    }
  }

  const theme = {
    $schema: "https://zed.dev/schema/icon_themes/v0.3.0.json",
    name: "Vs Code+ Icons",
    author: "subhangadirli",
    themes: [
      {
        name: "Vs Code+ Icons",
        appearance: "dark",
        directory_icons,
        named_directory_icons,
        ...(chevron_icons ? { chevron_icons } : {}),
        file_stems,
        file_suffixes,
        file_icons,
      },
    ],
  };

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(theme, null, 2), "utf8");
  console.log(`[info] Wrote Zed icon theme JSON: ${OUTPUT_FILE}`);

  return { theme, availableSvgs };
}

function validate(theme, availableSvgs) {
  const errors = [];
  const warnings = [];

  // 1) valid JSON is implicit (already parsed object) + serializable
  try {
    JSON.stringify(theme);
  } catch (e) {
    errors.push(`Theme is not serializable JSON: ${e.message}`);
  }

  const t = theme.themes && theme.themes[0];
  if (!t) {
    errors.push("Theme missing 'themes[0]'.");
    return { errors, warnings };
  }

  // 2) every file_icons path resolves to real file under icons/
  const fileIcons = t.file_icons || {};
  for (const [key, entry] of Object.entries(fileIcons)) {
    const p = entry && entry.path;
    if (!p || typeof p !== "string") {
      errors.push(`file_icons.${key} missing path.`);
      continue;
    }
    const filename = path.basename(p);
    if (!availableSvgs.has(filename)) {
      errors.push(`Broken SVG reference: file_icons.${key} -> ${p}`);
    }
  }

  // 3) directory_icons has both collapsed and expanded
  if (!t.directory_icons || !t.directory_icons.collapsed || !t.directory_icons.expanded) {
    errors.push("directory_icons must contain both 'collapsed' and 'expanded'.");
  } else {
    const c = path.basename(t.directory_icons.collapsed);
    const e = path.basename(t.directory_icons.expanded);
    if (!availableSvgs.has(c)) errors.push(`Broken directory_icons.collapsed: ${t.directory_icons.collapsed}`);
    if (!availableSvgs.has(e)) errors.push(`Broken directory_icons.expanded: ${t.directory_icons.expanded}`);
  }

  // 4) each file_stems and file_suffixes value exists in file_icons
  const iconKeys = new Set(Object.keys(fileIcons));
  const stems = t.file_stems || {};
  const suffixes = t.file_suffixes || {};

  for (const [stem, iconKey] of Object.entries(stems)) {
    if (!iconKeys.has(iconKey)) {
      errors.push(`file_stems.${stem} references missing file_icons key "${iconKey}"`);
    }
  }

  for (const [suffix, iconKey] of Object.entries(suffixes)) {
    if (!iconKeys.has(iconKey)) {
      errors.push(`file_suffixes.${suffix} references missing file_icons key "${iconKey}"`);
    }
  }

  // Named directories sanity checks
  const named = t.named_directory_icons || {};
  for (const [name, pair] of Object.entries(named)) {
    if (!pair.collapsed || !pair.expanded) {
      warnings.push(`named_directory_icons.${name} missing collapsed/expanded path`);
      continue;
    }
    const c = path.basename(pair.collapsed);
    const e = path.basename(pair.expanded);
    if (!availableSvgs.has(c)) errors.push(`Broken named_directory_icons.${name}.collapsed: ${pair.collapsed}`);
    if (!availableSvgs.has(e)) errors.push(`Broken named_directory_icons.${name}.expanded: ${pair.expanded}`);
  }

  return { errors, warnings };
}

(function main() {
  try {
    const { theme, availableSvgs } = build();
    const t = theme.themes[0];

    console.log(
      `[summary] file_icons=${Object.keys(t.file_icons || {}).length}, ` +
        `file_suffixes=${Object.keys(t.file_suffixes || {}).length}, ` +
        `file_stems=${Object.keys(t.file_stems || {}).length}, ` +
        `named_directory_icons=${Object.keys(t.named_directory_icons || {}).length}`,
    );

    const { errors, warnings } = validate(theme, availableSvgs);
    for (const w of warnings) console.warn(`[warn] ${w}`);

    if (errors.length) {
      console.error(`[validate] FAILED with ${errors.length} error(s):`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }

    console.log("[validate] OK");
  } catch (err) {
    console.error("[fatal]", err && err.message ? err.message : err);
    process.exit(1);
  }
})();
