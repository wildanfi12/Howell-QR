const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "google-apps-script.js"), "utf8");
const clientSource = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class FakeElement {
  constructor(tagName, id) {
    this.tagName = tagName;
    this.id = id || "";
    this.value = "";
    this.name = "";
    this.type = "";
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.removed = false;
    this.classNames = new Set();
    this.classList = {
      add: name => this.classNames.add(name),
      remove: name => this.classNames.delete(name),
      contains: name => this.classNames.has(name),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !this.classNames.has(name) : force;
        if (shouldAdd) this.classNames.add(name);
        else this.classNames.delete(name);
        return shouldAdd;
      }
    };
    if (tagName === "iframe") this.contentWindow = { location: { href: "about:blank" } };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
  scrollIntoView() {}
  submit() { this.submitted = true; }
}

function makeClient() {
  const ids = ["nama", "wa", "co", "e-nama", "e-wa", "e-kat", "e-co", "e-pr",
    "e-submit", "btn-sub", "spin", "btn-ico", "btn-txt", "scr-form",
    "scr-success", "summary"];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement("div", id)]));
  elements.nama.value = "Budi Santoso";
  elements.wa.value = "081234567890";
  elements.co.value = "Howell Demo";
  elements["btn-txt"].textContent = "Kirim Data";
  elements["scr-success"].classList.remove("show");
  const radios = [{ value: "End User" }];
  const products = [{ value: "HDMI" }, { value: "Power & PDU" }];
  const allInputs = [elements.nama, elements.wa, elements.co,
    ...radios.map(item => Object.assign(new FakeElement("input"), item)),
    ...products.map(item => Object.assign(new FakeElement("input"), item))];
  const body = new FakeElement("body");
  const document = {
    body,
    getElementById(id) { return elements[id] || (elements[id] = new FakeElement("div", id)); },
    createElement(tag) { return new FakeElement(tag); },
    querySelector(selector) {
      return selector === 'input[name="kat"]:checked' ? radios[0] : null;
    },
    querySelectorAll(selector) {
      if (selector === "input") return allInputs;
      if (selector === 'input[name="pr"]:checked') return products;
      if (selector === 'input[type=text], input[type=tel]') return [elements.nama, elements.wa, elements.co];
      if (selector === 'input[type=radio], input[type=checkbox]') return allInputs.slice(3);
      if (selector === ".err-msg") return ["e-nama", "e-wa", "e-kat", "e-co", "e-pr", "e-submit"].map(id => elements[id]);
      if (selector === ".err") return [elements.nama, elements.wa, elements.co].filter(el => el.classList.contains("err"));
      return [];
    }
  };
  const listeners = {};
  const timers = new Map();
  let nextTimer = 1;
  const window = {
    location: { origin: "https://howellcable.site" },
    addEventListener(name, handler) { listeners[name] = handler; },
    scrollTo() {}
  };
  const context = {
    document, window, crypto: webcrypto, console, URL,
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    Date
  };
  vm.runInNewContext(clientSource, context, { filename: "index.html inline script" });
  return { context, elements, listeners, timers, body };
}

function makeGas(options = {}) {
  const rows = (options.rows || []).map(row => row.slice());
  const cache = new Map();
  const lockStats = { waits: 0, releases: 0 };
  const sheet = {
    appendRow(row) {
      if (options.failWrite) throw new Error("private spreadsheet failure details");
      rows.push(row);
    },
    getLastRow() { return rows.length ? rows.length + 1 : 1; },
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        getDisplayValues() {
          return Array.from({ length: rowCount }, (_, offset) => [
            rows[startRow - 2 + offset]?.[startColumn - 1] ?? ""
          ]);
        },
        setBackground() {}, setFontColor() {}, setFontWeight() {}
      };
    },
    setFrozenRows() {}
  };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return { getSheetByName: () => sheet, insertSheet: () => sheet };
      }
    },
    CacheService: {
      getScriptCache() {
        return {
          get: key => cache.get(key) || null,
          put: (key, value) => {
            if (options.failCacheWrite) throw new Error("cache unavailable");
            cache.set(key, value);
          }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() { lockStats.waits += 1; },
          releaseLock() { lockStats.releases += 1; }
        };
      }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
      createHtmlOutput(html) {
        return {
          html,
          setXFrameOptionsMode(mode) { this.mode = mode; return this; }
        };
      }
    },
    ContentService: { createTextOutput: text => ({ text, setMimeType() { return this; } }), MimeType: { TEXT: "text" } },
    Date
  };
  vm.runInNewContext(gasSource, context, { filename: "google-apps-script.js" });
  return { context, rows, cache, lockStats };
}

