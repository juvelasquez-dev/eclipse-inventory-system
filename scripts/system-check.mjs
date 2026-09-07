import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const sourceRoot = join(root, "src");
const supabaseRoot = join(root, "supabase");
let failed = false;
let warnings = 0;

function printStatus(index, label, status, detail = "") {
  const dots = ".".repeat(Math.max(1, 30 - label.length));
  console.log(`[${index}/7] ${label} ${dots} ${status}`);

  if (detail) {
    console.log(`       ${detail}`);
  }
}

function pass(index, label, detail) {
  printStatus(index, label, "PASS", detail);
}

function warn(index, label, detail) {
  warnings += 1;
  printStatus(index, label, "WARN", detail);
}

function fail(index, label, detail) {
  failed = true;
  printStatus(index, label, "FAIL", detail);
}

function run(command, args) {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? "cmd.exe" : command;
  const commandArgs = isWindows
    ? ["/d", "/s", "/c", command, ...args]
    : args;

  return spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: "utf8",
  });
}

function outputSummary(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`
    .trim()
    .split(/\r?\n/)
    .slice(-8)
    .join(" | ");
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function hasAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function collectFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    return entry.isDirectory()
      ? collectFiles(path)
      : [path];
  });
}

function checkRepository() {
  const result = run("git", ["status", "--short", "--branch"]);

  if (result.status !== 0) {
    fail(1, "Repository integrity", "Not a valid Git worktree.");
    return;
  }

  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  const branch = lines.find((line) => line.startsWith("##")) ?? "## unknown";
  const changedFiles = lines.filter((line) => !line.startsWith("##"));
  const diff = run("git", ["diff", "--numstat"]);
  const largeFiles = (diff.stdout ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      const [added, deleted] = line.split("\t");
      return added === "-" || deleted === "-" || Number(added) + Number(deleted) > 50000;
    });

  pass(
    1,
    "Repository integrity",
    `${branch.replace("## ", "Branch: ")}; ${changedFiles.length} changed file(s).`
  );
  changedFiles.forEach((file) => console.log(`       ${file}`));

  if (largeFiles.length) {
    warn(1, "Repository integrity", `Large or binary diff: ${largeFiles.join(", ")}`);
  }
}

function checkTypeScript() {
  const result = run("npx", ["tsc", "-b"]);

  if (result.status === 0) {
    pass(2, "TypeScript", "tsc -b completed successfully.");
  } else {
    fail(2, "TypeScript", outputSummary(result));
  }
}

function checkBuild() {
  const result = run("npm", ["run", "build"]);

  if (result.status === 0) {
    pass(3, "Production build", "npm run build completed successfully.");
  } else {
    fail(3, "Production build", outputSummary(result));
  }
}

function checkStructure() {
  const requiredFiles = [
    "src/pages/Login/Login.tsx",
    "src/components/auth/ProtectedRoute.tsx",
    "src/pages/POS/POS.tsx",
    "src/pages/POS/POSHistory.tsx",
    "src/components/pos/DeliveryReceiptPrint.tsx",
    "src/pages/Inventory/Products.tsx",
    "src/pages/Inventory/Inventory.tsx",
    "src/pages/Inventory/StockIn.tsx",
    "src/pages/Inventory/StockOut.tsx",
    "src/pages/Inventory/StockAdjustment.tsx",
    "src/pages/Inventory/History.tsx",
    "src/pages/Outlets/Outlets.tsx",
    "src/context/InventoryContext.tsx",
    "src/pages/Inventory/Dashboard.tsx",
    "src/lib/supabase.ts",
  ];
  const missing = requiredFiles.filter((path) => !existsSync(join(root, path)));

  if (missing.length) {
    fail(4, "Application structure", `Missing: ${missing.join(", ")}`);
  } else {
    pass(4, "Application structure", `${requiredFiles.length} critical files found.`);
  }
}

function checkCriticalCode() {
  const login = readText(join(sourceRoot, "pages/Login/Login.tsx"));
  const pos = readText(join(sourceRoot, "pages/POS/POS.tsx"));
  const inventoryContext = readText(join(sourceRoot, "context/InventoryContext.tsx"));
  const transactionForm = readText(join(sourceRoot, "components/inventory/TransactionForm.tsx"));
  const productCode = readText(join(sourceRoot, "utils/productCode.ts"));
  const outlets = readText(join(sourceRoot, "pages/Outlets/Outlets.tsx"));
  const outletUtils = readText(join(sourceRoot, "utils/outlets.ts"));
  const loginOk = hasAll(login, [
    /get_login_email/,
    /auth\.signInWithPassword/,
    /navigate\("\/system"\)/,
    /MAX_FAILED_LOGIN_ATTEMPTS\s*=\s*5/,
    /LOCKOUT_DURATION_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/,
    /localStorage/,
    /resetFailedLoginAttempts/,
  ]) && !/console\.(?:log|error)\([^\n]*(?:password|loginEmail|access_token|refresh_token)/i.test(login);
  const posOk = hasAll(pos, [
    /create_pos_transaction/,
    /"CASH"/,
    /"CHEQUE"/,
    /amountReceived/,
    /calculatedChange/,
    /deliveryReceiptNumber/,
    /p_items/,
  ]);
  const inventoryOk = hasAll(transactionForm, [
    /"IN"/,
    /"OUT"/,
    /"ADJUSTMENT"/,
  ]) && hasAll(inventoryContext, [/transactions/, /getInventory/]);
  const productsOk = hasAll(productCode, [/findExistingProduct/, /deriveProductCodeAndName/]);
  const outletsOk = hasAll(outlets, [/addOutlet/, /updateOutlet/, /deleteOutlet/, /currentPage/]) &&
    hasAll(outletUtils, [/duplicateKey/, /outletName/, /completeAddress/]);

  if (loginOk && posOk && inventoryOk && productsOk && outletsOk) {
    pass(5, "Critical code checks", "Login, POS, inventory, products, and outlets markers found.");
  } else {
    const missing = [
      !loginOk && "login",
      !posOk && "POS",
      !inventoryOk && "inventory",
      !productsOk && "products",
      !outletsOk && "outlets",
    ].filter(Boolean);
    fail(5, "Critical code checks", `Missing expected markers: ${missing.join(", ")}.`);
  }
}

function checkSupabase() {
  const files = [...collectFiles(sourceRoot), ...collectFiles(supabaseRoot)];
  const content = files
    .filter((path) => /\.(?:ts|tsx|sql|toml)$/i.test(path))
    .map(readText)
    .join("\n");
  const references = [
    "create_pos_transaction",
    "get_login_email",
    "products",
    "transactions",
    "outlets",
    "pos_transactions",
    "pos_transaction_items",
    "user_area_assignments",
    "pos_area_receipt_counters",
  ];
  const missingReferences = references.filter((value) => !content.includes(value));
  const migrations = collectFiles(join(supabaseRoot, "migrations"));
  const migrationNames = migrations.map((path) => relative(root, path));
  const duplicateMigrationNames = migrationNames.filter((name, index) => migrationNames.indexOf(name) !== index);
  const implausibleMigrations = migrations.filter((path) =>
    path.endsWith(".sql") && !readText(path).trim().endsWith(";")
  );

  const requiredReferences = references.filter(
    (value) => value !== "pos_area_receipt_counters"
  );
  const missingRequiredReferences = requiredReferences.filter(
    (value) => !content.includes(value)
  );

  if (missingRequiredReferences.length || duplicateMigrationNames.length || implausibleMigrations.length) {
    fail(6, "Supabase configuration", [
      missingRequiredReferences.length && `Missing references: ${missingRequiredReferences.join(", ")}`,
      duplicateMigrationNames.length && `Duplicate migrations: ${duplicateMigrationNames.join(", ")}`,
      implausibleMigrations.length && `Migration without final semicolon: ${implausibleMigrations.join(", ")}`,
    ].filter(Boolean).join("; "));
  } else {
    pass(6, "Supabase configuration", `${migrations.length} local migration(s); expected backend markers found.`);
  }

  if (missingReferences.includes("pos_area_receipt_counters")) {
    warn(6, "Supabase configuration", "pos_area_receipt_counters: NOT AUTOMATICALLY VERIFIED; no local source reference found.");
  }

  warn(6, "Supabase configuration", "Live database behavior: NOT AUTOMATICALLY VERIFIED. Manual smoke test required.");
}

function checkSecurity() {
  const sourceFiles = collectFiles(sourceRoot).filter((path) => /\.(?:ts|tsx|js|jsx)$/i.test(path));
  const findings = [];
  const sensitivePattern = /(SUPABASE_SERVICE_ROLE_KEY|UPSTASH_|service_role\s*=|console\.(?:log|error)\([\s\S]{0,200}(?:password|access_token|refresh_token|session\.user\.email|user\.email))/i;

  for (const path of sourceFiles) {
    const text = readText(path);

    if (sensitivePattern.test(text)) {
      findings.push(relative(root, path));
    }
  }

  const login = readText(join(sourceRoot, "pages/Login/Login.tsx"));
  const edgeFunctionReference = /username-password-login|functions\.invoke\(/.test(login);

  if (findings.length || edgeFunctionReference) {
    fail(7, "Security sanity checks", [
      findings.length && `Sensitive frontend pattern: ${findings.join(", ")}`,
      edgeFunctionReference && "Frontend still references an Edge Function login.",
    ].filter(Boolean).join("; "));
  } else {
    pass(7, "Security sanity checks", "No obvious frontend secrets, credential logging, or Edge Function login dependency.");
  }
}

console.log("ECLIPSE SYSTEM HEALTH CHECK");
console.log("--------------------------------");
checkRepository();
checkTypeScript();
checkBuild();
checkStructure();
checkCriticalCode();
checkSupabase();
checkSecurity();
console.log("--------------------------------");

if (failed) {
  console.log("SYSTEM CHECK: FAIL");
  process.exitCode = 1;
} else {
  console.log("SYSTEM CHECK: PASS");
  console.log(warnings ? "Safe to push after reviewing warnings." : "Safe to push.");
}