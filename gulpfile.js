const fs = require('fs').promises;
const gulp = require('gulp');
const del = require('del').deleteAsync;
const log = require('fancy-log');
const plumber = require('gulp-plumber');
const Sharp = require('sharp');
const spawn = require('cross-spawn');
const i18n = require('./scripts/i18n');
const { getVersion, isBeta } = require('./scripts/version-helper');
const { buildManifest } = require('./scripts/manifest-helper');
const pkg = require('./package.json');
const { MV3, DIST } = require('./scripts/common');
const { rebrand } = require('./scripts/brand'); // fork: branding overlay
const brand = require('./brand.config');

const paths = {
  manifest: 'src/manifest.yml',
  locales: [
    '_locales/**',
  ],
  templates: [
    'src/**/*.@(js|html|json|yml|vue)',
  ],
};

function clean() {
  return del(DIST);
}

function watch() {
  gulp.watch(paths.manifest, manifest);
  gulp.watch(paths.locales.concat(paths.templates), gulp.series(copyI18n, rebrand));
}

async function jsDev() {
  return runCommand('webpack-cli', ['-w', '--config', 'scripts/webpack.conf.js']);
}

async function jsProd() {
  return runCommand('webpack-cli', ['--config', 'scripts/webpack.conf.js']);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });
    child.on('close', (code, signal) => {
      (code ? reject : resolve)(signal);
    });
  });
}

async function manifest() {
  const data = await buildManifest();
  if (!MV3) {
    const base = JSON.parse(await fs.readFile(`${DIST}/manifest.json`, 'utf8'));
    data.background.scripts = base.background.scripts; // preserving ListBackgroundScriptsPlugin
  }
  await fs.mkdir(DIST).catch(() => {});
  await fs.writeFile(`${DIST}/manifest.json`, JSON.stringify(data, null, 2), 'utf8');
}

async function createIcons() {
  const ALPHA = 0.5;
  const dist = `${DIST}/public/images`;
  await fs.mkdir(dist, { recursive: true });
  const icon = Sharp(`src/resources/icon${isBeta() ? '-beta' : ''}.png`);
  /* fork: the brand artwork is a horizontal wordmark, which is an unreadable
   * smudge once rasterized to toolbar sizes. When brand.config.js supplies a
   * square monogram, render every size below 128 from that instead, and keep
   * the wordmark only for the 128px store/about listing. See issue #6. */
  const smallIcon = brand.iconSmall ? Sharp(brand.iconSmall) : icon;
  const variantsOf = image => [
    ['', image],
    ['b', image.clone().grayscale()],
    ['w', image.clone().composite([{
      input: Buffer.from([255, 255, 255, 256 * ALPHA]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in',
    }])],
  ];
  const types = variantsOf(smallIcon);
  const handle = (size, type = '', image = smallIcon) => {
    let res = image.clone().resize({ width: size });
    if (size < 48) res = res.sharpen(size < 32 ? 0.5 : 0.25);
    return res.toFile(`${dist}/icon${size}${type}.png`);
  };
  const darkenOuterEdge = async img => img.composite([{
    input: await img.toBuffer(),
    blend: 'over',
  }]);
  const handle16 = async ([type, image]) => {
    /* The upstream 18px-then-crop trick nudges a canvas-filling glyph into
     * place; a monogram is already centred with its own margin, so scale it
     * straight to 16 to avoid clipping a stroke. */
    const res = brand.iconSmall
      ? image.clone().resize({ width: 16 }).sharpen(0.5, 0)
      : image.clone()
        .resize({ width: 18 })
        .sharpen(0.5, 0)
        .extract({ left: 1, top: 2, width: 16, height: 16 });
    return (type === 'w' ? res : await darkenOuterEdge(res))
    .toFile(`${dist}/icon16${type}.png`);
  };
  return Promise.all([
    // 128px keeps the full wordmark: it is the store listing and about-page size
    handle(128, '', icon),
    ...types.map(handle16),
    // 32px dashboard icon (recycled) + 2xDPI browser_action desktop
    // 38px dashboard icon (normal) + 1.5xDPI browser_action Android
    // 48px 2xDPI browser_action Android
    ...[32, 38, 48, 64].flatMap(size => types.map(t => handle(size, ...t))),
  ]);
}

/**
 * Bump `beta` in `package.json` to release a new beta version.
 */
async function bump() {
  if (process.argv.includes('--reset')) {
    delete pkg.beta;
  } else {
    pkg.beta = (+pkg.beta || 0) + 1;
  }
  await fs.writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  if (process.argv.includes('--commit')) {
    const version = `v${getVersion()}`;
    spawn.sync('git', ['commit', '-am', version]);
    spawn.sync('git', ['tag', '-m', version, version]);
  }
}

function checkI18n() {
  return i18n.read({
    base: '_locales',
    extension: '.json',
  });
}

function copyI18n() {
  return i18n.read({
    base: '_locales',
    touchedOnly: true,
    useDefaultLang: true,
    markUntouched: false,
    extension: '.json',
    stripDescriptions: true,
  })
  .pipe(gulp.dest(`${DIST}/_locales`));
}

/**
 * Load locale files (_locales/<lang>/message.[json|yml]), and
 * update them with keys in template files, then store in `message.yml`.
 */
function updateI18n() {
  return gulp.src(paths.templates)
  .pipe(plumber(logError))
  .pipe(i18n.extract({
    base: '_locales',
    manifest: 'src/manifest.yml',
    touchedOnly: false,
    useDefaultLang: false,
    markUntouched: true,
    extension: '.yml',
  }))
  .pipe(gulp.dest('_locales'));
}

function logError(err) {
  log(err.toString());
  return this.emit('end');
}

const pack = gulp.parallel(createIcons, copyI18n, ...MV3 ? [manifest] : []);

exports.clean = clean;
exports.manifest = manifest;
exports.dev = gulp.parallel(gulp.series(pack, rebrand, watch), jsDev);
exports.build = gulp.series(clean, gulp.parallel(pack, jsProd), rebrand);
exports.i18n = updateI18n;
exports.check = checkI18n;
exports.copyI18n = copyI18n;
exports.bump = bump;
