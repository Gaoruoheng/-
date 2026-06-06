function normalizePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getFileExtension(filePath) {
  const cleanPath = normalizePath(filePath).split("?")[0];
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

function isTemporaryHttpPath(filePath) {
  return /^https?:\/\/tmp\//i.test(filePath);
}

function shouldUploadImage(filePath) {
  const path = normalizePath(filePath);
  if (!path) return false;
  if (path.indexOf("cloud://") === 0) return false;
  if (path.indexOf("/images/") === 0) return false;
  if (/^https?:\/\//i.test(path) && !isTemporaryHttpPath(path)) return false;
  return true;
}

function getDisplayImage(filePath, fallback) {
  const path = normalizePath(filePath);
  const fallbackImage = fallback || "/images/default-goods-image.png";
  if (!path) return fallbackImage;
  if (path.indexOf("default_gold_placeholder") >= 0) return fallbackImage;
  if (shouldUploadImage(path)) return fallbackImage;
  return path;
}

function createCloudPath(filePath, wardrobeId) {
  const extension = getFileExtension(filePath);
  const safeWardrobeId = normalizePath(wardrobeId).replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const randomText = Math.random().toString(36).slice(2, 10);
  return "wardrobe-items/" + safeWardrobeId + "/" + Date.now() + "-" + randomText + "." + extension;
}

function createThumbCloudPath(filePath, wardrobeId) {
  const extension = getFileExtension(filePath);
  const safeWardrobeId = normalizePath(wardrobeId).replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const randomText = Math.random().toString(36).slice(2, 10);
  return "wardrobe-items/" + safeWardrobeId + "/thumb-" + Date.now() + "-" + randomText + "." + extension;
}

function compressImage(filePath, quality) {
  const path = normalizePath(filePath);
  if (!path || !wx.compressImage) return Promise.resolve(path);

  return new Promise(resolve => {
    wx.compressImage({
      src: path,
      quality,
      success: res => resolve(res.tempFilePath || path),
      fail: () => resolve(path)
    });
  });
}

async function uploadImageIfNeeded(filePath, wardrobeId) {
  const path = normalizePath(filePath);
  if (!shouldUploadImage(path)) return path;

  const uploadPath = await compressImage(path, 82);
  const res = await wx.cloud.uploadFile({
    cloudPath: createCloudPath(uploadPath, wardrobeId),
    filePath: uploadPath
  });

  return res.fileID;
}

async function uploadItemImages(filePath, wardrobeId) {
  const path = normalizePath(filePath);
  if (!shouldUploadImage(path)) {
    return {
      url: path,
      thumbUrl: path
    };
  }

  const [mainPath, thumbPath] = await Promise.all([
    compressImage(path, 82),
    compressImage(path, 38)
  ]);
  const [mainRes, thumbRes] = await Promise.all([
    wx.cloud.uploadFile({
      cloudPath: createCloudPath(mainPath, wardrobeId),
      filePath: mainPath
    }),
    wx.cloud.uploadFile({
      cloudPath: createThumbCloudPath(thumbPath, wardrobeId),
      filePath: thumbPath
    })
  ]);

  return {
    url: mainRes.fileID,
    thumbUrl: thumbRes.fileID || mainRes.fileID
  };
}

function getListImage(item, fallback) {
  if (!item) return getDisplayImage("", fallback);
  return getDisplayImage(item.thumbUrl || item.url, fallback);
}

module.exports = {
  getDisplayImage,
  getListImage,
  shouldUploadImage,
  uploadImageIfNeeded,
  uploadItemImages
};
