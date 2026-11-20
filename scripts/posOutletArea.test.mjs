import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const searchSource = await readFile(new URL("../src/components/pos/CustomerOutletSearch.tsx", import.meta.url), "utf8");
const posSource = await readFile(new URL("../src/pages/POS/POS.tsx", import.meta.url), "utf8");

function compile(source, moduleRequire) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const module = { exports: {} };
  runInThisContext(`(function (require, module, exports) { ${outputText}\n})`)(
    moduleRequire, module, module.exports
  );
  return module.exports;
}

function createSearch(props) {
  const state = [];
  let index = 0;
  const search = compile(searchSource, (name) => {
    if (name === "react") {
      return {
        useState(initial) {
          const current = index++;
          if (!(current in state)) state[current] = initial;
          return [state[current], (value) => { state[current] = value; }];
        },
        useMemo: (callback) => callback(),
        useRef: () => ({ current: null }),
        useEffect: () => {},
      };
    }
    if (name === "../ui/Input") return { default: function Input() {} };
    return require(name);
  }).default;

  function render() {
    index = 0;
    return search(props);
  }

  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }

  return {
    nodes() {
      return nodes(render());
    },
    open() {
      const input = nodes(render()).find((node) => node.props?.id === "pos-customer-name");
      input.props.onFocus();
    },
    suggestions() {
      return nodes(render()).filter((node) => node.type === "button" && node.key);
    },
  };
}

const outlets = [
  { id: "iao", outletName: "Store IAO", areaCode: "IAO", status: "Active" },
  { id: "cbr", outletName: "Store CBR", areaCode: "CBR", status: "Active" },
  ...["EAST", "WEST", "CGY", "LANAO", "BUKIDNON", null].map((subarea) => ({
    id: `eft-${subarea ?? "unassigned"}`,
    outletName: `Store ${subarea ?? "unassigned"}`,
    areaCode: "EFT",
    eftSubareaCode: subarea,
    status: "Active",
  })),
  { id: "inactive", outletName: "Store inactive", areaCode: "EFT", status: "Inactive" },
];

test("outlet suggestions show only active outlets in the selected area", () => {
  for (const [area, expected] of [
    ["IAO", ["iao"]],
    ["CBR", ["cbr"]],
    ["EFT", ["eft-EAST", "eft-WEST", "eft-CGY", "eft-LANAO", "eft-BUKIDNON", "eft-unassigned"]],
    ["", []],
  ]) {
    const selected = [];
    const search = createSearch({
      outlets,
      saleAreaCode: area,
      customerName: "Store",
      customerAddress: "Manual address",
      customerPhone: "Manual phone",
      selectedOutlet: null,
      onSelectOutlet: (outlet) => selected.push(outlet.id),
    });
    search.open();
    const suggestions = search.suggestions();
    assert.deepEqual(suggestions.map((node) => node.key), expected);
    for (const suggestion of suggestions) suggestion.props.onClick();
    assert.deepEqual(selected, expected);
  }
});

function makeAreaChange(setSaleAreaCode, setSelectedOutlet) {
  const sourceFile = ts.createSourceFile("POS.tsx", posSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === "updateSaleAreaCode") {
      assert.ok(node.initializer && ts.isCallExpression(node.initializer));
      callback = node.initializer.arguments[0].getText(sourceFile);
    }
    ts.forEachChild(node, find);
  }
  find(sourceFile);
  assert.ok(callback);

  const { outputText } = ts.transpileModule(
    `function make(setSaleAreaCode, setSelectedOutlet) { return ${callback}; }`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  );
  const make = runInThisContext(`${outputText}\nmake`);
  return make(setSaleAreaCode, setSelectedOutlet);
}