const lead = {
  nama: "Budi Santoso",
  whatsapp: "+62 812 3456 7890",
  kategori: "End User",
  perusahaan: "Howell Demo",
  produk: "HDMI, Power & PDU",
  requestId: "a2366f7a-f650-4ecf-9081-2e2b783e2e17"
};

test("live HTML retains all required visitor fields and product options", () => {
  for (const id of ["nama", "wa", "co"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /name="kat"/);
  assert.equal((html.match(/<input type="checkbox" name="pr"/g) || []).length, 9);
  assert.doesNotMatch(html, /placeholder="Contoh:/);
});

test("phone normalization accepts Indonesian 08, 628, and +62 forms", () => {
  const client = makeClient().context;
  for (const input of ["081234567890", "6281234567890", "+62 812 3456 7890"]) {
    assert.equal(client.normalizeWhatsApp(input), "6281234567890");
  }
  for (const input of ["08123", "+1 2125551212", "81234567890", "6280123456789", "abc081234567890", "+62+81234567890"]) {
    assert.equal(client.normalizeWhatsApp(input), "");
  }
});

test("empty form is rejected and identifies the first invalid field", () => {
  const { context, elements } = makeClient();
  elements.nama.value = "";
  assert.equal(context.validate(), false);
  assert.equal(elements.nama.attributes["aria-invalid"], "true");
  assert.equal(elements.nama.focused, true);
  assert.equal(elements["e-nama"].style.display, "block");
});

test("client sends canonical phone and waits for a trusted matching acknowledgement", async () => {
  const { context, elements, listeners, body } = makeClient();
  await context.submitForm();
  const frame = body.children.find(el => el.tagName === "iframe");
  const form = body.children.find(el => el.tagName === "form");
  assert.ok(frame && form && form.submitted);
  const fields = Object.fromEntries(form.children.map(field => [field.name, field.value]));
  assert.equal(fields.whatsapp, "6281234567890");
  assert.equal(fields.produk, "HDMI, Power & PDU");
  assert.equal(fields.siteOrigin, "https://howellcable.site");
  assert.ok(fields.requestId);
  assert.equal(elements["scr-success"].classList.contains("show"), false);

  listeners.message({
    origin: "https://attacker.example",
    source: frame.contentWindow,
    data: { source: "howell-data-capture", status: "success", requestId: fields.requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), false);

  listeners.message({
    origin: "https://script.googleusercontent.com",
    source: {},
    data: { source: "howell-data-capture", status: "success", requestId: fields.requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), true);
  assert.equal(frame.removed, true);
});

test("failed server acknowledgement shows an error instead of success", async () => {
  const { context, elements, listeners, body } = makeClient();
  await context.submitForm();
  const frame = body.children.find(el => el.tagName === "iframe");
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;
  listeners.message({
    origin: "https://script.googleusercontent.com",
    source: frame.contentWindow,
    data: { source: "howell-data-capture", status: "error", requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), false);
  assert.equal(elements["e-submit"].style.display, "block");
  assert.equal(elements["btn-sub"].disabled, false);
});

test("already registered acknowledgement shows the discount eligibility message without success", async () => {
  const { context, elements, listeners, body } = makeClient();
  await context.submitForm();
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;

  listeners.message({
    origin: "https://script.google.com",
    data: { source: "howell-data-capture", status: "already_registered", requestId }
  });

  assert.equal(elements["scr-success"].classList.contains("show"), false);
  assert.equal(elements["e-submit"].style.display, "block");
  assert.match(elements["e-submit"].textContent, /satu kali untuk memperoleh diskon 25%/);
  assert.equal(elements["btn-sub"].disabled, false);
});

test("sandboxed Apps Script acknowledgement with opaque origin is accepted only for the active request", async () => {
  const { context, elements, listeners, body } = makeClient();
  await context.submitForm();
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;

  listeners.message({
    origin: "null",
    data: { source: "howell-data-capture", status: "success", requestId: "wrong-request-id" }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), false);

  listeners.message({
    origin: "null",
    data: { source: "howell-data-capture", status: "success", requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), true);
});

test("Apps Script acknowledgement from its changing googleusercontent host is accepted", async () => {
  const { context, elements, listeners, body } = makeClient();
  await context.submitForm();
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;

  listeners.message({
    origin: "https://n-123abc-script.googleusercontent.com",
    data: { source: "howell-data-capture", status: "success", requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), true);
});

test("unanswered request times out visibly and does not show a false success", async () => {
  const { context, elements, timers } = makeClient();
  await context.submitForm();
  const callback = [...timers.values()][0];
  callback();
  assert.equal(elements["scr-success"].classList.contains("show"), false);
  assert.equal(elements["e-submit"].style.display, "block");
  assert.match(elements["e-submit"].textContent, /belum dapat dipastikan/);
  assert.equal(elements["btn-sub"].disabled, false);
});

test("late acknowledgement after iframe load still changes pending state to success", async () => {
  const { context, elements, listeners, body, timers } = makeClient();
  await context.submitForm();
  const frame = body.children.find(el => el.tagName === "iframe");
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;
  Object.defineProperty(frame.contentWindow, "location", {
    get() { throw new Error("cross-origin frame"); }
  });
  frame.listeners.load();
  const callback = [...timers.values()].at(-1);
  callback();
  assert.equal(elements["scr-success"].classList.contains("show"), false);
  assert.equal(elements["btn-sub"].disabled, true);
  assert.equal(elements["btn-txt"].textContent, "Memeriksa Status...");
  assert.match(elements["e-submit"].textContent, /jangan kirim ulang dulu/);

  listeners.message({
    origin: "https://n-123abc-script.googleusercontent.com",
    source: frame.contentWindow,
    data: { source: "howell-data-capture", status: "success", requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), true);
  assert.equal(frame.removed, true);
});

test("double submission is ignored while the first request is pending", async () => {
  const { context, body } = makeClient();
  await context.submitForm();
  await context.submitForm();
  assert.equal(body.children.filter(el => el.tagName === "form").length, 1);
});

test("reset clears input values, selections, errors, and success state", () => {
  const { context, elements } = makeClient();
  elements.nama.value = "Test Nama";
  elements.wa.value = "6281234567890";
  elements.co.value = "Test Company";
  elements["scr-form"].style.display = "none";
  elements["scr-success"].classList.add("show");
  elements["btn-sub"].disabled = true;
  context.resetForm();
  assert.equal(elements.nama.value, "");
  assert.equal(elements.wa.value, "");
  assert.equal(elements.co.value, "");
  assert.equal(elements["scr-form"].style.display, "");
  assert.equal(elements["scr-success"].classList.contains("show"), false);
  assert.equal(elements["btn-sub"].disabled, false);
  assert.equal(elements["btn-txt"].textContent, "Kirim Data");
});

test("Apps Script validates data, normalizes phone, and escapes spreadsheet formulas", () => {
  const { context, rows } = makeGas();
  const result = context.doPost({ parameter: Object.assign({}, lead, { nama: "=HYPERLINK(\"https://bad.example\")", event: "forged", timestamp: "forged" }) });
  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], "Indocomtech 2026");
  assert.match(rows[0][0], /2026/);
  assert.equal(rows[0][2], "'=HYPERLINK(\"https://bad.example\")");
  assert.equal(rows[0][3], "6281234567890");
  assert.equal(rows[0][6], "HDMI, Power & PDU");
  assert.match(result.html, /"status":"success"/);
  assert.equal(result.mode, "ALLOWALL");
});

test("Apps Script phone validator accepts 08, 628, and +62 input", () => {
  const { context } = makeGas();
  for (const input of ["081234567890", "6281234567890", "+62 812 3456 7890"]) {
    assert.equal(context.normalizeWhatsApp_(input), "6281234567890");
  }
  for (const input of ["abc081234567890", "+62+81234567890"]) {
    assert.equal(context.normalizeWhatsApp_(input), "");
  }
});

test("Apps Script rejects invalid phone, category, company, and products without writing", () => {
  const { context, rows } = makeGas();
  const invalidRequests = [
    { whatsapp: "555" },
    { kategori: "Unknown" },
    { perusahaan: "" },
    { produk: "=IMPORTXML()" }
  ];
  const results = invalidRequests.map((overrides, index) => context.doPost({
    parameter: Object.assign({}, lead, overrides, {
      requestId: "a2366f7a-f650-4ecf-9081-2e2b783e2e" + (18 + index)
    })
  }));
  assert.equal(rows.length, 0);
  for (const result of results) assert.match(result.html, /"status":"error"/);
});

test("Apps Script idempotency key prevents duplicate sheet rows", () => {
  const { context, rows } = makeGas();
  const event = { parameter: lead };
  context.doPost(event);
  const retry = context.doPost(event);
  assert.equal(rows.length, 1);
  assert.match(retry.html, /"status":"success"/);
});

test("duplicate WhatsApp is rejected when the stored number uses a different format", () => {
  const existing = ["2026-10-27", "Indocomtech 2026", "Registrant One", "0812 3456-7890", "End User", "Company A", "HDMI"];
  const { context, rows } = makeGas({ rows: [existing] });
  const result = context.doPost({ parameter: Object.assign({}, lead, { requestId: "a2366f7a-f650-4ecf-9081-2e2b783e2e18" }) });

  assert.equal(rows.length, 1);
  assert.match(result.html, /"status":"already_registered"/);
  assert.match(result.html, /"requestId":"a2366f7a-f650-4ecf-9081-2e2b783e2e18"/);
});

test("duplicate WhatsApp is rejected even when all other registration data changes", () => {
  const existing = ["2026-10-27", "Indocomtech 2026", "Registrant One", "6281234567890", "End User", "Company A", "HDMI"];
  const changedLead = Object.assign({}, lead, {
    nama: "Registrant Two",
    perusahaan: "Company B",
    kategori: "Retailer",
    produk: "Adapters",
    requestId: "a2366f7a-f650-4ecf-9081-2e2b783e2e19"
  });
  const { context, rows } = makeGas({ rows: [existing] });
  const result = context.doPost({ parameter: changedLead });

  assert.equal(rows.length, 1);
  assert.match(result.html, /"status":"already_registered"/);
});

test("a new WhatsApp number is saved when it does not exist in the sheet", () => {
  const { context, rows } = makeGas();
  const result = context.doPost({ parameter: lead });

  assert.equal(rows.length, 1);
  assert.equal(rows[0][3], "6281234567890");
  assert.match(result.html, /"status":"success"/);
});

test("a WhatsApp number can register after its spreadsheet row is deleted", () => {
  const existing = ["2026-10-27", "Indocomtech 2026", "Registrant One", "6281234567890", "End User", "Company A", "HDMI"];
  const { context, rows } = makeGas({ rows: [existing] });
  const duplicate = context.doPost({ parameter: Object.assign({}, lead, { requestId: "a2366f7a-f650-4ecf-9081-2e2b783e2e20" }) });
  assert.match(duplicate.html, /"status":"already_registered"/);

  rows.splice(0, 1);
  const allowed = context.doPost({ parameter: Object.assign({}, lead, { requestId: "a2366f7a-f650-4ecf-9081-2e2b783e2e21" }) });
  assert.equal(rows.length, 1);
  assert.match(allowed.html, /"status":"success"/);
});

test("competing submissions with different request IDs and the same WhatsApp save only one row under the script lock", async () => {
  const { context, rows, lockStats } = makeGas();
  const first = Object.assign({}, lead, { requestId: "a2366f7a-f650-4ecf-9081-2b2e783e2e22" });
  const second = Object.assign({}, lead, {
    nama: "Registrant Two",
    requestId: "a2366f7a-f650-4ecf-9081-2b2e783e2e23"
  });
  const results = await Promise.all([
    Promise.resolve().then(() => context.doPost({ parameter: first })),
    Promise.resolve().then(() => context.doPost({ parameter: second }))
  ]);

  assert.equal(rows.length, 1);
  assert.equal(lockStats.waits, 2);
  assert.equal(lockStats.releases, 2);
  assert.deepEqual(results.map(result => result.html.match(/"status":"([^"]+)"/)[1]).sort(), ["already_registered", "success"]);
});

test("acknowledgements from either Apps Script browser origin are accepted", async () => {
  const { context, elements, listeners, body } = makeClient();
  await context.submitForm();
  const frame = body.children.find(el => el.tagName === "iframe");
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;
  listeners.message({
    origin: "https://script.google.com",
    source: frame.contentWindow,
    data: { source: "howell-data-capture", status: "success", requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), true);
});

test("acknowledgement from the registrasi subdomain is accepted for a matching request", async () => {
  const { context, elements, listeners, body } = makeClient();
  context.window.location.origin = "https://registrasi.howellcable.site";
  await context.submitForm();
  const frame = body.children.find(el => el.tagName === "iframe");
  const form = body.children.find(el => el.tagName === "form");
  const requestId = form.children.find(field => field.name === "requestId").value;
  assert.equal(form.children.find(field => field.name === "siteOrigin").value,
    "https://registrasi.howellcable.site");
  listeners.message({
    origin: "https://registrasi.howellcable.site",
    source: frame.contentWindow,
    data: { source: "howell-data-capture", status: "success", requestId }
  });
  assert.equal(elements["scr-success"].classList.contains("show"), true);
});

test("Apps Script write errors return a generic error acknowledgement without details", () => {
  const { context, rows } = makeGas({ failWrite: true });
  const result = context.doPost({ parameter: lead });
  assert.equal(rows.length, 0);
  assert.match(result.html, /"status":"error"/);
  assert.doesNotMatch(result.html, /private spreadsheet failure details/);
});

test("cache write failure after a saved row does not report a false submission failure", () => {
  const { context, rows } = makeGas({ failCacheWrite: true });
  const result = context.doPost({ parameter: lead });
  assert.equal(rows.length, 1);
  assert.match(result.html, /"status":"success"/);
});

test("acknowledgement targets the submitted Howell subdomain from the allowlist", () => {
  const { context } = makeGas();
  const result = context.doPost({
    parameter: Object.assign({}, lead, { siteOrigin: "https://registrasi.howellcable.site" })
  });
  assert.match(result.html, /"https:\/\/registrasi\.howellcable\.site"/);
  assert.match(result.html, /window\.parent\.postMessage/);
  assert.match(result.html, /window\.top\.postMessage/);
});

test("legacy JSON requests remain accepted by the updated endpoint", () => {
  const { context, rows } = makeGas();
  const legacy = Object.assign({}, lead);
  delete legacy.requestId;
  context.doPost({ postData: { contents: JSON.stringify(legacy) } });
  assert.equal(rows.length, 1);
});
