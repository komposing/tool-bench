// Local stand-in for the ca-v3-drafting webhook (UI mechanics only): append-only log, engine-minted seq,
// missing_ops when expect_seq is behind, replay since_seq, list, find. Every request body is recorded.
const fs = require("fs");
module.exports = function mock(seed){
  const S = JSON.parse(fs.readFileSync(seed, "utf8"));
  const drafts = { dmvx0i3t3686r: { title: "smoke", ops: S.ops.slice() } };
  const sent = [];
  function handle(body, key){
    if (key !== "test-key") return { status: 401, json: { status: "error", outcome: "unauthorised" } };
    sent.push(body);
    const d = drafts[body.draft_id];
    switch (body.op) {
      case "list": return { json: { outcome: "ok", protocol: "ca.draft/1", status: "ok", drafts: Object.entries(drafts).map(([id, x]) => ({ draft_id: id, title: x.title, seq_head: x.ops.length, last_author: x.ops[x.ops.length-1].author, updated: x.ops[x.ops.length-1].ts, open_requests: 0 })) } };
      case "open": {
        let id = body.draft_id;
        if (!id) { id = "dmock" + Object.keys(drafts).length; drafts[id] = { title: body.title, ops: [{ seq: 1, author: body.author || "user", ts: new Date().toISOString(), op: "draft.create", payload: { title: body.title, attributes: { agent_ops: "ghost" } }, origin_request: "" }] }; }
        const x = drafts[id]; if (!x) return { json: { status: "error", outcome: "param_rejected", errors: [{ param: "draft_id", reason: "unknown" }] } };
        return { json: { outcome: "ok", status: "ok", protocol: "ca.draft/1", draft_id: id, seq_head: x.ops.length, snapshot: {}, palette: S.palette } };
      }
      case "replay": return { json: { outcome: "ok", status: "ok", protocol: "ca.draft/1", draft_id: body.draft_id, ops: d.ops.filter(o => o.seq > (body.since_seq || 0) && (!body.exclude_author || o.author !== body.exclude_author)), seq_head: d.ops.length } };
      case "apply": {
        const head = d.ops.length, missing = body.expect_seq != null && body.expect_seq < head ? d.ops.filter(o => o.seq > body.expect_seq) : null;
        for (const [i, o] of body.ops.entries()) if (!o.payload || (!o.payload.id && !/^(draft|view|ops|reason)\./.test(o.op))) return { json: { status: "error", outcome: "param_rejected", errors: [{ param: `ops[${i}].payload.id`, value: "", reason: "id required for " + o.op }] } };
        const applied = body.ops.map(o => { const seq = d.ops.length + 1; d.ops.push({ seq, author: body.author || "user", ts: new Date().toISOString(), op: o.op, payload: o.payload, origin_request: o.origin_request || "" }); return { op_id: body.draft_id + ":" + seq, seq }; });
        return { json: Object.assign({ outcome: "ok", status: "ok", protocol: "ca.draft/1", draft_id: body.draft_id, applied, seq_head: d.ops.length }, missing ? { missing_ops: missing } : {}) };
      }
      case "find": {
        const cards = [];
        if (body.scope.includes("docs") && /drafting/i.test(body.q)) cards.push({ kind: "doc_section", id: "drafting_table/design", title: "drafting_table/design v1", excerpt: "A paired concept-modelling surface", source_ref: { type: "doc", doc_key: "drafting_table", section: "design", version: 1 } });
        if (body.scope.includes("drafts") && /ship/i.test(body.q)) cards.push({ kind: "draft_object", id: "dmvx0i3t3686r:node:n1", title: "ship it (node, smoke)", excerpt: "ship it", source_ref: { type: "draft", draft_id: "dmvx0i3t3686r", ref: { type: "node", id: "n1" } } });
        return { json: { outcome: "ok", status: "ok", protocol: "ca.draft/1", cards, counts: { docs: cards.filter(c => c.kind === "doc_section").length, drafts: cards.filter(c => c.kind === "draft_object").length } } };
      }
    }
    return { json: { status: "error", outcome: "param_rejected", errors: [{ param: "op", reason: "unknown" }] } };
  }
  // agent side, as ca_call drafting.apply would do it
  function agentApply(draft_id, ops){ return handle({ op: "apply", draft_id, ops, author: "agent:test" }, "test-key").json; }
  return { handle, agentApply, drafts, sent };
};
