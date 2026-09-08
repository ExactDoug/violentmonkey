/**
 * Post-build branding overlay.
 *
 * Rewrites the *built* locale strings (and, if present, the hardcoded beta name
 * in the built manifest) to replace the upstream product name with ours.
 *
 * Why this runs on build output instead of patching `_locales/*.yml`:
 *   - It touches zero upstream-maintained files, so `git rebase upstream/master`
 *     stays conflict-free no matter how much upstream churns its strings.
 *   - It covers all ~33 locales, not just `en`. Patching the source only ever
 *     rebranded English, so non-English users still saw the upstream name.
 *   - New upstream strings mentioning the product are rebranded automatically
 *     the first time they appear, instead of silently leaking through.
 *
 * Safety: the replacement is case-sensitive on the capitalized product name.
 * Upstream writes URLs in lowercase (violentmonkey.github.io), so links are
 * never rewritten. `assertUrlsIntact` enforces that invariant at build time.
 */
const fs = require('fs').promises;
const { DIST } = require('./common');
const brand = require('../brand.config');

const { upstreamName, name } = brand;

/** English possessive: "Foo's", but "Foos'" when the name already ends in s. */
const possessiveOf = str => (str.endsWith('s') ? `${str}'` : `${str}'s`);

/** Longest-first so "Violentmonkey's" is consumed before "Violentmonkey". */
const REPLACEMENTS = [
  [possessiveOf(upstreamName), possessiveOf(name)],
  [upstreamName, name],
];

function rebrandString(str) {
  return REPLACEMENTS.reduce(
    (acc, [from, to]) => acc.split(from).join(to),
    str,
  );
}

/**
 * Guard against a future upstream string that embeds the capitalized name in a
 * URL, which a blind replace would turn into a broken link.
 */
function assertUrlsIntact(before, where) {
  const bad = before.match(new RegExp(`\\S*${upstreamName}\\S*`, 'g'))
    ?.filter(token => /^(?:https?:|www\.)|\.(?:io|com|net|org)\b|\//.test(token));
  if (bad?.length) {
    throw new Error(
      `brand: refusing to rewrite ${where} — "${upstreamName}" appears inside `
      + `a URL-like token, which would break the link: ${bad.join(', ')}`,
    );
  }
}

/** Recursively rebrand every `message` field of a Chrome messages.json. */
function rebrandMessages(data, where) {
  let changed = 0;
  for (const entry of Object.values(data)) {
    if (entry && typeof entry.message === 'string'
      && entry.message.includes(upstreamName)) {
      assertUrlsIntact(entry.message, where);
      entry.message = rebrandString(entry.message);
      changed += 1;
    }
  }
  return changed;
}

async function rebrandLocales() {
  const base = `${DIST}/_locales`;
  let langs;
  try {
    langs = await fs.readdir(base);
  } catch {
    return { langs: 0, strings: 0 }; // locales not built yet
  }
  let strings = 0;
  let touched = 0;
  for (const lang of langs) {
    const file = `${base}/${lang}/messages.json`;
    let data;
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      continue; // not a locale dir
    }
    const n = rebrandMessages(data, file);
    if (n) {
      await fs.writeFile(file, JSON.stringify(data), 'utf8');
      strings += n;
      touched += 1;
    }
  }
  return { langs: touched, strings };
}

/**
 * The built manifest resolves its name from `__MSG_extName__`, so locales cover
 * it. The one exception is upstream's beta path, which hardcodes
 * "<Name> BETA". Rewrite that, plus the optional homepage/author overrides.
 */
async function rebrandManifest() {
  const file = `${DIST}/manifest.json`;
  let data;
  try {
    data = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return false;
  }
  const before = JSON.stringify(data);
  const action = data.action || data.browser_action;
  if (typeof data.name === 'string') data.name = rebrandString(data.name);
  if (action && typeof action.default_title === 'string') {
    action.default_title = rebrandString(action.default_title);
  }
  if (brand.homepageUrl) data.homepage_url = brand.homepageUrl;
  if (brand.author) data.author = brand.author;
  if (JSON.stringify(data) === before) return false;
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

async function rebrand() {
  const { langs, strings } = await rebrandLocales();
  const manifest = await rebrandManifest();
  // eslint-disable-next-line no-console
  console.log(
    `brand: ${upstreamName} -> ${name} `
    + `(${strings} strings across ${langs} locales${manifest ? ', manifest' : ''})`,
  );
}

// Named for gulp's task registry.
Object.defineProperty(rebrand, 'name', { value: 'rebrand' });

exports.rebrand = rebrand;
exports.rebrandString = rebrandString;
