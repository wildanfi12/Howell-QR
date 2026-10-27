/**
 * ═══════════════════════════════════════════════════════════
 *  HOWELL DATA CAPTURE — Google Apps Script
 *  Otomatis simpan data form ke Google Sheets
 * ═══════════════════════════════════════════════════════════
 *
 *  CARA PAKAI:
 *  1. Buka Google Sheets baru → Extensions → Apps Script
 *  2. Copy-paste seluruh kode ini
 *  3. Klik Deploy → New Deployment → Web App
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4. Copy URL yang diberikan
 *  5. Tempel URL ke variabel SHEET_URL di index.html
 * ═══════════════════════════════════════════════════════════
 */

const SHEET_NAME = "Leads Indocomtech 2026";
const SITE_ORIGIN = "https://howellcable.site";
const SITE_ORIGINS = [SITE_ORIGIN, "https://registrasi.howellcable.site"];
const ACK_CACHE_SECONDS = 21600;
const VALID_CATEGORIES = ["End User", "Retailer", "Corporate IT", "Lainnya"];
const VALID_PRODUCTS = [
  "HDMI", "LAN & Patch Cable", "DisplayPort", "Power & PDU", "USB & Data",
  "Audio Solutions", "Adapters", "TWS & Audio", "DVI & VGA"
];

function doPost(e) {
  const data = readRequestData_(e);
  const siteOrigin = SITE_ORIGINS.includes(data.siteOrigin) ? data.siteOrigin : SITE_ORIGIN;
  const requestId = String(data.requestId || "");
  const validRequestId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
  if (requestId && !validRequestId) return acknowledgement_("error", "", siteOrigin);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    const cacheKey = validRequestId ? "lead:" + requestId : "";
    if (cacheKey && cache.get(cacheKey)) return acknowledgement_("success", requestId, siteOrigin);

    const lead = validateLead_(data);
    if (!lead) return acknowledgement_("error", validRequestId ? requestId : "", siteOrigin);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      sheet.appendRow([
        "Timestamp", "Event", "Nama Lengkap", "No. WhatsApp",
        "Kategori Pengunjung", "Nama Perusahaan", "Kebutuhan Produk"
      ]);
      const headerRange = sheet.getRange(1, 1, 1, 7);
      headerRange.setBackground("#1A1A2E");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      "Indocomtech 2026",
      safeSheetText_(lead.nama),
      lead.whatsapp,
      lead.kategori,
      safeSheetText_(lead.perusahaan),
      lead.produk.join(", ")
    ]);
    if (cacheKey) {
      try { cache.put(cacheKey, "saved", ACK_CACHE_SECONDS); } catch (err) {}
    }
    return acknowledgement_("success", validRequestId ? requestId : "", siteOrigin);
  } catch (err) {
    return acknowledgement_("error", validRequestId ? requestId : "", siteOrigin);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function readRequestData_(e) {
  if (!e) return {};
  const params = e.parameter || {};
  const body = e.postData && e.postData.contents;
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.assign({}, parsed, params);
      }
    } catch (err) {
      // Standard HTML form posts are supplied in e.parameter.
    }
  }
  return params;
}

function normalizeWhatsApp_(value) {
  const raw = String(value || "").trim();
  if (!/^\+?[0-9\s().-]+$/.test(raw)) return "";
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.startsWith("62")
    ? digits
    : digits.startsWith("0")
      ? "62" + digits.slice(1)
      : "";
  return /^628[1-9]\d{6,10}$/.test(normalized) ? normalized : "";
}

function validateLead_(data) {
  const nama = String(data.nama || "").trim();
  const perusahaan = String(data.perusahaan || "").trim();
  const kategori = String(data.kategori || "");
  const whatsapp = normalizeWhatsApp_(data.whatsapp);
  const submittedProducts = String(data.produk || "")
    .split(",")
    .map(product => product.trim())
    .filter((product, index, products) => product && products.indexOf(product) === index);

  if (nama.length < 2 || perusahaan.length < 2 || !whatsapp) return null;
  if (!VALID_CATEGORIES.includes(kategori)) return null;
  if (!submittedProducts.length || submittedProducts.some(product => !VALID_PRODUCTS.includes(product))) return null;
  return { nama, perusahaan, kategori, whatsapp, produk: submittedProducts };
}

function safeSheetText_(value) {
  return /^\s*[=+\-@]/.test(value) ? "'" + value : value;
}

function acknowledgement_(status, requestId, siteOrigin) {
  const message = JSON.stringify({
    source: "howell-data-capture",
    status: status === "success" ? "success" : "error",
    requestId: requestId
  });
  const html = '<!doctype html><html><body><script>window.parent.postMessage(' +
    message + ', "' + (SITE_ORIGINS.includes(siteOrigin) ? siteOrigin : SITE_ORIGIN) + '");</scr' + 'ipt></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Test via GET (opsional)
function doGet() {
  return ContentService
    .createTextOutput("Howell Data Capture API is running ✅")
    .setMimeType(ContentService.MimeType.TEXT);
}
