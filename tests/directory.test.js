const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const plain = value => JSON.parse(JSON.stringify(value));

(async () => {
  const mutations = [];
  let nextId = 0;
  const client = {
    from(table) {
      return {
        insert(row) {
          mutations.push({ op: "insert", table, row });
          return { select: () => ({ single: async () => ({ data: { id: `dir-${++nextId}` }, error: null }) }) };
        },
        update(row) {
          return { eq: async (column, value) => { mutations.push({ op: "update", table, row, column, value }); return { error: null }; } };
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

  const areaId = await db.addExpertiseArea("Drone Service", 80);
  const subId = await db.addTechnicianSubcategory(areaId, "DJI", 10);
  const technicianId = await db.addTechnician({ name: "Kumar", phone: "+91 90000 00001", notes: "Chennai", expertiseAreaIds: [areaId], subcategoryIds: [subId] });
  const roleId = await db.addCrewRole("Steadicam Operator", 80);
  const crewId = await db.addCrewMember({ name: "Arun", phone: "+91 90000 00002", notes: "Available", roleIds: [roleId] });

  assert.strictEqual(areaId, "dir-1");
  assert.strictEqual(subId, "dir-2");
  assert.strictEqual(technicianId, "dir-3");
  assert.strictEqual(roleId, "dir-4");
  assert.strictEqual(crewId, "dir-5");
  assert.deepStrictEqual(plain(mutations[2]), {
    op: "insert", table: "technicians", row: {
      full_name: "Kumar", phone_number: "+91 90000 00001", notes: "Chennai",
      expertise_area_ids: ["dir-1"], subcategory_ids: ["dir-2"], is_active: true
    }
  });
  assert.deepStrictEqual(plain(mutations[4]), {
    op: "insert", table: "crew_members", row: {
      full_name: "Arun", phone_number: "+91 90000 00002", notes: "Available", role_ids: ["dir-4"], is_active: true
    }
  });

  await db.updateTechnician(technicianId, { isActive: false });
  await db.updateCrewRole(roleId, { name: "Camera Stabilizer Operator", isActive: true });
  assert.deepStrictEqual(plain(mutations[5]), { op: "update", table: "technicians", row: { is_active: false }, column: "id", value: "dir-3" });
  assert.deepStrictEqual(plain(mutations[6]), { op: "update", table: "crew_roles", row: { name: "Camera Stabilizer Operator", is_active: true }, column: "id", value: "dir-4" });

  const html = fs.readFileSync("console.html", "utf8");
  assert(html.includes('{v:"technicians",i:"🛠️",t:"Technicians"}'), "Technicians must appear beside Customers");
  assert(html.includes('{v:"crew",i:"🎬",t:"Crew Members"}'), "Crew Members must appear beside Customers");
  assert(html.includes("addExpertiseAreaFromUI('form')"), "technician form must add expertise areas inline");
  assert(html.includes("addTechnicianSubcategoryFromUI('${a.id}','form')"), "technician form must add specializations inline");
  assert(html.includes("addCrewRoleFromUI('form')"), "crew form must add roles inline");
  assert(html.includes("openExpertiseManager()") && html.includes("openCrewRoleManager()"), "master lists must be manageable through the UI");
  assert(html.includes("Archive") && html.includes("Restore"), "directory entries and master values must support archive and restore");

  console.log("technician and crew directory: all tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
