const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("console.html", "utf8");
const db = fs.readFileSync("console-db.js", "utf8");
const start = html.indexOf("function capFirst");
const end = html.indexOf("function normalizeConsoleNames", start);
assert(start > 0 && end > start, "booking-name helpers were not found");

const context = {};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

assert.strictEqual(context.capFirst("arumugam"), "Arumugam", "lowercase names should start uppercase");
assert.strictEqual(context.capFirst("SQER Media Saravanan"), "SQER Media Saravanan", "existing acronym casing must be preserved");
assert.strictEqual(context.cleanBookingProject("Walk-in booking"), "", "legacy placeholder is not a real project name");
assert.strictEqual(
  context.bookingDisplayTitle({ project: "", contact: "sqer Media Saravanan", production: "SQER Media", code: "BK-1" }),
  "Sqer Media Saravanan",
  "blank-project bookings should display the booking contact"
);
assert.strictEqual(
  context.bookingDisplayTitle({ project: "ad shoot", contact: "saravanan", code: "BK-2" }),
  "Ad shoot",
  "a real project name should remain the preferred title"
);
assert(!html.includes('proj||"Walk-in booking"'), "Quick Rent must not create placeholder project names");
assert(db.includes("project_name: b.project || null"), "blank project names should persist as null");
assert(html.includes("${bookingDisplayTitle(b)}"), "booking displays should use the shared title fallback");

console.log("booking name normalization: all tests passed");
