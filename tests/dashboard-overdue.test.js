const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("console.html", "utf8");
const start = html.indexOf("function bookingHasUnreturnedItems");
const end = html.indexOf("VIEWS.dashboard=", start);
assert(start > 0 && end > start, "dashboard overdue helpers were not found");

const context = { TODAY: "2026-09-02" };
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

const overdue = { status: "checked_out", end: "2026-09-01", cameras: [{ returnedAt: null }], accessories: [] };
const dueToday = { status: "checked_out", end: "2026-09-02", cameras: [{ returnedAt: null }], accessories: [] };
const fullyReturned = { status: "checked_out", end: "2026-09-01", cameras: [{ returnedAt: "2026-09-01" }], accessories: [] };

assert.strictEqual(context.isBookingOverdue(overdue), true, "past-due checked-out bookings must be overdue");
assert.strictEqual(context.isBookingOverdue(dueToday), false, "a booking due today is not overdue yet");
assert.strictEqual(context.isBookingOverdue(fullyReturned), false, "fully returned lines must not be overdue");
assert(html.includes('overdueItems+" unreturned item"'), "dashboard should show the unreturned item count");
assert(html.includes('const barCls=b=>isBookingOverdue(b)?"bar-bad"'), "calendar bars must derive red from the actual due date");

const db = fs.readFileSync("console-db.js", "utf8");
const statusStart = db.indexOf("function effectiveBookingStatus");
const statusEnd = db.indexOf("async function bootstrap(role)", statusStart);
assert(statusStart > 0 && statusEnd > statusStart, "booking status normalizer was not found");
const dbContext = {};
vm.createContext(dbContext);
vm.runInContext(db.slice(statusStart, statusEnd), dbContext);
assert.strictEqual(dbContext.effectiveBookingStatus({ status: "overdue", end_at: "2026-09-04" }, [{ returned_at: null }], "2026-09-02"), "checked_out", "a future return must not stay overdue");
assert.strictEqual(dbContext.effectiveBookingStatus({ status: "checked_out", end_at: "2026-09-01" }, [{ returned_at: null }], "2026-09-02"), "overdue", "a past-due unreturned booking must become overdue");
assert.strictEqual(dbContext.effectiveBookingStatus({ status: "returned", end_at: "2026-09-01" }, [{ returned_at: null }], "2026-09-02"), "returned", "completed booking statuses must be preserved");

console.log("dashboard overdue: all tests passed");
