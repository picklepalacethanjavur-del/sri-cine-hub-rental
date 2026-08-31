const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const plain = value => JSON.parse(JSON.stringify(value));

async function testDataLayer() {
  const mutations = [];
  let nextId = 0;
  const client = {
    from(table) {
      return {
        insert(row) {
          mutations.push({ op: "insert", table, row });
          return { select: () => ({ single: async () => ({ data: { id: `line-${++nextId}` }, error: null }) }) };
        },
        update(row) {
          return { eq: async (column, value) => { mutations.push({ op: "update", table, row, column, value }); return { error: null }; } };
        },
        delete() {
          return { eq: async (column, value) => { mutations.push({ op: "delete", table, column, value }); return { error: null }; } };
        }
      };
    }
  };
  const window = {
    SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "test", schema: "srchub" },
    supabase: { createClient: () => client }
  };
  vm.runInNewContext(fs.readFileSync("console-db.js", "utf8"), { window, console });
  const db = window.SDB;
  db.ids.bookingByCode["BK-1"] = "booking-1";
  db.ids.unitByCode["CAM-1"] = "unit-1";

  const own = { code: "CAM-1", name: "Owned camera", rate: 1000, qty: 2, start: "2026-09-01", end: "2026-09-02", lineKind: "own" };
  const ownId = await db.addBookingLine("BK-1", own, true);
  assert.strictEqual(ownId, "line-1");
  assert.deepStrictEqual(plain(mutations[0].row), {
    booking_id: "booking-1", unit_id: "unit-1", kind: "camera", label: "Owned camera", catalog_option_id: null,
    line_kind: "own", supplier_id: null, cost_inr: null, daily_rate_inr: 1000, quantity: 2,
    item_start_at: "2026-09-01", item_end_at: "2026-09-02", added_mid_booking: true
  });

  const supplier = { code: "(hire-in)", name: "Supplier lens", rate: 2500, qty: 1, start: "2026-09-01", end: "2026-09-02", lineKind: "hirein", supplierId: "supplier-1", cost: 1800 };
  supplier._lineId = await db.addBookingLine("BK-1", supplier, false);
  assert.strictEqual(mutations[1].row.unit_id, null);
  assert.strictEqual(mutations[1].row.line_kind, "hirein");
  assert.strictEqual(mutations[1].row.supplier_id, "supplier-1");
  assert.strictEqual(mutations[1].row.cost_inr, 1800);

  await db.returnEarly("BK-1", supplier, "2026-09-02", "good");
  assert.deepStrictEqual(plain(mutations[2]), { op: "update", table: "booking_lines", row: { returned_at: "2026-09-02", condition_in: "good" }, column: "id", value: "line-2" });

  const manual = { code: "(manual)", name: "Car service", rate: 1600, qty: 1, start: "2026-09-01", end: "2026-09-02", lineKind: "custom" };
  manual._lineId = await db.addBookingLine("BK-1", manual, false);
  assert.strictEqual(mutations[3].row.unit_id, null);
  assert.strictEqual(mutations[3].row.line_kind, "custom");
  assert.strictEqual(mutations[3].row.label, "Car service");

  await db.updateBookingLine("BK-1", manual, { rate: 2200 });
  assert.deepStrictEqual(plain(mutations[4]), { op: "update", table: "booking_lines", row: { daily_rate_inr: 2200 }, column: "id", value: "line-3" });
  await db.deleteBookingLine("BK-1", manual);
  assert.deepStrictEqual(plain(mutations[5]), { op: "delete", table: "booking_lines", column: "id", value: "line-3" });
  await db.deleteRFQ("rfq-1");
  assert.deepStrictEqual(plain(mutations[6]), { op: "delete", table: "supplier_rfqs", column: "id", value: "rfq-1" });

  own._lineId = "line-1";
  own.conditionOut = "good";
  own.checkoutHours = 125;
  await db.confirmOps({ code: "BK-1", cameras: [own], accessories: [] }, "checked_out");
  assert.deepStrictEqual(plain(mutations[9]), { op: "update", table: "equipment_units", row: { status: "booked" }, column: "id", value: "unit-1" });

  own.conditionIn = "good";
  own.returnHours = 130;
  await db.confirmOps({ code: "BK-1", cameras: [own], accessories: [] }, "returned");
  assert.deepStrictEqual(plain(mutations[12]), { op: "update", table: "equipment_units", row: { status: "available" }, column: "id", value: "unit-1" });
}

