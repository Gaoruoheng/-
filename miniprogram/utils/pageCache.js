const PREFIX = "kawaii_closet_cache:";
const CACHE_SCHEMA_VERSION = 2;
const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24;
const memoryCache = {};

function buildKey(scope, id) {
  return PREFIX + scope + ":" + (id || "default");
}

function isValidCache(cached, options = {}) {
  if (!cached) return false;
  if (cached.cacheSchemaVersion !== CACHE_SCHEMA_VERSION) return false;

  const maxAge = typeof options.maxAge === "number" ? options.maxAge : DEFAULT_MAX_AGE;
  if (maxAge > 0 && cached.cachedAt && Date.now() - cached.cachedAt > maxAge) {
    return false;
  }

  if (options.sourceUpdatedAt && cached.sourceUpdatedAt) {
    return String(cached.sourceUpdatedAt) === String(options.sourceUpdatedAt);
  }

  return true;
}

function getCache(scope, id, options = {}) {
  const key = buildKey(scope, id);
  if (isValidCache(memoryCache[key], options)) return memoryCache[key];

  try {
    const cached = wx.getStorageSync(key);
    if (isValidCache(cached, options)) {
      memoryCache[key] = cached;
      return cached;
    }
  } catch (err) {
    console.warn("read page cache failed", err);
  }
  removeCache(scope, id);
  return null;
}

function setCache(scope, id, value, options = {}) {
  const key = buildKey(scope, id);
  const payload = {
    ...value,
    cacheSchemaVersion: CACHE_SCHEMA_VERSION,
    sourceUpdatedAt: options.sourceUpdatedAt || value.sourceUpdatedAt || "",
    cachedAt: Date.now()
  };
  memoryCache[key] = payload;

  try {
    wx.setStorageSync(key, payload);
  } catch (err) {
    console.warn("write page cache failed", err);
  }
}

function removeCache(scope, id) {
  const key = buildKey(scope, id);
  delete memoryCache[key];
  try {
    wx.removeStorageSync(key);
  } catch (err) {
    console.warn("remove page cache failed", err);
  }
}

module.exports = {
  getCache,
  setCache,
  removeCache
};