test("changing the area clears only a mismatched outlet association", () => {
  const props = {
    outlets,
    saleAreaCode: "EFT",
    customerName: "Store",
    customerAddress: "Original address",
    customerPhone: "Original phone",
    selectedOutlet: null,
    onSelectOutlet(outlet) {
      props.selectedOutlet = outlet;
      props.customerName = outlet.outletName;
    },
    onClearOutlet() { props.selectedOutlet = null; },
    onCustomerNameChange(value) { props.customerName = value; },
    onCustomerAddressChange(value) { props.customerAddress = value; },
    onCustomerPhoneChange(value) { props.customerPhone = value; },
  };
  const search = createSearch(props);
  search.open();
  search.suggestions()[0].props.onClick();
  assert.equal(props.selectedOutlet, outlets[2]);
  search.nodes().find((node) => node.props?.label === "Address").props.onChange({ target: { value: "Manual address" } });
  search.nodes().find((node) => node.props?.label === "Phone").props.onChange({ target: { value: "Manual phone" } });
  const changeArea = makeAreaChange(
    (value) => { props.saleAreaCode = value; },
    (update) => { props.selectedOutlet = update(props.selectedOutlet); },
  );
  const customer = [props.customerName, props.customerAddress, props.customerPhone];

  changeArea("EFT");
  assert.equal(props.selectedOutlet, outlets[2]);
  changeArea("IAO");
  assert.equal(props.saleAreaCode, "IAO");
  assert.equal(props.selectedOutlet, null);
  const rendered = search.nodes();
  assert.equal(rendered.find((node) => node.props?.id === "pos-customer-name").props.value, customer[0]);
  assert.equal(rendered.find((node) => node.props?.label === "Address").props.value, customer[1]);
  assert.equal(rendered.find((node) => node.props?.label === "Phone").props.value, customer[2]);
  props.selectedOutlet = outlets[0];
  changeArea("");
  assert.equal(props.selectedOutlet, null);
  search.nodes().find((node) => node.props?.id === "pos-customer-name").props.onChange({ target: { value: "Manual name" } });
  changeArea("CBR");
  assert.equal(props.selectedOutlet, null);
  assert.deepEqual(
    [props.customerName, props.customerAddress, props.customerPhone],
    ["Manual name", customer[1], customer[2]],
  );
});

