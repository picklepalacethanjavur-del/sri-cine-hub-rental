const fs = require("fs");

const db = fs.readFileSync("console-db.js", "utf8");
const consoleHtml = fs.readFileSync("console.html", "utf8");

if (!db.includes('sb.rpc("get_investor_portal_data")')) {
  throw new Error("Investor login must use the investor-scoped Supabase endpoint");
}
if (!db.includes('if (role === "investor") return bootstrapInvestor();')) {
  throw new Error("Investor role must bypass the staff data loader");
}
if (!consoleHtml.includes("SDB.bootstrap(ROLE)")) {
  throw new Error("Console boot must pass the authenticated profile role to the data layer");
}
if (!consoleHtml.includes("if(b._charges!=null)")) {
  throw new Error("Investor calculations must use server-computed booking totals");
}

console.log("investor portal data: all tests passed");
