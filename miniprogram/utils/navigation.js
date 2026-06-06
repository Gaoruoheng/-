const HOME_URL = "/pages/home/home";
const INDEX_URL = "/pages/index/index";
const CATEGORY_URL = "/pages/category-detail/category";

function buildUrl(path, query) {
  const params = Object.keys(query || {})
    .filter(key => query[key] !== undefined && query[key] !== null && query[key] !== "")
    .map(key => key + "=" + encodeURIComponent(query[key]))
    .join("&");
  return params ? path + "?" + params : path;
}

function buildWardrobeUrl(wardrobeId) {
  return wardrobeId ? buildUrl(INDEX_URL, { wardrobeId }) : HOME_URL;
}

function buildCategoryUrl(wardrobeId, categoryName) {
  if (!wardrobeId || !categoryName) return buildWardrobeUrl(wardrobeId);
  return buildUrl(CATEGORY_URL, {
    wardrobeId,
    name: categoryName
  });
}

function getPageStackLength() {
  if (typeof getCurrentPages !== "function") return 0;
  const pages = getCurrentPages();
  return pages && pages.length ? pages.length : 0;
}

function reLaunchFallback(url) {
  wx.reLaunch({
    url: url || HOME_URL,
    fail(err) {
      console.error("navigation fallback failed", err);
      wx.showToast({ title: "返回失败，请重新编译", icon: "none" });
    }
  });
}

function navigateBackOrFallback(options = {}) {
  const delta = options.delta || 1;
  const fallbackUrl = options.fallbackUrl || HOME_URL;

  if (getPageStackLength() > delta) {
    wx.navigateBack({
      delta,
      fail() {
        reLaunchFallback(fallbackUrl);
      }
    });
    return;
  }

  reLaunchFallback(fallbackUrl);
}

function backHome() {
  navigateBackOrFallback({ fallbackUrl: HOME_URL });
}

function backToWardrobe(wardrobeId) {
  navigateBackOrFallback({ fallbackUrl: buildWardrobeUrl(wardrobeId) });
}

function backToCategoryOrWardrobe(wardrobeId, categoryName) {
  navigateBackOrFallback({
    fallbackUrl: buildCategoryUrl(wardrobeId, categoryName)
  });
}

function backFromItemDetail(options = {}) {
  const source = options.source || "";
  const categoryName = options.categoryName || "";
  const wardrobeId = options.wardrobeId || "";
  const fallbackUrl = source === "category"
    ? buildCategoryUrl(wardrobeId, categoryName)
    : buildWardrobeUrl(wardrobeId);
  navigateBackOrFallback({ fallbackUrl });
}

module.exports = {
  HOME_URL,
  buildWardrobeUrl,
  buildCategoryUrl,
  navigateBackOrFallback,
  backHome,
  backToWardrobe,
  backToCategoryOrWardrobe,
  backFromItemDetail
};
