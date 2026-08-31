const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

(async () => {
  const html = fs.readFileSync("console.html", "utf8");
  const elements = { "#find-res": { innerHTML: "" } };
  const calls = { go: [], builder: [], delete: [] };
  const context = {
    FIND: { q: "lens" },
    INV: { tab: "cameras", status: "all", q: "" },
    DATA: {
      cameras: [{ code: "CAM-1", name: "Lens camera", manufacturer: "ARRI", status: "available", dailyRate: 1000 }],
      accessories: [],
      suppliers: [{ id: "SUP-1", name: "Lens Bank", contact: "+91 90000 00000", catalog: [{ item: "Prime lens set", rate: 1800 }] }],
      rfqs: [{ id: "local-rfq", _uuid: "rfq-db-1", code: "RFQ-101", supplierName: "Lens Bank", items: [] }]
    },
    SDB: {
      on: true,
      deleteRFQ: async id => { calls.delete.push(id); return true; }
    },
    $: selector => elements[selector] || null,
    money: value => "₹" + Number(value || 0).toLocaleString("en-IN"),
    statusBadge: status => `<span>${status}</span>`,
    waEsc: value => String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'"),
    go: view => { calls.go.push(view); },
    openRFQBuilder: (existing, seed) => { calls.builder.push({ existing, seed }); },
    toast: value => { context.lastToast = value; },
    confirm: () => true,
    console
  };
  vm.createContext(context);

  const findStart = html.indexOf("function renderFind");
  const findEnd = html.indexOf("VIEWS.customers", findStart);
  assert(findStart > 0 && findEnd > findStart, "supplier find block not found");
  vm.runInContext(html.slice(findStart, findEnd), context);

  context.renderFind();
  assert(elements["#find-res"].innerHTML.includes("View inventory →"));
  assert(elements["#find-res"].innerHTML.includes("Create RFQ →"));
  assert(elements["#find-res"].innerHTML.includes("Prime lens set"));

  context.startRFQFromFind("SUP-1", "Prime lens set");
  assert.strictEqual(calls.builder.length, 1);
  assert.strictEqual(calls.builder[0].existing, null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.builder[0].seed)), {
    supplierId: "SUP-1", lines: [{ item: "Prime lens set", qty: 1 }]
  });

  context.FIND.q="tripod";context.renderFind();
  assert(elements["#find-res"].innerHTML.includes("Create manual RFQ →"));
  context.startManualRFQFromFind();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.builder[1].seed)), {lines:[{item:"tripod",qty:1}]});

  const builderContext = {
    DATA: context.DATA,
    CUR: "suppliers",
    buildNav: () => {},
    $: selector => selector === "#pageTitle" ? { textContent: "" } : null,
    window: { scrollTo: () => {} },
    renderRFB: () => { builderContext.snapshot = vm.runInContext("JSON.stringify(RFB)", builderContext); },
    console
  };
  vm.createContext(builderContext);
  const builderStart = html.indexOf("let RFB=null;");
  const builderEnd = html.indexOf("function editRFQ", builderStart);
  vm.runInContext(html.slice(builderStart, builderEnd), builderContext);
  builderContext.openRFQBuilder(null,{supplierId:"SUP-1",lines:[{item:"Prime lens set",qty:1}]});
  assert.deepStrictEqual(JSON.parse(builderContext.snapshot), {
    editId:null,editUuid:null,supplierId:"SUP-1",bookingCode:"",pickup:"",ret:"",notes:"",q:"",lines:[{item:"Prime lens set",qty:1}]
  });

  context.viewFoundInventory("cameras", "Lens camera");
  assert.strictEqual(context.INV.tab, "cameras");
  assert.strictEqual(context.INV.status, "all");
  assert.strictEqual(context.INV.q, "Lens camera");
  assert.strictEqual(calls.go.at(-1), "inventory");

  const deleteStart = html.indexOf("async function deleteRFQ");
  const deleteEnd = html.indexOf("function rfqWA", deleteStart);
  assert(deleteStart > 0 && deleteEnd > deleteStart, "RFQ delete block not found");
  vm.runInContext(html.slice(deleteStart, deleteEnd), context);
  await context.deleteRFQ("local-rfq");
  assert.deepStrictEqual(calls.delete, ["rfq-db-1"]);
  assert.strictEqual(context.DATA.rfqs.length, 0);
  assert.strictEqual(calls.go.at(-1), "hirein");
  assert.strictEqual(context.lastToast, "RFQ-101 deleted");

  const deleteButtonCount = (html.match(/onclick="deleteRFQ\('/g) || []).length;
  assert(deleteButtonCount >= 2, "delete action should appear on the Hire-In card and RFQ letter");

  console.log("supplier and hire-in enhancements: all tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
