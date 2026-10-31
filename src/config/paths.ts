// One encrypted storage file per plugin, as required by host-and-provider.md (so each can be
// wiped independently and a bug in one plugin's state can't corrupt the other's).
export const PP_STORAGE_PATH = '.kohaku/pp-storage.enc.json'
export const TC_STORAGE_PATH = '.kohaku/tc-storage.enc.json'

// Local cache for Tornado's proving artifacts (circuit + proving key), downloaded once.
export const TC_ARTIFACTS_CACHE_PATH = '.kohaku-cache/tc-artifacts.json'
