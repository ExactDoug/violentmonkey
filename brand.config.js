/**
 * Branding overlay configuration for this fork.
 *
 * The fork rebrands upstream Violentmonkey as "Exact Scripts". Rather than
 * editing upstream's source files (which guarantees merge conflicts on every
 * sync), the rename is applied to build output by `scripts/brand.js`.
 *
 * See doc/SYNCING-UPSTREAM.md for the sync workflow.
 */
module.exports = {
  /** The upstream product name, as it appears in `_locales/<lang>/messages.yml`. */
  upstreamName: 'Violentmonkey',

  /** Our product name. Replaces `upstreamName` in all built locale strings. */
  name: 'Exact Scripts',

  /**
   * Replace `homepage_url` in the built manifest.
   * Left null deliberately: upstream's homepage is the real documentation for
   * this engine, and pointing it at a nonexistent Exact URL would ship a dead
   * link. Set to a string to override.
   */
  homepageUrl: null,

  /**
   * Replace `author` in the built manifest.
   * Left null to preserve upstream attribution (the code is upstream's; only
   * the branding is ours, and the MIT license requires the notice be kept).
   */
  author: null,
};
