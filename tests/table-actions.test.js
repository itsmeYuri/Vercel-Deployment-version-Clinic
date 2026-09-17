"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../public/assets/js/main.js"), "utf8");
const handler = source.slice(source.indexOf("  async function handleDashboardClick("), source.indexOf("  function applyPageFilters("));

// Minimal ancestor matching to exercise delegated clicks, including nested icons.
function element(tag, dataset = {}, parentElement = null) {
  return {
    tag, dataset, parentElement,
    matches(selector) {
      return selector.split(",").some((part) => {
        const match = part.trim().match(/^(\w+)?\[data-([\w-]+)\]$/);
        if (!match) return false;
        const key = match[2].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        return (!match[1] || match[1] === this.tag) && Object.hasOwn(this.dataset, key);
      });
    },
    closest(selector) {
      return this.matches(selector) ? this : this.parentElement?.closest(selector) || null;
    },
  };
}

async function run() {
  const calls = [];
  const context = vm.createContext({
    document: {},
    setPage: (page) => calls.push(["navigate", page]),
    openDrawer: (type, id) => calls.push(["drawer", type, id]),
    closeDrawer() {},
    paginateTables: () => calls.push(["paginate"]),
    downloadRecords: async () => calls.push(["download"]),
    $: () => null,
  });
  vm.runInContext(handler, context);
  const click = async (target) => {
    calls.length = 0;
    await context.handleDashboardClick({ target, preventDefault() {} });
  };
  const card = element("section", { paginatedTable: "", tablePage: "1" });
  for (const [role, actions] of [
    ["Admin", ["user", "facility", "test", "order", "result"]],
    ["Doctor", ["patient", "order", "result"]],
    ["Laboratory Staff", ["order", "result"]],
    ["Patient", ["order", "result"]],
  ]) {
    for (const action of actions) {
      const button = element("button", { drawer: action, id: "42" }, card);
      await click(element("svg", {}, button));
      assert.deepEqual(calls, [["drawer", action, "42"]], `${role}: ${action}`);
    }
  }
  await click(element("button", { tableNext: "" }, card));
  assert.equal(card.dataset.tablePage, "2");
  assert.deepEqual(calls, [["paginate"]]);
  await click(element("button", { tablePrev: "" }, card));
  assert.equal(card.dataset.tablePage, "1");
  await click(element("td", {}, card));
  assert.deepEqual(calls, [], "Plain table cells must not navigate");
  await click(element("a", { download: "" }, card));
  assert.deepEqual(calls, [["download"]]);

  // Legacy or unrelated containers must never intercept a nested action.
  card.dataset.page = "1";
  await click(element("button", { drawer: "result", id: "7" }, card));
  assert.deepEqual(calls, [["drawer", "result", "7"]]);
  await click(element("span", {}, element("a", { page: "orders" })));
  assert.deepEqual(calls, [["navigate", "orders"]]);
  await click(element("button", { goPage: "settings" }));
  assert.deepEqual(calls, [["navigate", "settings"]]);
  console.log("Table action routing tests passed for all four roles.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
