const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("console.html", "utf8");
const allowedMatch = html.match(/const ALLOWED=(\{[^;]+\});/);

if (!allowedMatch) throw new Error("Could not find the console role allow-list");

const ALLOWED = vm.runInNewContext(`(${allowedMatch[1]})`);
const canSee = (role, view) => ALLOWED[role] === "*" || ALLOWED[role].includes(view);

const operations = [
  "dashboard", "quickrent", "requests", "bookings", "checkout", "calendar",
  "inventory", "hirein", "suppliers", "customers", "technicians", "crew", "receipts", "users"
];

if (!canSee("admin", "investor") || operations.some(view => !canSee("admin", view))) {
  throw new Error("Admin must retain full access");
}

if (canSee("manager", "investor")) {
  throw new Error("Manager must not see Investor Portal");
}
if (["dashboard", "bookings", "inventory", "technicians", "crew", "receipts"].some(view => !canSee("manager", view))) {
  throw new Error("Manager lost expected operations access");
}

if (!canSee("investor", "investor")) {
  throw new Error("Investor must see Investor Portal");
}
if (operations.some(view => canSee("investor", view))) {
  throw new Error("Investor must not see operations or admin modules");
}

if (!html.includes('if(ROLE&&!canSee(v)){')) {
  throw new Error("Direct navigation must remain guarded by role");
}
if (!html.includes('style.display=canSee("dashboard")?"":"none"')) {
  throw new Error("Operations search must be hidden for portal-only roles");
}
if (!html.includes('if(!canSee("bookings"))return toast')) {
  throw new Error("Investor must not bypass the router through booking details");
}

console.log("role access: all tests passed");
