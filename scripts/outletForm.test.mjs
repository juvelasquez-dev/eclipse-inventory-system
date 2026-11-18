import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/outlets/OutletForm.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
});

function createForm(initialValues) {
  const state = [];
  let index = 0;
  let submitted;
  const components = {
    "../ui/Button": { default: function Button() {} },
    "../ui/Input": { default: function Input() {} },
    "../ui/Select": { default: function Select() {} },
  };
  const moduleRequire = (name) => {
    if (name === "react") {
      return {
        useState(initial) {
          const current = index++;
          if (!(current in state)) state[current] = initial;
          return [state[current], (value) => { state[current] = value; }];
        },
      };
    }
    if (name === "../../types/inventory") return { OUTLET_ID_TYPE_OPTIONS: [] };
    if (name === "../../utils/outlets") return { validateOutletIdentification: () => "" };
    return components[name] ?? require(name);
  };
  const module = { exports: {} };
  runInThisContext(`(function (require, module, exports) { ${outputText}\n})`)(
    moduleRequire, module, module.exports
  );
  const render = () => {
    index = 0;
    return module.exports.default({
      initialValues,
      onSubmit: (data) => { submitted = data; },
    });
  };
  const find = (label) => {
    function visit(node) {
      if (!node || typeof node !== "object") return undefined;
      if (node.props?.label === label) return node;
      const children = node.props?.children;
      for (const child of Array.isArray(children) ? children : [children]) {
        const found = visit(child);
        if (found) return found;
      }
      return undefined;
    }
    return visit(render());
  };
  return {
    find,
    change(label, value) {
      const field = find(label);
      assert.ok(field, `${label} field is visible`);
      field.props.onChange({ target: { value } });
    },
    submit() {
      submitted = undefined;
      render().props.onSubmit({ preventDefault() {} });
      return submitted;
    },
  };
}

const outlet = {
  id: "outlet-1",
  outletName: "Outlet",
  contactPerson: "Contact",
  degicNumber: "",
  contactNumber: "123",
  completeAddress: "Address",
  areaCode: "EFT",
  eftSubareaCode: "WEST",
  tin: "123",
  status: "Active",
};

test("new EFT outlets submit the selected or unassigned subarea", () => {
  const form = createForm();
  for (const [label, value] of [
    ["Outlet Name", "Outlet"],
    ["Contact Person", "Contact"],
    ["Contact Number", "123"],
    ["Complete Address", "Address"],
    ["Area", "EFT"],
  ]) form.change(label, value);

  assert.equal(form.submit().eftSubareaCode, null);
  for (const code of ["EAST", "WEST", "LANAO", "BUKIDNON", "CGY"]) {
    form.change("EFT Subarea", code);
    assert.equal(form.submit().eftSubareaCode, code);
  }
  form.change("EFT Subarea", "");
  assert.equal(form.submit().eftSubareaCode, null);
});

test("editing loads the saved subarea and submits changes", () => {
  const form = createForm(outlet);
  assert.equal(form.find("EFT Subarea").props.value, "WEST");
  assert.equal(form.submit().eftSubareaCode, "WEST");
  form.change("EFT Subarea", "EAST");
  assert.equal(form.submit().eftSubareaCode, "EAST");
});

test("leaving EFT clears the subarea even if the area is changed back", () => {
  for (const area of ["IAO", "CBR"]) {
    const form = createForm(outlet);
    form.change("Area", area);
    assert.equal(form.find("EFT Subarea"), undefined);
    assert.equal(form.submit().eftSubareaCode, null);
    form.change("Area", "EFT");
    assert.equal(form.find("EFT Subarea").props.value, "");
    assert.equal(form.submit().eftSubareaCode, null);
  }
});
