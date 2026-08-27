// Seed data for the Sri Cine Hub internal console mockup.
// Serialized units (internal truth) — distinct from the public "option cards".
// Real current date (local), so the console never freezes on a hard-coded day.
window.TODAY = (function(){ const d=new Date(); const p=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); })();

window.DATA = {
  cameras: [
    { code:"CAM-001", name:"ARRI Alexa Mini LF", manufacturer:"ARRI", model:"Alexa Mini LF", serial:"AMLF-2231", meterHours:1240, location:"Rack A", status:"booked", dailyRate:25000,
      cost:8015040, investors:[ {name:"Sri Cine Hub", loc:"", invested:6656640}, {name:"Sudhan", loc:"Tampa", invested:686400}, {name:"Siva", loc:"SFO", invested:672000} ] },
    { code:"CAM-002", name:"ARRI Amira", manufacturer:"ARRI", model:"Amira", serial:"AMR-8842", meterHours:2110, location:"Rack A", status:"available", dailyRate:20000,
      cost:4500000, investors:[ {name:"Sri Cine Hub", loc:"", invested:3000000}, {name:"Sudhan", loc:"Tampa", invested:900000}, {name:"Anand", loc:"Chennai", invested:600000} ] },
    { code:"CAM-003", name:"RED Komodo 6K", manufacturer:"RED", model:"Komodo 6K", serial:"KMD-5521", meterHours:640, location:"Rack B", status:"booked", dailyRate:12000 },
    { code:"CAM-004", name:"RED Gemini 5K", manufacturer:"RED", model:"DSMC2 Gemini", serial:"GMN-3390", meterHours:980, location:"Rack B", status:"booked", dailyRate:11000 },
    { code:"CAM-005", name:"Sony FX3", manufacturer:"Sony", model:"FX3", serial:"FX3-1123", meterHours:410, location:"Rack C", status:"booked", dailyRate:9000 },
    { code:"CAM-006", name:"Sony A7S III", manufacturer:"Sony", model:"A7S III", serial:"A7S-7781", meterHours:365, location:"Rack C", status:"booked", dailyRate:9000 },
    { code:"CAM-007", name:"Canon R5", manufacturer:"Canon", model:"EOS R5", serial:"R5-4402", meterHours:220, location:"Rack C", status:"available", dailyRate:7000 },
    { code:"CAM-008", name:"Sony A7S III", manufacturer:"Sony", model:"A7S III", serial:"A7S-7782", meterHours:150, location:"Maintenance", status:"maintenance", dailyRate:9000 }
  ],
  accessories: [
    { code:"ACC-001", name:"Wireless Nucleus M", category:"Follow Focus", status:"available", dailyRate:2500 },
    { code:"ACC-002", name:"SkyPanel S60", category:"Lighting", status:"booked", dailyRate:6000 },
    { code:"ACC-003", name:"Aputure 600c", category:"Lighting", status:"available", dailyRate:3500 },
    { code:"ACC-004", name:"Crane 3S Pro", category:"Gimbal", status:"available", dailyRate:2000 },
    { code:"ACC-005", name:"Lapel Mic E4", category:"Audio", status:"available", dailyRate:800 },
    { code:"ACC-006", name:"Camera Slider", category:"Grip", status:"booked", dailyRate:1500 },
    { code:"ACC-007", name:"Ultra Prime Set", category:"Lenses", status:"available", dailyRate:8000 }
  ],
  customers: [
    { id:"CUS-1", name:"Arjun Mehta", company:"Sunburst Films", phone:"+91 98400 11223" },
    { id:"CUS-2", name:"Priya Raghavan", company:"Frame & Co", phone:"+91 99620 45566" },
    { id:"CUS-3", name:"Vikram Nair", company:"Vikram Studios", phone:"+91 90030 77889" },
    { id:"CUS-4", name:"Karthik S", company:"Independent", phone:"+91 87540 33221" }
  ],
  bookings: [
    { code:"BK-2026-000103", customer:"CUS-3", production:"Vikram Studios", project:"Feature — Nila", contact:"Vikram Nair", phone:"+91 90030 77889",
      status:"checked_out", start:"2026-08-20", end:"2026-08-31", pickup:"Studio floor", operator:"Suresh",
      cameras:[{code:"CAM-001", name:"ARRI Alexa Mini LF", rate:25000}],
      accessories:[{code:"ACC-002", name:"SkyPanel S60", rate:6000},{code:"ACC-006", name:"Camera Slider", rate:1500}],
      payments:[{amount:50000, type:"advance", method:"Bank Transfer", date:"2026-08-19", ref:"UTR8841"},{amount:30000, type:"intermediate", method:"UPI", date:"2026-08-25", ref:"UPI/2231"}] },
    { code:"BK-2026-000101", customer:"CUS-1", production:"Sunburst Films", project:"Chai Ad Film", contact:"Arjun Mehta", phone:"+91 98400 11223",
      status:"checked_out", start:"2026-08-22", end:"2026-08-27", pickup:"Studio floor", operator:"Suresh",
      cameras:[{code:"CAM-003", name:"RED Komodo 6K", rate:12000}],
      accessories:[{code:"ACC-002", name:"SkyPanel S60", rate:6000}],
      payments:[{amount:20000, type:"advance", method:"UPI", date:"2026-08-21", ref:"UPI/1180"}] },
    { code:"BK-2026-000104", customer:"CUS-4", production:"Independent", project:"Music Video — Vaanam", contact:"Karthik S", phone:"+91 87540 33221",
      status:"overdue", start:"2026-08-18", end:"2026-08-23", pickup:"Studio floor", operator:"Mani",
      cameras:[{code:"CAM-004", name:"RED Gemini 5K", rate:11000}],
      accessories:[],
      payments:[{amount:10000, type:"advance", method:"Cash", date:"2026-08-17", ref:""}] },
    { code:"BK-2026-000102", customer:"CUS-2", production:"Frame & Co", project:"Wedding — Anitha & Ravi", contact:"Priya Raghavan", phone:"+91 99620 45566",
      status:"confirmed", start:"2026-08-28", end:"2026-08-30", pickup:"Studio floor", operator:"",
      cameras:[{code:"CAM-005", name:"Sony FX3", rate:9000},{code:"CAM-006", name:"Sony A7S III", rate:9000}],
      accessories:[{code:"ACC-004", name:"Crane 3S Pro", rate:2000},{code:"ACC-005", name:"Lapel Mic E4", rate:800}],
      payments:[{amount:15000, type:"advance", method:"UPI", date:"2026-08-24", ref:"UPI/5567"}] },
    { code:"BK-2026-000106", customer:"CUS-2", production:"Frame & Co", project:"Short Film — Maya", contact:"Priya Raghavan", phone:"+91 99620 45566",
      status:"reserved", start:"2026-09-05", end:"2026-09-09", pickup:"Studio floor", operator:"",
      cameras:[{code:"CAM-002", name:"ARRI Amira", rate:20000}],
      accessories:[{code:"ACC-007", name:"Ultra Prime Set", rate:8000}],
      payments:[] },
    { code:"BK-2026-000100", customer:"CUS-1", production:"Sunburst Films", project:"Product Shoot — Aroma", contact:"Arjun Mehta", phone:"+91 98400 11223",
      status:"returned", start:"2026-08-10", end:"2026-08-13", pickup:"Studio floor", operator:"Mani",
      cameras:[{code:"CAM-007", name:"Canon R5", rate:7000}],
      accessories:[],
      payments:[{amount:8000, type:"advance", method:"UPI", date:"2026-08-09", ref:"UPI/0091"},{amount:13000, type:"final", method:"Cash", date:"2026-08-13", ref:""}] }
  ],
  requests: [
    { id:"REQ-2026-053", name:"Ramesh Kumar", company:"Ramesh Weddings", phone:"+91 91234 55667", start:"2026-09-20", end:"2026-09-21", desc:"ARRI if available + 2 lenses for a wedding film. Single day, possible extension.", status:"new", notes:"" },
    { id:"REQ-2026-051", name:"Deepak Anand", company:"Naveen Ads", phone:"+91 90000 12121", start:"2026-09-10", end:"2026-09-14", desc:"2 cameras, lighting kit, wireless mics for a 5-day ad shoot.", status:"new", notes:"Referred by Sunburst." },
    { id:"REQ-2026-052", name:"Sana Iqbal", company:"Indie", phone:"+91 98765 43210", start:"2026-09-02", end:"2026-09-04", desc:"FX3 + gimbal + prime lens set for a short film.", status:"quoted", notes:"Quote sent ₹41,000." }
  ],
  suppliers: [
    { id:"SUP-1", name:"Lens Bank Chennai", contact:"+91 94440 00011", specialisation:"Cine primes & zooms",
      catalog:[ {item:"ARRI Alexa 65",rate:45000},{item:"Master Prime Set",rate:15000},{item:"Angenieux Optimo 24-290",rate:12000},{item:"Cooke S4 Set",rate:13000},{item:"Ultra Prime Set",rate:9000} ] },
    { id:"SUP-2", name:"GripHouse", contact:"+91 94440 00022", specialisation:"Grip, rigging & transport",
      catalog:[ {item:"Technocrane 15",rate:35000},{item:"Dolly & Track",rate:6000},{item:"Jib Arm",rate:4000},{item:"Tempo Traveller",rate:8000},{item:"Camera Slider",rate:1200},{item:"45KV Generator",rate:7500} ] },
    { id:"SUP-3", name:"CineLight Rentals", contact:"+91 94440 00033", specialisation:"HMI, LED & generators",
      catalog:[ {item:"ARRI M18 HMI",rate:5000},{item:"SkyPanel S360",rate:9000},{item:"45KV Generator",rate:7000},{item:"Nanlite Forza 500",rate:3000},{item:"Aputure 1200d",rate:3500},{item:"Tempo Traveller",rate:8500} ] }
  ],
  payouts: [],
  settlements: [],  // {cam, month:"2026-08", date, pool} — a month is settled once present
  config: { maintenancePct:0.10, managerPct:0.10 }  // investor pool = 80% of gross
};
