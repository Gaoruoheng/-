const db = wx.cloud.database();
const { uploadItemImages } = require("../../utils/cloudImage.js");
const {
  canAccessOwnedRecord,
  getVerifiedUser,
  isMissingFunctionError,
  requireVerifiedPage
} = require("../../utils/auth.js");
const { getCache, setCache, removeCache } = require("../../utils/pageCache.js");
const { backFromItemDetail } = require("../../utils/navigation.js");
const {
  patchAfterItemDelete,
  patchAfterItemUpdate
} = require("../../utils/wardrobeCache.js");

const DEFAULT_ITEM_NAME = "未命名单品";
const DEFAULT_ITEM_CATEGORY = "未分类";
const DEFAULT_ITEM_IMAGE = "/images/default-goods-image.png";

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

Page({
  data: {
    itemId: "",
    wardrobeId: "",
    item: { name: "", color: "", category: "", url: "", thumbUrl: "", notes: "" },
    originalUrl: "",
    originalThumbUrl: "",
    originalCategory: "",
    backSource: "",
    backCategory: "",
    categories: [],
    catIndex: 0
  },

  async onLoad(options) {
    if (!requireVerifiedPage()) return;
    this.setData({
      itemId: options.itemId || "",
      wardrobeId: options.wardrobeId || "",
      backSource: options.from || "",
      backCategory: decodeURIComponent(options.category || "")
    });
    const hasCache = this.hydrateItemCache();
    this.hydrateCategoriesCache();
    const ok = await this.verifyWardrobeAccess(options.wardrobeId);
    if (!ok) return;
    const categoriesPromise = this.loadCategories(options.wardrobeId);
    if (options.itemId) await this.fetchItem(options.itemId, { silent: hasCache });
    await categoriesPromise;
  },

  async verifyWardrobeAccess(wardrobeId) {
    const user = getVerifiedUser();
    if (!wardrobeId || !user) return false;
    try {
      const res = await db.collection("wardrobe_hubs").doc(wardrobeId).get();
      if (canAccessOwnedRecord(res.data, user)) return true;
    } catch (err) {
      console.error(err);
    }
    wx.showToast({ title: "无权访问这个衣柜", icon: "none" });
    wx.reLaunch({ url: "/pages/home/home" });
    return false;
  },

  getCategoryCacheId(category) {
    const user = getVerifiedUser();
    return [
      user && user.openid ? user.openid : "",
      this.data.wardrobeId,
      category || ""
    ].join(":");
  },

  getWardrobeCacheId() {
    const user = getVerifiedUser();
    return [
      user && user.openid ? user.openid : "",
      this.data.wardrobeId
    ].join(":");
  },

  getItemCacheId() {
    const user = getVerifiedUser();
    return [
      user && user.openid ? user.openid : "",
      this.data.wardrobeId,
      this.data.itemId
    ].join(":");
  },

  applyItem(item) {
    if (!this.canUseItem(item)) return false;
    const catIndex = this.data.categories.indexOf(item.category);
    this.setData({
      item,
      originalUrl: item.url || "",
      originalThumbUrl: item.thumbUrl || "",
      originalCategory: item.category || "",
      catIndex: catIndex >= 0 ? catIndex : this.data.catIndex
    });
    return true;
  },

  applyCategories(categories) {
    const cats = (categories || []).filter(name => !!name);
    const currentCategory = this.data.item.category || this.data.originalCategory;
    if (currentCategory && cats.indexOf(currentCategory) < 0) {
      cats.push(currentCategory);
    }
    const catIndex = cats.indexOf(currentCategory);
    this.setData({
      categories: cats,
      catIndex: catIndex >= 0 ? catIndex : this.data.catIndex
    });
  },

  hydrateCategoriesCache() {
    const cacheId = this.getWardrobeCacheId();
    const cachedCategories = getCache("wardrobe-categories", cacheId, { maxAge: 1000 * 60 * 30 });
    if (cachedCategories && cachedCategories.categories) {
      this.applyCategories(cachedCategories.categories);
      return true;
    }

    const wardrobeCache = getCache("wardrobe-index", cacheId, { maxAge: 1000 * 60 * 30 });
    if (wardrobeCache && wardrobeCache.categories) {
      this.applyCategories(wardrobeCache.categories);
      return true;
    }
    return false;
  },

  cacheCategories(categories) {
    setCache("wardrobe-categories", this.getWardrobeCacheId(), { categories });
  },

  hydrateItemCache() {
    const cached = getCache("item-detail", this.getItemCacheId(), { maxAge: 1000 * 60 * 30 });
    if (!cached || !cached.item) return false;
    return this.applyItem(cached.item);
  },

  cacheItem(item) {
    if (!this.canUseItem(item)) return;
    const sourceUpdatedAt = item.updatedAt || item.statusUpdatedAt || item.createTime || "";
    setCache("item-detail", this.getItemCacheId(), { item, sourceUpdatedAt }, { sourceUpdatedAt });
  },

  clearItemCaches(extraCategories) {
    const user = getVerifiedUser();
    const categories = [this.data.originalCategory, this.data.item.category]
      .concat(extraCategories || [])
      .filter(category => !!category);
    const seen = {};

    categories.forEach(category => {
      if (seen[category]) return;
      seen[category] = true;
      removeCache("category-items", this.getCategoryCacheId(category));
    });

    if (user && user.openid) {
      const wardrobeCacheId = [user.openid, this.data.wardrobeId].join(":");
      removeCache("wardrobe-index", wardrobeCacheId);
      removeCache("manage-wardrobe", wardrobeCacheId);
      removeCache("manage-preview", wardrobeCacheId);
    }
    removeCache("wardrobe-index", this.data.wardrobeId);
    removeCache("item-detail", this.getItemCacheId());
  },

  notifyPreviousPages(change) {
    const pages = getCurrentPages();
    for (let index = pages.length - 2; index >= 0; index -= 1) {
      const page = pages[index];
      if (page && typeof page.applyItemMutationFromChild === "function") {
        page.applyItemMutationFromChild(change);
      }
    }
  },

  showWriteError(err, fallback) {
    if (err && err.code === "FORBIDDEN") {
      wx.showToast({ title: "无权操作这个衣柜", icon: "none" });
    } else if (err && err.code === "ITEM_NOT_FOUND") {
      wx.showToast({ title: "衣服不存在", icon: "none" });
    } else if (isMissingFunctionError(err) || (err && err.code === "WRITE_UNAVAILABLE")) {
      wx.showToast({ title: "请重新部署云函数", icon: "none" });
    } else {
      wx.showToast({ title: fallback, icon: "none" });
    }
  },

  canUseItem(item) {
    return !!item &&
      item._id === this.data.itemId &&
      item.wardrobeId === this.data.wardrobeId;
  },

  denyItemAccess() {
    wx.showToast({ title: "无权访问这件衣服", icon: "none" });
    wx.reLaunch({ url: "/pages/home/home" });
  },

  async loadCategories(wardrobeId) {
    try {
      const res = await db.collection("wardrobe_categories")
        .where({ wardrobeId }).orderBy("sort_order", "asc").get();
      const cats = res.data.map(c => c.name);
      this.applyCategories(cats);
      this.cacheCategories(cats);
    } catch (e) {}
  },

  async fetchItem(id, options = {}) {
    if (!options.silent) wx.showLoading({ title: "加载中", mask: true });
    try {
      const res = await db.collection("wardrobe_items").doc(id).get();
      const item = res.data;
      if (!this.canUseItem(item)) {
        this.denyItemAccess();
        return;
      }
      this.applyItem(item);
      this.cacheItem(item);
    } catch (e) {
      console.error(e);
    } finally {
      if (!options.silent) wx.hideLoading();
    }
  },

  changeImage() {
    wx.chooseMedia({
      count: 1, mediaType: ["image"], sourceType: ["album", "camera"],
      success: (res) => {
        this.setData({ "item.url": res.tempFiles[0].tempFilePath });
      }
    });
  },

  onNameInput(e) { this.setData({ "item.name": e.detail.value }); },
  onColorInput(e) { this.setData({ "item.color": e.detail.value }); },
  onNotesInput(e) { this.setData({ "item.notes": e.detail.value }); },
  onCategoryChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ catIndex: idx, "item.category": this.data.categories[idx] });
  },

  async saveItem() {
    const { itemId, item, categories, catIndex, wardrobeId, originalCategory } = this.data;
    if (!this.canUseItem(item)) {
      this.denyItemAccess();
      return;
    }

    wx.showLoading({ title: "保存中", mask: true });
    try {
      const category = categories[catIndex] || item.category || originalCategory || DEFAULT_ITEM_CATEGORY;
      const imageChanged = item.url && item.url !== this.data.originalUrl;
      const imageData = imageChanged
        ? await uploadItemImages(item.url, wardrobeId)
        : { url: item.url || DEFAULT_ITEM_IMAGE, thumbUrl: item.thumbUrl || item.url || DEFAULT_ITEM_IMAGE };
      const nextItem = {
        name: normalizeText(item.name) || DEFAULT_ITEM_NAME,
        color: normalizeText(item.color),
        category,
        notes: normalizeText(item.notes),
        url: imageData.url,
        thumbUrl: imageData.thumbUrl || imageData.url
      };

      const callRes = await wx.cloud.callFunction({
        name: "quickstartFunctions",
        data: {
          type: "updateItem",
          wardrobeId,
          itemId,
          item: nextItem
        }
      });
      const result = callRes.result || {};
      if (!result.success) {
        const updateErr = new Error(result.code || "WRITE_UNAVAILABLE");
        updateErr.code = result.code || "WRITE_UNAVAILABLE";
        throw updateErr;
      }

      const user = getVerifiedUser();
      const oldItem = {
        ...item,
        _id: itemId,
        wardrobeId,
        category: originalCategory,
        url: this.data.originalUrl,
        thumbUrl: this.data.originalThumbUrl
      };
      if (result.item) {
        patchAfterItemUpdate(user, wardrobeId, oldItem, result.item);
        this.notifyPreviousPages({
          type: "update",
          item: result.item,
          oldItem,
          oldCategory: originalCategory
        });
      } else {
        this.clearItemCaches([category, originalCategory]);
      }
      wx.hideLoading();
      wx.showToast({ title: "已保存", icon: "success" });
      this.goBack();
    } catch (e) {
      console.error(e);
      wx.hideLoading();
      this.showWriteError(e, "保存失败");
    }
  },

  deleteItem() {
    if (!this.canUseItem(this.data.item)) {
      this.denyItemAccess();
      return;
    }

    wx.showModal({
      title: "删除衣服",
      content: "确定删除这件衣服吗？删除后不能恢复。",
      confirmText: "删除",
      confirmColor: "#E76F7A",
      cancelText: "取消",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "删除中", mask: true });
        try {
          const deletedItem = {
            ...this.data.item,
            _id: this.data.itemId,
            wardrobeId: this.data.wardrobeId,
            category: this.data.originalCategory || this.data.item.category
          };
          const callRes = await wx.cloud.callFunction({
            name: "quickstartFunctions",
            data: {
              type: "deleteItem",
              wardrobeId: this.data.wardrobeId,
              itemId: this.data.itemId
            }
          });
          const result = callRes.result || {};
          if (!result.success) {
            const deleteErr = new Error(result.code || "WRITE_UNAVAILABLE");
            deleteErr.code = result.code || "WRITE_UNAVAILABLE";
            throw deleteErr;
          }

          patchAfterItemDelete(getVerifiedUser(), this.data.wardrobeId, deletedItem, {
            selectedItemIds: result.selectedItemIds
          });
          this.notifyPreviousPages({
            type: "delete",
            item: deletedItem,
            itemId: this.data.itemId,
            selectedItemIds: result.selectedItemIds
          });
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          this.goBack();
        } catch (e) {
          console.error(e);
          wx.hideLoading();
          this.showWriteError(e, "删除失败");
        }
      }
    });
  },

  goBack() {
    backFromItemDetail({
      wardrobeId: this.data.wardrobeId,
      source: this.data.backSource,
      categoryName: this.data.backCategory || this.data.originalCategory || this.data.item.category
    });
  }
});
