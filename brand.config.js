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
   * Square monogram used for every generated icon below 128px.
   *
   * The Exact artwork is a horizontal wordmark plus a tagline. Rasterized to a
   * 16px toolbar icon it is an illegible smudge, and it wastes ~60% of a square
   * canvas as empty margin at every size. This is the red checkmark from the
   * logo, extracted and squared, which stays crisp down to 16px.
   *
   * Set to null to render all sizes from the wordmark (upstream behaviour).
   */
  iconSmall: 'src/resources/icon-small.png',

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