async function testBookingUi() {
  const html = fs.readFileSync("console.html", "utf8");
  assert(html.includes("returnEarly('${code}','${type}',${index})"), "Return early should target each booking line by index");
  assert(!html.includes("l.code.indexOf('(')<0"), "Hire-in lines must not be excluded from early return");
  assert(html.includes('unit.status=newStatus==="returned"?"available":"booked"'), "checkout and return must update the local inventory status");
  const start = html.indexOf("function editBookingItemForm");
  const end = html.indexOf("/* ---- Checkout / Return ---- */", start);
  assert(start > 0 && end > start, "booking enhancement function block was not found");

  const elements = {};
  const calls = { add: [], update: [], delete: [] };
  const booking = {
    code: "BK-1", start: "2026-09-01", end: "2026-09-03", cameras: [], accessories: [], payments: []
  };
  const context = {
    DATA: {
      bookings: [booking],
      cameras: [{ code: "CAM-1", name: "Owned camera", status: "available", dailyRate: 1000 }],
      accessories: [],
      suppliers: [{ id: "SUP-1", name: "Lens Bank", catalog: [{ item: "Supplier lens", rate: 1800 }] }]
    },
    TODAY: "2026-08-31",
    SDB: {
      on: false,
      addBookingLine: async (code, line, isCam) => { calls.add.push({ code, line: { ...line }, isCam }); return null; },
      updateBookingLine: async (code, line, patch) => { calls.update.push({ code, line, patch }); return true; },
      deleteBookingLine: async (code, line) => { calls.delete.push({ code, line }); return true; }
    },
    $: selector => (elements[selector] ||= { value: "", textContent: "", innerHTML: "" }),
    openModal: value => { context.modalHtml = value; },
    closeModal: () => { context.closed = true; },
    toast: value => { context.lastToast = value; },
    bookingDetail: () => "booking detail rerendered",
    confirm: () => true,
    escAttr: value => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/\"/g, "&quot;").replace(/</g, "&lt;"),
    money: value => "₹" + Number(value || 0).toLocaleString("en-IN"),
    fmtDate: value => value,
    parseD: value => new Date(value + "T00:00:00"),
    daysBetween: (from, to) => Math.max(1, Math.round((new Date(to + "T00:00:00") - new Date(from + "T00:00:00")) / 86400000) + 1),
    Number,
    console
  };
  vm.createContext(context);
  const totalsStart = html.indexOf("function lineDays");
  const totalsEnd = html.indexOf("/* ============ nav / router", totalsStart);
  vm.runInContext(html.slice(totalsStart, totalsEnd), context);
  vm.runInContext(html.slice(start, end), context);

  context.addEquip("BK-1");
  context.setAddBookingMode("supplier");
  assert(context.modalHtml.includes("Supplier equipment"));
  assert(context.modalHtml.includes("Supplier lens"));
  elements["#ae-item"] = { value: "0" };
  elements["#ae-rate"] = { value: "2500" };
  elements["#ae-qty"] = { value: "1" };
  elements["#ae-from"] = { value: "2026-09-01" };
  elements["#ae-to"] = { value: "2026-09-03" };
  await context.doAddEquip("BK-1");
  assert.strictEqual(booking.accessories[0].lineKind, "hirein");
  assert.strictEqual(booking.accessories[0].supplierId, "SUP-1");
  assert.strictEqual(booking.accessories[0].cost, 1800);
  assert.strictEqual(context.bookingTotals(booking).charges, 7500);

  context.addEquip("BK-1");
  context.setAddBookingMode("manual");
  elements["#ae-name"] = { value: "Car service" };
  elements["#ae-rate"] = { value: "1600" };
  elements["#ae-qty"] = { value: "1" };
  elements["#ae-from"] = { value: "2026-09-01" };
  elements["#ae-to"] = { value: "2026-09-03" };
  await context.doAddEquip("BK-1");
  assert.strictEqual(booking.accessories[1].lineKind, "custom");
  assert.strictEqual(booking.accessories[1].name, "Car service");
  assert.strictEqual(context.bookingTotals(booking).charges, 12300);

  elements["#ebi-rate"] = { value: "2200" };
  await context.saveBookingItemPrice("BK-1", "accessories", 1);
  assert.strictEqual(booking.accessories[1].rate, 2200);
  assert.deepStrictEqual(plain(calls.update[0].patch), { rate: 2200 });
  assert.strictEqual(context.bookingTotals(booking).charges, 14100);

  await context.deleteBookingItem("BK-1", "accessories", 1);
  assert.strictEqual(booking.accessories.some(line => line.name === "Car service"), false);
  assert.strictEqual(calls.delete.length, 1);
  assert.strictEqual(context.bookingTotals(booking).charges, 7500);
  assert.strictEqual(elements["#content"].innerHTML, "booking detail rerendered");
}

(async () => {
  await testDataLayer();
  await testBookingUi();
  console.log("booking enhancements: all tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
