const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"),
  CodexClient: {},
  Markdown: {},
};
require("../content/sidebar.js");
const { SidebarManager } = global.ZoteroCodexModules.Sidebar;

function fixture() {
  const reader = { itemID: 42, tabID: "pdf-tab" };
  global.Zotero = { Reader: { _readers: [reader] } };
  const manager = new SidebarManager();
  manager.revealReaderPane = async candidate => candidate === reader;
  const input = { value: "", focus() {}, setSelectionRange() {} };
  const view = {
    body: { closest: () => ({ tabID: "pdf-tab" }) },
    initialized: true, contextTransitioning: false, destroyed: false,
    context: { attachmentID: 42 }, elements: { input },
    resizeComposer() {}, updateComposerState() {},
  };
  manager.views.set("pane", view);
  return { manager, input, view };
}

test("stages a draft in the matching PDF without sending it", async () => {
  const { manager, input } = fixture();
  assert.deepEqual(await manager.prepareExternalDraft(42, "Explain attention", "pdf-tab"),
    { attachmentID: 42, appended: false });
  assert.equal(input.value, "Explain attention");
  assert.deepEqual(await manager.prepareExternalDraft(42, "Compare the comments", "pdf-tab"),
    { attachmentID: 42, appended: true });
  assert.equal(input.value, "Explain attention\n\nCompare the comments");
});

test("rejects invalid attachments and does not overwrite an edited message", async () => {
  const { manager, input, view } = fixture();
  await assert.rejects(manager.prepareExternalDraft(0, "hello"), /Invalid/);
  await assert.rejects(manager.prepareExternalDraft(42, ""), /Invalid/);
  await assert.rejects(manager.prepareExternalDraft(43, "hello"), /Open this PDF/);
  view.editingMessage = { id: "old" };
  await assert.rejects(manager.prepareExternalDraft(42, "new", "pdf-tab"), /Finish editing/);
  assert.equal(input.value, "");
});

test("initializes a pane that Zotero rendered without its async callback", async () => {
  const { manager, input, view } = fixture();
  view.initialized = false;
  let starts = 0;
  view.initialize = async () => {
    starts++;
    view.initializing = true;
    await Promise.resolve();
    view.initialized = true;
    view.initializing = false;
  };

  await manager.prepareExternalDraft(42, "Explain the guide", "pdf-tab");
  assert.equal(starts, 1);
  assert.equal(input.value, "Explain the guide");
});
