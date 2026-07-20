// 公開唯讀展示版用：取代本機寫入/同步函式。
// 這份站點沒有後端，任何寫入、報價更新或策略重跑都直接提示唯讀。
async function miniWriteJson(path, data, message) {
  alert('這是唯讀展示版本，無法儲存變更。');
  return false;
}

async function triggerShioajiPriceUpdate(btn) {
  alert('這是唯讀展示版本，策略更新請至本機版操作。');
}

async function triggerPriceRefresh(btn) {
  alert('這是唯讀展示版本，價格更新請至本機版操作。');
}
