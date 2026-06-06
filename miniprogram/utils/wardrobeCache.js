const { getCache, setCache, removeCache } = require("./pageCache.js");

function getOpenId(user) {
  return user && user.openid ? user.openid : "";
}

function getWardrobeCacheId(user, wardrobeId) {
  return [getOpenId(user), wardrobeId || ""].join(":");
}

function getCategoryCacheId(user, wardrobeId, category) {
  return [getOpenId(user), wardrobeId || "", category || ""].join(":");
}

function getItemCacheId(user, wardrobeId, itemId) {
  return [getOpenId(user), wardrobeId || "", itemId || ""].join(":");
}

function itemSourceUpdatedAt(item) {
  return item && (item.updatedAt || item.statusUpdatedAt || item.createTime || "") || "";
}

function itemsSourceUpdatedAt(items) {
  return (items || []).map(itemSourceUpdatedAt).join("|");
}

function upsertItem(items, item) {
  if (!item || !item._id) return items || [];
  const source = items || [];
  let found = false;
  const next = source.map(current => {
    if (!current || current._id !== item._id) return current;
    found = true;
    return { ...current, ...item };
  });
  if (!found) next.push(item);
  return next;
}

function removeItem(items, itemId) {
  return (items || []).filter(item => item && item._id !== itemId);
}

function uniqueCategories(categories) {
  const result = [];
  (categories || []).forEach(category => {
    if (category && result.indexOf(category) < 0) result.push(category);
  });
  return result;
}

function patchCategoryCount(categories, categoryName, delta) {
  if (!categoryName || !delta) return categories || [];
  let found = false;
  const next = (categories || []).map((category, index) => {
    const name = typeof category === "string" ? category : category && category.name;
    if (name !== categoryName) return category;
    found = true;
    if (typeof category === "string") return category;
    const count = Math.max(0, (category.count || category.itemCount || 0) + delta);
    return {
      ...category,
      count,
      itemCount: count,
      sort_order: typeof category.sort_order === "number" ? category.sort_order : index
    };
  });
  if (!found && delta > 0) {
    next.push({
      name: categoryName,
      count: delta,
      itemCount: delta,
      sort_order: next.length
    });
  }
  return next;
}

function patchCategoryNamesCache(user, wardrobeId, categories) {
  const names = uniqueCategories((categories || []).map(category =>
    typeof category === "string" ? category : category && category.name
  ));
  if (names.length === 0) return;
  setCache("wardrobe-categories", getWardrobeCacheId(user, wardrobeId), { categories: names });
}

function patchWardrobeIndex(user, wardrobeId, updater) {
  const cacheId = getWardrobeCacheId(user, wardrobeId);
  const cached = getCache("wardrobe-index", cacheId);
  if (!cached) return;
  const next = updater({
    ...cached,
    wardrobe: cached.wardrobe || {},
    categories: cached.categories || [],
    items: cached.items || []
  });
  if (!next) return;
  const wardrobe = {
    ...(next.wardrobe || {}),
    updatedAt: Date.now()
  };
  const sourceUpdatedAt = wardrobe.updatedAt || next.sourceUpdatedAt || "";
  setCache("wardrobe-index", cacheId, {
    ...next,
    wardrobe,
    sourceUpdatedAt
  }, { sourceUpdatedAt });
  removeCache("wardrobe-index", wardrobeId);
}

function patchCategoryItems(user, wardrobeId, category, updater) {
  if (!category) return;
  const cacheId = getCategoryCacheId(user, wardrobeId, category);
  const cached = getCache("category-items", cacheId);
  if (!cached || !cached.items) return;
  const items = updater(cached.items || []);
  const sourceUpdatedAt = itemsSourceUpdatedAt(items);
  setCache("category-items", cacheId, {
    ...cached,
    items,
    sourceUpdatedAt
  }, { sourceUpdatedAt });
}