test("delayed assigned area clears only the outlet while checkout recovery stays intact", async (t) => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const retrySource = await readFile(new URL("../src/utils/posRetryRecovery.ts", import.meta.url), "utf8");
  const retry = compile(retrySource, require);
  const userId = "9caa4ffb-51b0-4ea6-96d2-d2621873d554";
  const product = { id: "product-1", name: "Product", code: "P1", category: "Pint", unit: "pc", price: 100, minimumStock: 1 };
  const outlet = {
    ...outlets[2],
    id: "1c9a0351-b784-4f41-9b26-c15036aa98e7",
    completeAddress: "Outlet address",
    contactNumber: "123",
  };
  let resolveArea;
  let resolveCheckout;
  const areaResponse = new Promise((resolve) => { resolveArea = resolve; });
  const checkoutResponse = new Promise((resolve) => { resolveCheckout = resolve; });
  const calls = [];
  const supabase = {
    rpc(name, payload) {
      calls.push({ name, payload });
      if (name === "get_current_user_area_code") return areaResponse;
      if (name === "create_pos_transaction_for_area_v2") return checkoutResponse;
      throw new Error(`Unexpected RPC: ${name}`);
    },
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
  };

  const state = [];
  const refs = [];
  const effects = [];
  let stateIndex = 0;
  let refIndex = 0;
  let firstRender = true;
  const components = {
    "../../components/ui/Button": { default: function Button() {} },
    "../../components/ui/Input": { default: function Input() {} },
    "../../components/ui/Select": { default: function Select() {} },
    "../../components/pos/CustomerOutletSearch": { default: function CustomerOutletSearch() {} },
    "../../components/pos/A5DeliveryReceiptPrint": { default: function A5DeliveryReceiptPrint() {} },
  };
  const POS = compile(posSource, (name) => {
    if (name === "react") {
      return {
        useState(initial) {
          const current = stateIndex++;
          if (!(current in state)) state[current] = initial;
          return [state[current], (value) => {
            state[current] = typeof value === "function" ? value(state[current]) : value;
          }];
        },
        useRef(initial) {
          const current = refIndex++;
          if (!(current in refs)) refs[current] = { current: initial };
          return refs[current];
        },
        useMemo: (callback) => callback(),
        useCallback: (callback) => callback,
        useEffect: (callback) => { if (firstRender) effects.push(callback); },
      };
    }
    if (name === "react-dom") return { createPortal: (element) => element };
    if (name === "../../lib/supabase") return { supabase };
    if (name === "../../utils/posRetryRecovery") return retry;
    if (name === "../../context/ToastContext") return { useToast: () => ({ showToast() {} }) };
    if (name === "../../hooks/useInventory") return { useInventory: () => ({
      products: [product], inventory: [{ ...product, stock: 10 }], outlets: [outlet],
      isLoading: false, loadError: null, inventorySyncStatus: "fresh",
      inventoryRealtimeStatus: "subscribed", inventoryLastSyncedAt: null,
      inventorySyncError: null, refreshInventory: async () => {},
    }) };
    if (name === "../../utils/a5DeliveryReceipt") return { getA5ReceiptCatalogIssue: () => null, getA5ReceiptDataIssue: () => null };
    if (name === "../../utils/receiptParties") return { resolveReceiptParties: () => ({}) };
    if (name === "../../utils/receiptPrinting") return { printReceipt() {} };
    return components[name] ?? require(name);
  }).default;

  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  function render() {
    stateIndex = 0;
    refIndex = 0;
    const tree = nodes(POS());
    firstRender = false;
    return tree;
  }
  function find(tree, predicate) {
    const node = tree.find(predicate);
    assert.ok(node, "expected POS control to be present");
    return node;
  }

  let tree = render();
  const cleanups = effects.map((effect) => effect()).filter((cleanup) => typeof cleanup === "function");
  t.after(() => cleanups.forEach((cleanup) => cleanup()));
  await new Promise((resolve) => setTimeout(resolve, 0));
  tree = render();
  find(tree, (node) => node.type === "button" && node.key === product.id).props.onClick();
  tree = render();
  find(tree, (node) => node.props?.onClick?.name === "confirmAddToCart").props.onClick();
  tree = render();
  find(tree, (node) => node.props?.onClick?.name === "openCheckout").props.onClick();
  tree = render();
  find(tree, (node) => node.props?.label === "Receipt area").props.onChange({ target: { value: "EFT" } });
  tree = render();
  let search = find(tree, (node) => typeof node.props?.onSelectOutlet === "function");
  search.props.onSelectOutlet(outlet);
  search.props.onCustomerAddressChange("Manual address");
  search.props.onCustomerPhoneChange("Manual phone");
  tree = render();
  search = find(tree, (node) => typeof node.props?.onSelectOutlet === "function");
  assert.equal(search.props.selectedOutlet.id, outlet.id);
  const before = [search.props.customerName, search.props.customerAddress, search.props.customerPhone];
  find(tree, (node) => node.props?.label === "Checkout Amount Estimate").props.onChange({ target: { value: "100" } });
  tree = render();
  const submit = find(tree, (node) => node.props?.onClick?.name === "completeSale");
  void submit.props.onClick();
  const key = retry.checkoutRetryStorageKey(userId);
  const savedAttempt = storage.get(key);
  assert.ok(savedAttempt);
  assert.equal(retry.readCheckoutAttempt(userId).status, "valid");
  assert.equal(calls.at(-1).name, "create_pos_transaction_for_area_v2");
  assert.equal(calls.at(-1).payload.p_request_id, JSON.parse(savedAttempt).requestId);

  resolveArea({ data: "IAO", error: null });
  await new Promise((resolve) => setTimeout(resolve, 0));
  tree = render();
  search = find(tree, (node) => typeof node.props?.onSelectOutlet === "function");
  assert.equal(search.props.saleAreaCode, "IAO");
  assert.equal(search.props.selectedOutlet, null);
  assert.deepEqual([search.props.customerName, search.props.customerAddress, search.props.customerPhone], before);
  assert.equal(storage.get(key), savedAttempt);
  assert.equal(retry.readCheckoutAttempt(userId).attempt.canonicalPayload, JSON.parse(savedAttempt).canonicalPayload);

  resolveCheckout({ data: null, error: { message: "Mock checkout was not sent" } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(storage.get(key), savedAttempt);
});
