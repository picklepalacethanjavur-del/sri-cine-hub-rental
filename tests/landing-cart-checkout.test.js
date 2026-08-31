const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force === undefined ? !this.contains(value) : force) this.add(value);
    else this.remove(value);
  }
}

(async () => {
  const html = fs.readFileSync("src-studio.html", "utf8");
  const catalog = fs.readFileSync("catalog-data.js", "utf8");

  assert(catalog.includes("window.SRI_CATALOG"), "public catalog should use Sri branding");
  assert(!catalog.includes("SRC_CATALOG"), "legacy SRC branding must not return");
  assert(html.includes("SRI_CATALOG.forEach"), "landing page should load the Sri catalog");

  assert(html.includes('href="console.html"'), "landing page must link to the protected staff console");
  assert(html.includes(">Staff Login</a>"), "staff entry point must be clearly labelled");
  assert(html.includes('id="headerCartCount">0</span>'), "header cart must expose its live item count");
  assert(!html.includes("Step 4 of 4"), "the old hard-coded final step must be removed");
  assert(!/Add(?: package)? to kit/i.test(html), "customer actions must use cart terminology");

  const elements = {};
  const element = id => (elements[id] ||= {
    id,
    value: "",
    innerHTML: "",
    textContent: "",
    style: {},
    classList: new ClassList(),
    setAttribute(name, value) { this[name] = value; },
    scrollIntoView() {},
    addEventListener() {}
  });
  const document = {
    body: { style: {} },
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const context = {
    document,
    window: { open() {}, SUPABASE_CONFIG: null },
    location: { reload() {} },
    console,
    encodeURIComponent,
    decodeURIComponent,
    Date,
    Set
  };
  vm.createContext(context);

  const cartStart = html.indexOf("const cart=new Set();");
  const searchStart = html.indexOf("/* search */", cartStart);
  const checkoutStart = html.indexOf("/* cart + quote checkout */", searchStart);
  const themeStart = html.indexOf("/* theme */", checkoutStart);
  assert(cartStart > 0 && searchStart > cartStart && checkoutStart > searchStart && themeStart > checkoutStart, "cart checkout script blocks must be present");
  vm.runInContext(html.slice(cartStart, searchStart), context);
  vm.runInContext(html.slice(checkoutStart, themeStart), context);

  context.openCart();
  assert(element("checkoutContent").innerHTML.includes("Your cart is empty"));
  assert(element("checkoutContent").innerHTML.includes("Browse Equipment"));
  assert(element("checkoutContent").innerHTML.includes("Request unlisted equipment"));
  assert(!element("checkoutContent").innerHTML.includes("Submit quote request"));

  vm.runInContext("cart.add('Cameras|Sony FX3')", context);
  context.updateBar();
  assert.strictEqual(element("headerCartCount").textContent, 1);
  assert.strictEqual(element("cartcount").textContent, 1);
  assert(element("cartbar").classList.contains("show"));

  context.openCart();
  assert(element("checkoutContent").innerHTML.includes("Step 1 of 3"));
  assert(element("checkoutContent").innerHTML.includes("Sony FX3"));
  context.checkoutNext();
  assert(element("checkoutContent").innerHTML.includes("Step 2 of 3"));

  element("q-name").value = "Arjun";
  element("q-phone").value = "+91 90000 00000";
  element("q-prod").value = "Feature film";
  element("q-start").value = "2026-09-10";
  element("q-end").value = "2026-09-12";
  element("q-notes").value = "Two camera bodies";
  context.checkoutNext();
  assert(element("checkoutContent").innerHTML.includes("Step 3 of 3"));
  assert(element("checkoutContent").innerHTML.includes("Submit quote request"));

  vm.runInContext("cart.clear()", context);
  await context.submitRequest();
  assert(element("checkoutContent").innerHTML.includes("Your cart is empty"), "stale checkout submission must return to the empty-cart state");

  context.openGeneralEnquiry();
  assert(element("checkoutContent").innerHTML.includes("Request unlisted equipment"));
  element("q-name").value = "Meena";
  element("q-phone").value = "+91 91111 11111";
  element("q-prod").value = "";
  element("q-start").value = "";
  element("q-end").value = "";
  element("q-notes").value = "Technocrane and operator";
  context.checkoutNext();
  assert(element("checkoutContent").innerHTML.includes("Equipment needed"));
  assert(element("checkoutContent").innerHTML.includes("Technocrane and operator"));

  console.log("landing cart checkout: all tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