function patchManageCache(user, wardrobeId, updater) {
  const cacheId = getWardrobeCacheId(user, wardrobeId);
  const cached = getCache("manage-wardrobe", cacheId);
  if (!cached) {
    removeCache("manage-preview", cacheId);
    return;
  }
  const next = updater({
    ...cached,
    wardrobe: cached.wardrobe || {},
    categories: cached.categories || [],
    totalItems: typeof cached.totalItems === "number" ? cached.totalItems : 0
  });
  if (!next) return;
  setCache("manage-wardrobe", cacheId, next);
  removeCache("manage-preview", cacheId);
  patchCategoryNamesCache(user, wardrobeId, next.categories || []);
}

function setItemDetailCache(user, wardrobeId, item) {
  if (!item || !item._id) return;
  const sourceUpdatedAt = itemSourceUpdatedAt(item);
  setCache("item-detail", getItemCacheId(user, wardrobeId, item._id), {
    item,
    sourceUpdatedAt
  }, { sourceUpdatedAt });
}

function patchAfterItemCreate(user, wardrobeId, item) {
  if (!item || !item._id) return;
  patchWardrobeIndex(user, wardrobeId, cached => ({
    ...cached,
    categories: uniqueCategories((cached.categories || []).concat(item.category)),
    items: upsertItem(cached.items, item)
  }));
  patchCategoryItems(user, wardrobeId, item.category, items => upsertItem(items, item));
  patchManageCache(user, wardrobeId, cached => ({
    ...cached,
    categories: patchCategoryCount(cached.categories, item.category, 1),
    totalItems: (cached.totalItems || 0) + 1
  }));
  setItemDetailCache(user, wardrobeId, item);
}

function patchAfterItemUpdate(user, wardrobeId, oldItem, nextItem) {
  if (!nextItem || !nextItem._id) return;
  const oldCategory = oldItem && oldItem.category || "";
  const nextCategory = nextItem.category || "";
  patchWardrobeIndex(user, wardrobeId, cached => ({
    ...cached,
    wardrobe: {
      ...(cached.wardrobe || {}),
      selectedItemIds: nextItem.wearStatus === "in_use" || nextItem.status === "in_use"
        ? ((cached.wardrobe && cached.wardrobe.selectedItemIds) || []).filter(id => id !== nextItem._id)
        : (cached.wardrobe && cached.wardrobe.selectedItemIds) || []
    },
    categories: uniqueCategories((cached.categories || []).concat(nextCategory)),
    items: upsertItem(cached.items, nextItem)
  }));
  if (oldCategory && oldCategory !== nextCategory) {
    patchCategoryItems(user, wardrobeId, oldCategory, items => removeItem(items, nextItem._id));
  }
  patchCategoryItems(user, wardrobeId, nextCategory, items => upsertItem(items, nextItem));
  patchManageCache(user, wardrobeId, cached => {
    let categories = cached.categories || [];
    if (oldCategory && oldCategory !== nextCategory) {
      categories = patchCategoryCount(categories, oldCategory, -1);
      categories = patchCategoryCount(categories, nextCategory, 1);
    }
    return { ...cached, categories };
  });
  setItemDetailCache(user, wardrobeId, nextItem);
}

function patchAfterItemDelete(user, wardrobeId, item, options = {}) {
  if (!item || !item._id) return;
  patchWardrobeIndex(user, wardrobeId, cached => ({
    ...cached,
    wardrobe: {
      ...(cached.wardrobe || {}),
      selectedItemIds: options.selectedItemIds || (cached.wardrobe && cached.wardrobe.selectedItemIds) || []
    },
    items: removeItem(cached.items, item._id)
  }));
  patchCategoryItems(user, wardrobeId, item.category, items => removeItem(items, item._id));
  patchManageCache(user, wardrobeId, cached => ({
    ...cached,
    categories: patchCategoryCount(cached.categories, item.category, -1),
    totalItems: Math.max(0, (cached.totalItems || 0) - 1)
  }));
  removeCache("item-detail", getItemCacheId(user, wardrobeId, item._id));
}

module.exports = {
  getWardrobeCacheId,
  getCategoryCacheId,
  getItemCacheId,
  patchAfterItemCreate,
  patchAfterItemUpdate,
  patchAfterItemDelete,
  patchCategoryNamesCache,
  upsertItem,
  removeItem
};
