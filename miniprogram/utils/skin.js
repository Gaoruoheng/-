const SKIN_STORAGE_KEY = "kuma_closet_home_skin";
const DEFAULT_SKIN = "cream-house";
const PRINCESS_CASTLE_SKIN = "princess-castle";
const SKIN_OPTIONS = [
  {
    id: DEFAULT_SKIN,
    name: "奶油小屋",
    desc: "原来的软萌可爱风"
  },
  {
    id: PRINCESS_CASTLE_SKIN,
    name: "公主城堡衣橱",
    desc: "城堡、台阶、魔法星尘"
  }
];

function normalizeSkinId(value) {
  return SKIN_OPTIONS.some(item => item.id === value) ? value : DEFAULT_SKIN;
}

function getSelectedSkin() {
  try {
    return normalizeSkinId(wx.getStorageSync(SKIN_STORAGE_KEY));
  } catch (err) {
    console.warn("read home skin failed", err);
    return DEFAULT_SKIN;
  }
}

function setSelectedSkin(value) {
  const selectedSkin = normalizeSkinId(value);
  try {
    wx.setStorageSync(SKIN_STORAGE_KEY, selectedSkin);
  } catch (err) {
    console.warn("save home skin failed", err);
  }
  return selectedSkin;
}

function syncPageSkin(page) {
  const selectedSkin = getSelectedSkin();
  if (page && page.data && page.data.selectedSkin !== selectedSkin) {
    page.setData({ selectedSkin });
  }
  return selectedSkin;
}

module.exports = {
  DEFAULT_SKIN,
  PRINCESS_CASTLE_SKIN,
  SKIN_OPTIONS,
  SKIN_STORAGE_KEY,
  getSelectedSkin,
  normalizeSkinId,
  setSelectedSkin,
  syncPageSkin
};
