// Chụp ảnh màn hình AIQMS bằng Playwright (dùng chromium có sẵn /opt/pw-browsers).
// Dev server phải đang chạy. Chạy: node scripts/screenshots.mjs
import { chromium } from "playwright";
import { promises as fs } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DIR = "docs/screenshots";
const ids = JSON.parse(await fs.readFile(`${DIR}/_ids.json`, "utf8"));

const ok = [];
const fail = [];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/${name}.png` });
  ok.push(name);
}
async function go(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(600);
}
async function cap(name, fn) {
  try { await fn(); await shot(name); }
  catch (e) { fail.push(`${name}: ${String(e).slice(0, 80)}`); }
}

// 1. Login
await cap("01-login", async () => {
  await go("/login");
  await page.fill('input[type=email]', "admin@demo.local");
  await page.fill('input[type=password]', "Demo1234!");
});
// đăng nhập
await page.click('button:has-text("Đăng nhập")').catch(() => {});
await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1200);

await cap("02-dashboard", async () => { await go("/dashboard"); });

await cap("03-programmes-list", async () => { await go("/programmes"); });
await cap("04-programme-create", async () => {
  await page.click('button:has-text("Tạo CTĐT")');
  await page.waitForSelector('text=Tạo chương trình đào tạo');
});
await page.click('button:has-text("Hủy")').catch(() => {});
await cap("05-programme-detail", async () => { await go(`/programmes/${ids.programmeId}`); });

await cap("06-matrices", async () => {
  await go("/matrices");
  await page.locator("select").nth(0).selectOption({ index: 1 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.locator("select").nth(1).selectOption({ index: 1 }).catch(() => {});
  await page.waitForTimeout(1500);
});

await cap("07-courses-list", async () => { await go("/courses"); });
await cap("08-course-detail", async () => {
  await go("/courses");
  await page.locator('a[href^="/courses/"]').first().click();
  await page.waitForTimeout(1200);
});

await cap("09-standards", async () => {
  await go("/standards");
  await page.locator('button:has-text("AUN-QA")').first().click().catch(() => {});
  await page.waitForTimeout(1000);
});

await cap("10-cycles-list", async () => { await go("/cycles"); });
await cap("11-cycle-detail", async () => { await go(`/cycles/${ids.cycleId}`); });

await cap("12-sars-list", async () => { await go("/sars"); });
await cap("13-sar-create", async () => {
  await page.click('button:has-text("Tạo SAR")');
  await page.waitForSelector('text=Tạo báo cáo tự đánh giá');
});
await page.click('button:has-text("Hủy")').catch(() => {});
await cap("14-sar-editor", async () => { await go(`/sars/${ids.sarId}`); });
await cap("15-sar-ai", async () => {
  await page.click('button:has-text("AI viết nháp")').catch(() => {});
  await page.waitForTimeout(2000);
});
await cap("16-sar-review", async () => {
  await page.click('button:has-text("Đánh giá nội bộ")').catch(() => {});
  await page.waitForTimeout(1200);
});

await cap("17-evidence-list", async () => { await go("/evidence"); });
await cap("18-evidence-detail", async () => { await go(`/evidence/${ids.evidenceId}`); });

await cap("19-academic-staff", async () => { await go("/academic-staff"); });
await cap("20-students", async () => { await go("/students"); });
await cap("21-facilities", async () => { await go("/facilities"); });
await cap("22-outcomes", async () => { await go("/outcomes"); });

await cap("23-tasks", async () => { await go("/tasks"); });
await cap("24-improvement-list", async () => { await go("/improvement"); });
await cap("25-improvement-detail", async () => { await go(`/improvement/${ids.improvementPlanId}`); });

await cap("26-surveys-list", async () => { await go("/surveys"); });
await cap("27-survey-detail", async () => { await go(`/surveys/${ids.surveyId}`); });
await cap("28-survey-public", async () => { await go(`/survey/${ids.surveyToken}?tenant=demo`); });

await cap("29-exports", async () => { await go("/exports"); });
await cap("30-users", async () => { await go("/users"); });
await cap("31-users-org", async () => {
  await go("/users");
  await page.click('button:has-text("Khoa / Bộ môn")').catch(() => {});
  await page.waitForTimeout(800);
});
await cap("32-ai-hub", async () => { await go("/ai"); });

await browser.close();
console.log(`OK (${ok.length}): ${ok.join(", ")}`);
if (fail.length) console.log(`FAIL (${fail.length}):\n  ${fail.join("\n  ")}`);
