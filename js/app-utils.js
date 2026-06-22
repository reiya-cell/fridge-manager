(function exposeAppUtilities(global) {
  const iso = value => {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };

  const addDays = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return iso(date);
  };

  function normalizeFoodText(value) {
    return String(value || '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
      .replace(/[\s・ー]/g, '');
  }

  function readStoredItems(fallback = []) {
    try {
      const raw = localStorage.getItem('fridge-items') || localStorage.getItem('fridgeItems') || localStorage.getItem('fridgeInventory');
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.items)) return parsed.items;
      return fallback;
    } catch { return fallback; }
  }

  function readStoredObject(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  function remaining(item) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(`${item.expiry}T00:00:00`);
    return Math.round((expiry - today) / 86400000);
  }

  function freshnessFor(days) {
    const status = days < 0 ? `${Math.abs(days)}日超過` : days === 0 ? '今日まで' : `あと${days}日`;
    if (days <= 0) return { tone: 'red', label: '要確認', status };
    if (days <= 3) return { tone: 'yellow', label: 'そろそろ使用', status };
    return { tone: 'blue', label: '余裕あり', status };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  global.FridgeUtils = { iso, addDays, normalizeFoodText, readStoredItems, readStoredObject, remaining, freshnessFor, escapeHtml };
})(globalThis);
