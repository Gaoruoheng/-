const STATUS_AVAILABLE = "available";
const STATUS_IN_USE = "in_use";
const STATUS_STORED = "stored";

function normalizeItemStatus(value) {
  if (value === STATUS_IN_USE || value === "using" || value === "使用中") {
    return STATUS_IN_USE;
  }
  if (value === STATUS_STORED || value === "packed" || value === "已收纳" || value === "已收钠") {
    return STATUS_STORED;
  }
  return STATUS_AVAILABLE;
}

function getStatusText(status) {
  const normalized = normalizeItemStatus(status);
  if (normalized === STATUS_IN_USE) return "使用中";
  if (normalized === STATUS_STORED) return "已收纳";
  return "在库";
}

function getStatusClass(status) {
  const normalized = normalizeItemStatus(status);
  if (normalized === STATUS_IN_USE) return "status-in-use";
  if (normalized === STATUS_STORED) return "status-stored";
  return "status-available";
}

function decorateItemStatus(item) {
  const wearStatus = normalizeItemStatus(item && (item.wearStatus || item.status));
  return {
    ...item,
    wearStatus,
    wearStatusText: getStatusText(wearStatus),
    statusClass: getStatusClass(wearStatus),
    isAvailable: wearStatus === STATUS_AVAILABLE,
    isInUse: wearStatus === STATUS_IN_USE,
    isStored: wearStatus === STATUS_STORED
  };
}

module.exports = {
  STATUS_AVAILABLE,
  STATUS_IN_USE,
  STATUS_STORED,
  normalizeItemStatus,
  getStatusText,
  getStatusClass,
  decorateItemStatus
};
