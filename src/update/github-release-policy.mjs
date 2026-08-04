const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const TAG = /^v[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const INSTALLER = /^NolaneAgent-Setup-[0-9A-Za-z.+-]+-x64\.exe$/;
const GITHUB_REDIRECT_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

export function requireRepository(value) {
  const repository = String(value ?? '').trim();
  if (!REPOSITORY.test(repository)) throw new TypeError('repository must use owner/name format');
  return repository;
}

export function validateGitHubReleaseManifestFields({ repository, tag, commit, packageName, packageUrl, releaseNotesUrl } = {}) {
  const selectedRepository = requireRepository(repository);
  const selectedTag = String(tag ?? '');
  if (!TAG.test(selectedTag)) throw new TypeError('release tag is invalid');
  const selectedCommit = String(commit ?? '').toLowerCase();
  if (!COMMIT.test(selectedCommit)) throw new TypeError('release commit must be a 40-character SHA-1 hash');
  const selectedName = String(packageName ?? '');
  if (!INSTALLER.test(selectedName)) throw new TypeError('NSIS installer name is invalid');

  const asset = new URL(String(packageUrl ?? ''));
  const expectedAssetPath = `/${selectedRepository}/releases/download/${encodeURIComponent(selectedTag)}/${encodeURIComponent(selectedName)}`;
  if (asset.protocol !== 'https:' || asset.hostname !== 'github.com' || asset.pathname !== expectedAssetPath) {
    throw new TypeError('packageUrl must identify the signed GitHub release asset for the configured repository');
  }

  const notes = new URL(String(releaseNotesUrl ?? ''));
  const expectedNotesPath = `/${selectedRepository}/releases/tag/${encodeURIComponent(selectedTag)}`;
  if (notes.protocol !== 'https:' || notes.hostname !== 'github.com' || notes.pathname !== expectedNotesPath) {
    throw new TypeError('releaseNotesUrl must identify the signed GitHub release tag for the configured repository');
  }

  return Object.freeze({
    repository: selectedRepository,
    tag: selectedTag,
    commit: selectedCommit,
    packageName: selectedName,
    packageUrl: asset.href,
    releaseNotesUrl: notes.href,
  });
}

export function isAllowedGitHubRedirect(from, to) {
  const source = new URL(String(from));
  const target = new URL(String(to), source);
  if (target.protocol !== 'https:' || !GITHUB_REDIRECT_HOSTS.has(target.hostname)) return false;
  if (source.hostname === 'github.com' && !GITHUB_REDIRECT_HOSTS.has(target.hostname)) return false;
  return true;
}

export function validateManifestEndpoint(endpoint, repository) {
  const selectedRepository = requireRepository(repository);
  const url = new URL(String(endpoint ?? ''));
  const githubRelease = url.protocol === 'https:' && url.hostname === 'github.com' && [
    `/${selectedRepository}/releases/latest/download/`,
    `/${selectedRepository}/releases/download/`,
  ].some((prefix) => url.pathname.startsWith(prefix));
  const rawFeedPrefix = `/${selectedRepository}/update-feed/feeds/`;
  const rawFeed = url.protocol === 'https:' && url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith(rawFeedPrefix) && /\/nolane-agent-update-(alpha|beta|stable|nightly)\.json$/.test(url.pathname);
  if (!githubRelease && !rawFeed) throw new TypeError('Update endpoint must be the configured repository signed GitHub release feed');
  return url.href;
}
