// 公開唯讀展示版用：取代 render-perf.js 裡同名的本機寫入/同步函式。
// 這份站點沒有後端，任何寫入或價格同步動作都直接提示唯讀，不送出任何請求。
async function miniWriteJson(path, data, message) {
  alert('這是唯讀展示版本，無法儲存變更。');
  return false;
}

async function triggerShioajiPriceUpdate(btn) {
  alert('這是唯讀展示版本，價格更新請至本機版操作。');
}
