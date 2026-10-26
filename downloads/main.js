"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// checker.js
var require_checker = __commonJS({
  "checker.js"(exports2, module2) {
    "use strict";
    var ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var SCOPE2 = "Explicit standalone assertions only. Ordinary prose and unsupported code syntax are unchecked. No consistency, truth or completeness certification.";
    function decimal(s) {
      if (typeof s !== "string" || s.length > 1e3 || !/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(s)) throw Error("Invalid decimal");
      const negative = s[0] === "-";
      const clean = s.replace(/^[+-]/, "");
      const [whole, fraction = ""] = clean.split(".");
      const scale = 10n ** BigInt(fraction.length);
      const magnitude = BigInt(whole + fraction);
      if (magnitude > 1000000000000000n * scale) throw Error("Decimal out of bounds");
      return { n: negative ? -magnitude : magnitude, scale };
    }
    var abs = (n) => n < 0n ? -n : n;
    function within(a, b) {
      const difference = abs(a.n * b.scale - b.n * a.scale);
      return b.n === 0n ? difference * 200n <= a.scale * b.scale : difference * 200n <= abs(b.n) * a.scale;
    }
    function check2(note, declarations) {
      if (typeof note !== "string" || note.length > 1e5) throw Error("Note must be text of at most 100000 characters");
      if (!Array.isArray(declarations) || declarations.length < 1 || declarations.length > 20) throw Error("Provide 1 to 20 declarations");
      const facts = /* @__PURE__ */ new Map();
      for (const d of declarations) {
        if (!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).sort().join(",") !== "id,value" || typeof d.id !== "string" || d.id.length > 80 || !ID.test(d.id) || facts.has(d.id)) throw Error("Invalid or duplicate declaration");
        facts.set(d.id, { raw: d.value, parsed: decimal(d.value) });
      }
      const assertions = [], diagnostics = [], seen = /* @__PURE__ */ new Set();
      const lines = note.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, "");
        const fence = line.match(/^(`{3,}|~{3,})[^`~]*$/);
        if (fence) {
          const close = new RegExp("^" + fence[1][0] + "{" + fence[1].length + ",}[ \\t]*$");
          let j = i + 1;
          while (j < lines.length && !close.test(lines[j].replace(/\r$/, ""))) j++;
          if (j === lines.length) diagnostics.push({ line: i + 1, code: "unclosed_code_unchecked" });
          i = j;
          continue;
        }
        if (/^`[^`]*`[ \t]*$/.test(line)) continue;
        if (!line.includes("=")) continue;
        if (/^[ \t]/.test(line) || /[`~]/.test(line)) {
          diagnostics.push({ line: i + 1, code: "unsupported_code_or_indent" });
          continue;
        }
        const split = line.indexOf("=");
        const id = line.slice(0, split).trim(), value = line.slice(split + 1).trim();
        if (!ID.test(id) || id.length > 80) {
          diagnostics.push({ line: i + 1, code: "invalid_id" });
          continue;
        }
        if (seen.has(id)) diagnostics.push({ line: i + 1, code: "duplicate_assertion" });
        seen.add(id);
        if (!facts.has(id)) diagnostics.push({ line: i + 1, code: "unknown_id" });
        let parsed;
        try {
          parsed = decimal(value);
        } catch {
          diagnostics.push({ line: i + 1, code: "invalid_value" });
          continue;
        }
        if (facts.has(id)) assertions.push({
          line: i + 1,
          id,
          value,
          expected: facts.get(id).raw,
          status: within(parsed, facts.get(id).parsed) ? "within_tolerance" : "mismatch"
        });
      }
      return { scope: SCOPE2, assertions, diagnostics, consistency_certified: false };
    }
    module2.exports = { check: check2, SCOPE: SCOPE2 };
  }
});

// main.js
var { Plugin, Modal } = require("obsidian");
var { check, SCOPE } = require_checker();
var AssertionModal = class extends Modal {
  constructor(app, note) {
    super(app);
    this.note = note;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: "Check explicit numeric assertions" });
    root.createEl("p", { text: SCOPE });
    root.createEl("p", { text: 'Paste JSON: [{"id":"members","value":"100"}]. Values must be decimal strings. Active-editor text was captured when this command opened.' });
    const input = root.createEl("textarea", { attr: { "aria-label": "Numeric declarations JSON", rows: "8" } });
    const button = root.createEl("button", { text: "Check captured note" });
    const output = root.createEl("pre", { attr: { "aria-live": "polite" } });
    button.addEventListener("click", () => {
      try {
        if (input.value.length > 25e3) throw Error("Input too large");
        const result = check(this.note, JSON.parse(input.value));
        output.textContent = JSON.stringify(result, null, 2);
      } catch {
        output.textContent = "Invalid input. Use 1\u201320 unique ASCII IDs and bounded decimal-string values; note maximum 100000 characters. Nothing was certified.";
      }
    });
  }
  onClose() {
    this.note = "";
    this.contentEl.empty();
  }
};
module.exports = class VaultGuardPrototype extends Plugin {
  onload() {
    this.addCommand({
      id: "check-explicit-active-note",
      name: "Check explicit assertions in active editor",
      editorCallback: (editor) => new AssertionModal(this.app, editor.getValue()).open()
    });
  }
};
