// ============================================================================
// SDB — Supabase data layer for the console.
//   • SDB.bootstrap()  loads srchub → window.DATA (camelCase shape the UI uses)
//   • write helpers persist each mutation; they no-op when offline (no creds),
//     so the console keeps working on the seed data with zero changes.
// Requires: supabase-js (CDN) + supabase-config.js loaded first.
// ============================================================================
window.SDB = (function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const ON = !!(cfg.url && cfg.anonKey && window.supabase);
  const sb = ON ? window.supabase.createClient(cfg.url, cfg.anonKey, { db: { schema: cfg.schema || "srchub" } }) : null;

  // enum <-> label maps
  const METHOD_TO_DB = { "Cash": "cash", "UPI": "upi", "Bank Transfer": "bank_transfer", "Cheque": "cheque" };
  const METHOD_FROM_DB = { cash: "Cash", upi: "UPI", bank_transfer: "Bank Transfer", cheque: "Cheque" };

  // id caches (code/name -> uuid) built during bootstrap
  const ids = { unitByCode: {}, bookingByCode: {}, supplierById: {}, investorByName: {}, optionByName: {}, lineKey: {} };

  function fail(e, what) { console.error(what, e); if (window.toast) toast("Sync error: " + what); }

  async function bootstrap() {
    if (!ON) { console.info("SDB offline — using seed data (console-data.js)."); return false; }
    try {
      const [units, invs, ainv, custs, sups, scat, reqs, books, lines, pays, setts, shares, rcfg, opts, rfqRows, rfqItemRows] =
        await Promise.all([
          sb.from("equipment_units").select("*"),
          sb.from("investors").select("*"),
          sb.from("asset_investments").select("*"),
          sb.from("customers").select("*"),
          sb.from("suppliers").select("*"),
          sb.from("supplier_catalog").select("*"),
          sb.from("quote_requests").select("*"),
          sb.from("bookings").select("*"),
          sb.from("booking_lines").select("*"),
          sb.from("payments").select("*"),
          sb.from("settlements").select("*"),
          sb.from("settlement_shares").select("*"),
          sb.from("revenue_config").select("*"),
          sb.from("catalog_options").select("*"),
          sb.from("supplier_rfqs").select("*"),
          sb.from("supplier_rfq_items").select("*")
        ]);
      for (const r of [units, invs, ainv, custs, sups, scat, reqs, books, lines, pays, setts, shares, rcfg, opts, rfqRows, rfqItemRows])
        if (r.error) throw r.error;

      const U = units.data, INV = invs.data, AINV = ainv.data;
      const unitById = {}; U.forEach(u => { unitById[u.id] = u; ids.unitByCode[u.code] = u.id; });
      const optionNameById = {}; opts.data.forEach(o => optionNameById[o.id] = o.name);
      INV.forEach(i => ids.investorByName[i.name] = i.id);
      sups.data.forEach(s => ids.supplierById[s.id] = s);

      // cameras / accessories (+ per-unit investors)
      const invById = {}; INV.forEach(i => invById[i.id] = i);
      const investorsForUnit = uid => AINV.filter(a => a.unit_id === uid)
        .map(a => ({ name: invById[a.investor_id]?.name, loc: invById[a.investor_id]?.location || "", invested: Number(a.invested_amount_inr) }));

      const cameras = U.filter(u => u.kind === "camera").map(u => ({
        code: u.code, name: u.name, manufacturer: u.manufacturer, model: u.model, serial: u.serial_number,
        meterHours: Number(u.meter_hours || 0), location: u.location, status: u.status, optionName: optionNameById[u.option_id] || null,
        dailyRate: Number(u.default_daily_rate), cost: u.purchase_cost != null ? Number(u.purchase_cost) : undefined,
        investors: investorsForUnit(u.id).length ? investorsForUnit(u.id) : undefined
      }));
      const accessories = U.filter(u => u.kind === "accessory").map(u => ({
        code: u.code, name: u.name, category: u.category, status: u.status, dailyRate: Number(u.default_daily_rate), optionName: optionNameById[u.option_id] || null
      }));

      // bookings (+ lines split by kind, + payments)
      const paysByBooking = {}; pays.data.forEach(p => (paysByBooking[p.booking_id] ||= []).push(p));
      const linesByBooking = {}; lines.data.forEach(l => (linesByBooking[l.booking_id] ||= []).push(l));
      const mapLine = l => {
        const u = unitById[l.unit_id] || {};
        const code = u.code || (l.line_kind === "hirein" ? "(hire-in)" : "(assign at checkout)");
        ids.lineKey[l.booking_id + "|" + code] = l.id;
        const o = { code, name: u.name || l.label || "—", rate: Number(l.daily_rate_inr),
          qty: l.quantity || 1, lineKind: l.line_kind || "own", supplierId: l.supplier_id || null,
          cost: l.cost_inr != null ? Number(l.cost_inr) : null,
          _lineId: l.id, optionName: l.label || null, unassigned: !u.code };
        if (l.item_start_at) o.start = l.item_start_at;
        if (l.item_end_at) o.end = l.item_end_at;
        if (l.returned_at) o.returnedAt = l.returned_at;
        if (l.checkout_hours != null) o.checkoutHours = Number(l.checkout_hours);
        if (l.return_hours != null) o.returnHours = Number(l.return_hours);
        if (l.condition_out) o.conditionOut = l.condition_out;
        if (l.condition_in) o.conditionIn = l.condition_in;
        return o;
      };
      const bookings = books.data.map(b => {
        ids.bookingByCode[b.code] = b.id;
        const ls = linesByBooking[b.id] || [];
        const c = custs.data.find(x => x.id === b.customer_id) || {};
        return {
          code: b.code, customer: b.customer_id, production: b.production_name, project: b.project_name,
          contact: b.contact_name, phone: b.contact_phone, status: b.status,
          start: b.start_at, end: b.end_at, pickup: b.pickup_location, operator: b.operator_name || "",
          otherCharges: Number(b.other_charges_inr || 0), discount: Number(b.discount_inr || 0), deposit: Number(b.deposit_inr || 0),
          cameras: ls.filter(l => l.kind === "camera").map(mapLine),
          accessories: ls.filter(l => l.kind === "accessory").map(mapLine),
          payments: (paysByBooking[b.id] || []).map(p => ({
            amount: Number(p.amount_inr), type: p.transaction_type, method: METHOD_FROM_DB[p.method] || p.method,
            date: p.received_at, ref: p.reference || ""
          }))
        };
      });

      const customers = custs.data.map(c => ({ id: c.id, name: c.name, company: c.company_name || "", phone: c.phone || "" }));
      const requests = reqs.data.map(r => ({
        id: r.request_code, _uuid: r.id, name: r.name, company: r.company || "", phone: r.phone,
        start: r.start_at, end: r.end_at, desc: r.description, status: r.status, notes: r.notes || "",
        kit: Array.isArray(r.kit) ? r.kit : []
      }));
      const optionRates = {}, optionCats = {};
      opts.data.forEach(o => { optionRates[o.name] = o.default_rate_inr != null ? Number(o.default_rate_inr) : 0; optionCats[o.name] = o.category; ids.optionByName[o.name] = o.id; });
      const suppliers = sups.data.map(s => ({
        id: s.id, name: s.name, contact: s.contact, specialisation: s.specialisation,
        catalog: scat.data.filter(c => c.supplier_id === s.id).map(c => ({ _id: c.id, item: c.item, rate: Number(c.daily_rate_inr) }))
      }));
      const unitCode = uid => unitById[uid]?.code;
      const settlements = setts.data.map(s => ({ cam: unitCode(s.unit_id), month: (s.period_month || "").slice(0, 7), date: (s.settled_at || s.period_month || "").slice(0, 10), pool: Number(s.pool_inr) }));
      const settById = {}; setts.data.forEach(s => settById[s.id] = s);
      const payouts = shares.data.map(sh => ({
        cam: unitCode(settById[sh.settlement_id]?.unit_id), investor: invById[sh.investor_id]?.name,
        amount: Number(sh.amount_inr), date: (settById[sh.settlement_id]?.settled_at || "").slice(0, 10),
        mode: "Monthly settlement", month: (settById[sh.settlement_id]?.period_month || "").slice(0, 7)
      }));
      const g = rcfg.data.find(r => r.unit_id == null) || rcfg.data[0] || { maintenance_pct: 0.1, manager_pct: 0.1 };
      const config = { maintenancePct: Number(g.maintenance_pct), managerPct: Number(g.manager_pct) };

      const bookingCodeById = {}; books.data.forEach(bk => bookingCodeById[bk.id] = bk.code);
      const rfqItemsByRfq = {}; rfqItemRows.data.forEach(it => (rfqItemsByRfq[it.rfq_id] ||= []).push(it));
      const rfqs = rfqRows.data.map(q => ({
        id: q.id, code: q.rfq_code, supplierId: q.supplier_id, supplierName: (ids.supplierById[q.supplier_id] || {}).name || "—",
        supplierContact: (ids.supplierById[q.supplier_id] || {}).contact || "",
        bookingCode: bookingCodeById[q.booking_id] || null, status: q.status, notes: q.notes || "",
        start: q.start_at, end: q.end_at, pickup: q.pickup_at, ret: q.return_at,
        items: (rfqItemsByRfq[q.id] || []).map(it => ({ id: it.id, item: it.item, qty: it.qty || 1, requestedRate: it.requested_rate_inr != null ? Number(it.requested_rate_inr) : null, quotedRate: it.quoted_rate_inr != null ? Number(it.quoted_rate_inr) : null }))
      }));
      window.DATA = { cameras, accessories, customers, bookings, requests, suppliers, payouts, settlements, config, optionRates, optionCats, rfqs };
      console.info("SDB live — loaded from Supabase.");
      return true;
    } catch (e) { fail(e, "load"); return false; }
  }

  // ---- writes (fire-and-forget; safe no-op offline) ----
  const guard = fn => (...a) => { if (!ON) return; fn(...a).catch(e => fail(e, "save")); };

  const createBooking = guard(async (b, cust) => {
    let customer_id = null;
    if (cust && cust.name) {
      const { data, error } = await sb.from("customers").insert({ name: cust.name, company_name: cust.company || null, phone: cust.phone || null }).select("id").single();
      if (error) throw error; customer_id = data.id;
    }
    const { data: bk, error: be } = await sb.from("bookings").insert({
      code: b.code, customer_id, status: b.status, production_name: b.production, project_name: b.project,
      contact_name: b.contact, contact_phone: b.phone, start_at: b.start, end_at: b.end, pickup_location: b.pickup
    }).select("id").single();
    if (be) throw be;
    ids.bookingByCode[b.code] = bk.id;
    const rows = [...b.cameras.map(c => ({ ...c, kind: "camera" })), ...b.accessories.map(a => ({ ...a, kind: "accessory" }))]
      .map(l => ({ booking_id: bk.id, unit_id: ids.unitByCode[l.code], kind: l.kind, daily_rate_inr: l.rate }));
    if (rows.length) { const { error } = await sb.from("booking_lines").insert(rows); if (error) throw error; }
  });

  const addPayment = guard(async (code, p) => {
    const { error } = await sb.from("payments").insert({
      booking_id: ids.bookingByCode[code], amount_inr: p.amount, transaction_type: p.type,
      method: METHOD_TO_DB[p.method] || "upi", received_at: p.date, reference: p.ref || null
    }); if (error) throw error;
  });

  const returnEarly = guard(async (code, unitCode, date, cond) => {
    const { error } = await sb.from("booking_lines").update({ returned_at: date, condition_in: cond })
      .eq("id", ids.lineKey[ids.bookingByCode[code] + "|" + unitCode]); if (error) throw error;
  });

  const addEquip = guard(async (code, line, isCam) => {
    const bid = ids.bookingByCode[code];
    const { data, error } = await sb.from("booking_lines").insert({
      booking_id: bid, unit_id: ids.unitByCode[line.code], kind: isCam ? "camera" : "accessory",
      daily_rate_inr: line.rate, item_start_at: line.start, item_end_at: line.end, added_mid_booking: true
    }).select("id").single();
    if (error) throw error; ids.lineKey[bid + "|" + line.code] = data.id;
  });

  const confirmOps = guard(async (b, newStatus) => {
    const bid = ids.bookingByCode[b.code];
    const { error } = await sb.from("bookings").update({ status: newStatus }).eq("id", bid); if (error) throw error;
    const upd = async (l, cam) => {
      const lid = l._lineId || ids.lineKey[bid + "|" + l.code]; if (!lid) return;
      const patch = newStatus === "checked_out" ? { condition_out: l.conditionOut } : { condition_in: l.conditionIn };
      if (cam) { if (newStatus === "checked_out") patch.checkout_hours = l.checkoutHours; else patch.return_hours = l.returnHours; }
      await sb.from("booking_lines").update(patch).eq("id", lid);
      if (cam && newStatus === "returned" && l.returnHours != null && ids.unitByCode[l.code])
        await sb.from("equipment_units").update({ meter_hours: l.returnHours }).eq("id", ids.unitByCode[l.code]);
    };
    for (const l of b.cameras) await upd(l, true);
    for (const l of b.accessories) await upd(l, false);
  });

  const settleMonth = guard(async (camCode, mk) => {
    const { error } = await sb.rpc("settle_month", { p_unit: ids.unitByCode[camCode], p_month: mk + "-01" });
    if (error) throw error;
  });

  const addSupplierItem = guard(async (sid, item, rate) => {
    const { error } = await sb.from("supplier_catalog").insert({ supplier_id: sid, item, daily_rate_inr: rate }); if (error) throw error;
  });
  const editSupplierRate = guard(async (catId, item, rate) => {
    const { error } = await sb.from("supplier_catalog").update({ item, daily_rate_inr: rate }).eq("id", catId); if (error) throw error;
  });
  const setRequestStatus = guard(async (reqUuid, status) => {
    const { error } = await sb.from("quote_requests").update({ status }).eq("id", reqUuid); if (error) throw error;
  });
  const createRFQ = async (rfq) => {
    if (!ON) return null;
    try {
      const { data: q, error } = await sb.from("supplier_rfqs").insert({ rfq_code: rfq.code, supplier_id: rfq.supplierId || null, booking_id: rfq.bookingId || null, status: rfq.status || "draft", notes: rfq.notes || null, start_at: rfq.start || null, end_at: rfq.end || null, pickup_at: rfq.pickup || null, return_at: rfq.ret || null }).select("id").single();
      if (error) throw error;
      if (rfq.items && rfq.items.length) await sb.from("supplier_rfq_items").insert(rfq.items.map(it => ({ rfq_id: q.id, item: it.item, qty: it.qty || 1, requested_rate_inr: it.requestedRate || null, quoted_rate_inr: it.quotedRate || null })));
      return q.id;
    } catch (e) { fail(e, "create rfq"); return null; }
  };
  const updateRFQStatus = guard(async (rfqId, status) => { const { error } = await sb.from("supplier_rfqs").update({ status }).eq("id", rfqId); if (error) throw error; });
  const setRFQItemRate = guard(async (itemId, quoted) => { const { error } = await sb.from("supplier_rfq_items").update({ quoted_rate_inr: quoted }).eq("id", itemId); if (error) throw error; });
  // assign a real serial unit to an option-level booking line (at checkout)
  const assignUnit = guard(async (lineId, unitCode) => {
    const unitId = ids.unitByCode[unitCode]; if (!lineId || !unitId) return;
    const { error } = await sb.from("booking_lines").update({ unit_id: unitId }).eq("id", lineId); if (error) throw error;
    await sb.from("equipment_units").update({ status: "booked" }).eq("id", unitId);
  });
  const qItems = (qid, lines) => lines.filter(l => l.type === "header" || l.name).map((l, i) => ({
    quotation_id: qid, label: l.name || "", line_type: l.type || "item", note: l.spec || null, raw: l.raw || null,
    daily_rate_inr: (l.type === "header" ? 0 : (l.rate || 0)), days: l.days || 1, qty: l.qty || 1, sort: i,
    line_kind: l.kind || "own", supplier_id: l.supplierId || null, cost_inr: (l.cost != null ? l.cost : null),
    catalog_option_id: (ids.optionByName[l.name] || null)
  }));
  // persist a quotation (with the verbatim original + pricing) + its line items
  const saveQuotation = guard(async (reqUuid, quoteCode, lines, status, sourceText, opts) => {
    opts = opts || {};
    const { data: q, error } = await sb.from("quotations").insert({ quote_code: quoteCode, request_id: reqUuid || null, status: status || "draft", source_text: sourceText || null, discount_inr: opts.discount_inr || 0, deposit_inr: opts.deposit_inr || 0, valid_until: opts.valid_until || null }).select("id").single();
    if (error) throw error;
    const items = qItems(q.id, lines);
    if (items.length) { const { error: e2 } = await sb.from("quotation_items").insert(items); if (e2) throw e2; }
    return q.id;
  });
  const createRequest = async (code, r) => {
    if (!ON) return null;
    try { const { data, error } = await sb.from("quote_requests").insert({ request_code: code, name: r.name, phone: r.phone || null, company: r.company || null, start_at: r.start || null, end_at: r.end || null, description: r.desc || null, source: "walk_in" }).select("id").single(); if (error) throw error; return data.id; }
    catch (e) { fail(e, "create request"); return null; }
  };
  // convert a quote to a real booking (option-level lines; unit assigned at checkout)
  async function convertQuote(reqUuid, req, quoteCode, lines, sourceText, opts) {
    opts = opts || {};
    const code = "BK-2026-" + String(Date.now()).slice(-6);
    const cd = Math.max(1, Math.ceil((new Date(req.end) - new Date(req.start)) / 86400000));
    const billed = d => { d = d || cd; if (!opts.weekMode || d < 7) return d; const w = Math.floor(d / 7), rem = d % 7, dpw = opts.daysPerWeek || 4; return w * dpw + Math.min(rem, dpw); };
    const items = lines.filter(l => l.type !== "header" && l.name && l.include !== false && ["own", "hirein", "custom"].includes(l.kind));
    if (!ON) return { code };
    try {
      const { data: c, error: ce } = await sb.from("customers").insert({ name: req.name, company_name: req.company || null, phone: req.phone || null }).select("id").single();
      if (ce) throw ce;
      const { data: b, error: be } = await sb.from("bookings").insert({
        code, customer_id: c.id, status: "confirmed", production_name: req.company || req.name,
        project_name: "Booking — " + req.name, contact_name: req.name, contact_phone: req.phone,
        start_at: req.start, end_at: req.end, pickup_location: "Studio floor",
        other_charges_inr: opts.other_charges_inr || 0, discount_inr: opts.discount_inr || 0, deposit_inr: opts.deposit_inr || 0
      }).select("id").single();
      if (be) throw be; ids.bookingByCode[code] = b.id;
      const rows = items.map(l => { const kind = ((DATA.optionCats || {})[l.name] === "Cameras") ? "camera" : "accessory";
        const bd = billed(l.days), eff = (opts.weekMode && cd > 0) ? Math.round((l.rate || 0) * bd / cd) : (l.rate || 0);
        return { booking_id: b.id, unit_id: null, kind, label: l.name, catalog_option_id: (ids.optionByName[l.name] || null),
          line_kind: l.kind || "own", supplier_id: l.supplierId || null, cost_inr: (l.cost != null ? l.cost : null),
          daily_rate_inr: eff, quantity: l.qty || 1 }; });
      if (rows.length) { const { error: le } = await sb.from("booking_lines").insert(rows); if (le) throw le; }
      const { data: q } = await sb.from("quotations").insert({ quote_code: quoteCode, request_id: reqUuid || null, booking_id: b.id, status: "accepted", source_text: sourceText || null, discount_inr: opts.discount_inr || 0, deposit_inr: opts.deposit_inr || 0, valid_until: opts.valid_until || null }).select("id").single();
      if (q) { const qi = qItems(q.id, lines); if (qi.length) await sb.from("quotation_items").insert(qi); }
      // hire-in RFQs — one per supplier
      const bySup = {}; items.filter(l => l.kind === "hirein" && l.supplierId).forEach(l => { (bySup[l.supplierId] = bySup[l.supplierId] || []).push(l); });
      for (const sid in bySup) {
        const { data: rfq } = await sb.from("supplier_rfqs").insert({ rfq_code: "RFQ-" + String(Date.now()).slice(-6), supplier_id: sid, booking_id: b.id, status: "draft", start_at: req.start, end_at: req.end }).select("id").single();
        if (rfq) await sb.from("supplier_rfq_items").insert(bySup[sid].map(l => ({ rfq_id: rfq.id, item: l.name, qty: l.qty || 1, requested_rate_inr: l.cost || null })));
      }
      if (reqUuid) await sb.from("quote_requests").update({ status: "converted" }).eq("id", reqUuid);
      return { code, customer_id: c.id };
    } catch (e) { fail(e, "convert"); return { code, error: String(e && e.message || e) }; }
  }

  // ---- auth + user management ----
  async function currentUser(){ if(!ON) return { id:"offline", email:"offline" }; const { data } = await sb.auth.getUser(); return data.user || null; }
  async function signIn(email, password){ const { data, error } = await sb.auth.signInWithPassword({ email, password }); return { user: data && data.user, error }; }
  async function signOut(){ if(ON) await sb.auth.signOut(); }
  async function myProfile(){ if(!ON) return { role:"admin", full_name:"Demo", is_active:true }; const u=(await sb.auth.getUser()).data.user; if(!u) return null; const { data } = await sb.from("profiles").select("*").eq("id", u.id).maybeSingle(); return data; }
  async function listProfiles(){ if(!ON) return []; const { data, error } = await sb.from("profiles").select("*").order("full_name"); return error ? [] : data; }
  async function setProfile(id, patch){ if(!ON) return; await sb.from("profiles").update(patch).eq("id", id); }
  async function addUser(email, password, full_name, role){
    if(!ON) return { error:"offline" };
    const tmp = window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:false, autoRefreshToken:false, storageKey:"src-signup-tmp-"+email }, db:{ schema: cfg.schema||"srchub" } });
    const { data, error } = await tmp.auth.signUp({ email, password });
    if(error) return { error: error.message };
    const uid = data.user && data.user.id;
    if(uid){ const { error:pe } = await sb.from("profiles").insert({ id: uid, full_name: full_name||email, role: role||"manager", is_active:true }); if(pe) return { error: pe.message }; }
    return { error:null };
  }

  return { on: ON, bootstrap, ids, currentUser, signIn, signOut, myProfile, listProfiles, setProfile, addUser, createBooking, addPayment, returnEarly, addEquip, confirmOps, settleMonth, addSupplierItem, editSupplierRate, setRequestStatus, saveQuotation, convertQuote, createRequest, assignUnit, createRFQ, updateRFQStatus, setRFQItemRate };
})();
