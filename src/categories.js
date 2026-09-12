// categories.js
// Shared jewelry category tree, used by both the "Add data" page (to build
// mandatory tags) and the "Search" page (to build an optional filter).
// Structure: type -> { hasStyle, styles?, colors }

const CATEGORY_TREE = {
  "สร้อย": {
    hasStyle: false,
    colors: ["สีทอง", "สีเงิน"],
  },
  "ต่างหู": {
    hasStyle: true,
    styles: ["แบบเดี่ยว", "แบบคู่", "แบบแผง", "แบบหนีบ"],
    colors: ["สีทอง", "สีเงิน"],
  },
  "กำไลข้อมือ": {
    hasStyle: true,
    styles: ["แบบวง", "แบบเส้น"],
    colors: ["สีทอง", "สีเงิน"],
  },
  "แหวน": {
    hasStyle: false,
    colors: ["สีทอง", "สีเงิน"],
  },
};

const MAIN_CATEGORY = "จิวเวลรี่";

window.CategoryTree = { CATEGORY_TREE, MAIN_CATEGORY };
