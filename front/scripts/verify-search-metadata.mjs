import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const canonicalOrigin = 'https://margins.cloud';
const canonicalUrl = `${canonicalOrigin}/`;
const expectedTitle = 'Margins | AI와 함께 쌓는 독서 기록';
const expectedDescription =
  '책을 발견하고 서재에 저장한 뒤, AI 질문에 답하고 감상을 기록하며 다양한 관점의 페르소나와 토론하는 독서 기록 서비스입니다.';
const expectedFeatures = [
  '책 검색 또는 직접 등록과 개인 서재 관리',
  '독서 상태와 별점 기록',
  'AI가 생성한 독서 질문과 답변',
  '감상·메시지·독후감의 지속 보관',
  '주제별 AI 페르소나 토론',
];
const distDir = resolve(process.env.MARGINS_DIST_DIR ?? join(process.cwd(), 'dist'));
const indexPath = join(distDir, 'index.html');
const manifestPath = join(distDir, 'site.webmanifest');
const ogImagePath = join(distDir, 'og-image.png');
const robotsPath = join(distDir, 'robots.txt');
const sitemapPath = join(distDir, 'sitemap.xml');

await Promise.all([
  access(indexPath),
  access(manifestPath),
  access(ogImagePath),
  access(robotsPath),
  access(sitemapPath),
]);

const [indexHtml, manifestSource, ogImage, robots, sitemap] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(manifestPath, 'utf8'),
  readFile(ogImagePath),
  readFile(robotsPath, 'utf8'),
  readFile(sitemapPath, 'utf8'),
]);
const normalizedIndexHtml = indexHtml.replace(/\s+/g, ' ');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectTag(pattern, message) {
  if (!pattern.test(normalizedIndexHtml)) {
    throw new Error(message);
  }
}

expectTag(/<html\s+lang="ko">/, 'index.html must use Korean as its static document language.');
expectTag(
  new RegExp(`<title>${escapeRegExp(expectedTitle)}</title>`),
  'index.html has an unexpected title.',
);
expectTag(
  new RegExp(`<meta\\s+name="description"\\s+content="${escapeRegExp(expectedDescription)}"`),
  'index.html has an unexpected description.',
);
expectTag(
  new RegExp(`<link\\s+rel="canonical"\\s+href="${escapeRegExp(canonicalUrl)}"`),
  'index.html is missing the canonical public root URL.',
);

for (const [field, value] of [
  ['meta name="robots"', 'index,follow'],
  ['meta property="og:site_name"', 'Margins'],
  ['meta property="og:url"', canonicalUrl],
  ['meta property="og:title"', expectedTitle],
  ['meta property="og:description"', expectedDescription],
  ['meta property="og:image"', `${canonicalOrigin}/og-image.png`],
  ['meta property="og:image:width"', '1200'],
  ['meta property="og:image:height"', '630'],
  ['meta name="twitter:card"', 'summary_large_image'],
  ['meta name="twitter:url"', canonicalUrl],
  ['meta name="twitter:title"', expectedTitle],
  ['meta name="twitter:description"', expectedDescription],
  ['meta name="twitter:image"', `${canonicalOrigin}/og-image.png`],
]) {
  expectTag(
    new RegExp(`<${escapeRegExp(field)}\\s+content="${escapeRegExp(value)}"`),
    `index.html is missing ${field}=${value}.`,
  );
}

if (
  ogImage.subarray(1, 4).toString('ascii') !== 'PNG' ||
  ogImage.readUInt32BE(16) !== 1200 ||
  ogImage.readUInt32BE(20) !== 630
) {
  throw new Error('og-image.png must be a 1200x630 PNG image.');
}

const jsonLdMatches = [
  ...indexHtml.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g),
];
if (jsonLdMatches.length !== 1) {
  throw new Error('index.html must contain exactly one JSON-LD document.');
}

let jsonLd;
try {
  jsonLd = JSON.parse(jsonLdMatches[0][1]);
} catch (error) {
  throw new Error('index.html contains invalid JSON-LD.', { cause: error });
}

if (
  jsonLd['@type'] !== 'WebApplication' ||
  jsonLd.url !== canonicalUrl ||
  jsonLd.description !== expectedDescription ||
  !Array.isArray(jsonLd.inLanguage) ||
  !['ko', 'en'].every((language) => jsonLd.inLanguage.includes(language)) ||
  JSON.stringify(jsonLd.featureList) !== JSON.stringify(expectedFeatures)
) {
  throw new Error('WebApplication JSON-LD does not match the public search contract.');
}

const manifest = JSON.parse(manifestSource);
if (
  manifest.description !== expectedDescription ||
  manifest.theme_color !== '#f2f0eb' ||
  manifest.background_color !== '#f2f0eb'
) {
  throw new Error('site.webmanifest does not match the public description and theme.');
}

for (const directive of [
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  'Disallow: /book/',
  'Disallow: /memory-card/',
  `Sitemap: ${canonicalOrigin}/sitemap.xml`,
]) {
  if (!robots.split(/\r?\n/).includes(directive)) {
    throw new Error(`robots.txt is missing required directive: ${directive}`);
  }
}

const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (
  !sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
  !sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
) {
  throw new Error('sitemap.xml is missing the XML declaration or sitemap namespace.');
}
if (sitemapLocations.length !== 1 || sitemapLocations[0] !== canonicalUrl) {
  throw new Error('sitemap.xml must contain only the canonical public root URL.');
}

console.log('Production search metadata describes Margins at the canonical public root URL.');
