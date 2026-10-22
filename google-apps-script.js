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

function doPost(e) {
  try {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    let   sheet   = ss.getSheetByName(SHEET_NAME);

    // Buat sheet jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        "Timestamp",
        "Event",
        "Nama Lengkap",
        "No. WhatsApp",
        "Kategori Pengunjung",
        "Nama Perusahaan",
        "Kebutuhan Produk"
      ]);

      // Style header
      const headerRange = sheet.getRange(1, 1, 1, 7);
      headerRange.setBackground("#1A1A2E");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    sheet.appendRow([
      data.timestamp    || new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      data.event        || "Indocomtech 2026",
      data.nama         || "",
      data.whatsapp     || "",
      data.kategori     || "",
      data.perusahaan   || "",
      data.produk       || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test via GET (opsional)
function doGet() {
  return ContentService
    .createTextOutput("Howell Data Capture API is running ✅")
    .setMimeType(ContentService.MimeType.TEXT);
}
