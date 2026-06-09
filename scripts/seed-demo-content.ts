/**
 * Seed nội dung demo qua HTTP (cho ảnh chụp màn hình). Dev server phải đang chạy.
 * Chạy: npx tsx scripts/seed-demo-content.ts
 */
import { promises as fs } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TENANT = "demo";
let cookie = "";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant": TENANT },
    body: JSON.stringify({ email: "admin@demo.local", password: "Demo1234!" }),
  });
  const sc = res.headers.get("set-cookie") ?? "";
  cookie = sc.split(";")[0];
  if (!cookie) throw new Error("Login thất bại");
}

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-tenant": TENANT, cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${txt}`);
  return txt ? JSON.parse(txt) : (null as T);
}

async function main() {
  await login();
  const ids: Record<string, string> = {};

  // Bộ tiêu chuẩn AUN-QA active version
  const stds = await api<any[]>("GET", "/api/standards");
  const aun = stds.find((s) => s.code === "AUN-QA");
  const stdVer = aun.activeVersion.id;

  // Chương trình + phiên bản + PEO/PLO
  const code = `DEMO-CNTT`;
  let prog: any;
  try {
    prog = await api("POST", "/api/programmes", { code, name: "Công nghệ thông tin", level: "bachelor", initialVersion: "2024" });
  } catch {
    const list = await api<any>("GET", "/api/programmes?pageSize=100");
    prog = list.items.find((p: any) => p.code === code);
    prog = await api("GET", `/api/programmes/${prog.id}`);
  }
  ids.programmeId = prog.id;
  const versionId = prog.versions[0].id;
  const plos: string[] = [];
  for (const [i, d] of ["Vận dụng kiến thức CNTT", "Phát triển phần mềm", "Làm việc nhóm & đạo đức nghề"].entries()) {
    try { const r = await api<any>("POST", "/api/plos", { programmeVersionId: versionId, code: `PLO${i + 1}`, description: d, order: i + 1 }); plos.push(r.id); } catch {}
  }
  for (const [i, d] of ["Tốt nghiệp có việc làm đúng ngành", "Học tập suốt đời"].entries()) {
    try { await api("POST", "/api/peos", { programmeVersionId: versionId, code: `PEO${i + 1}`, description: d, order: i + 1 }); } catch {}
  }

  // Học phần + CLO + ma trận
  let course: any;
  try { course = await api("POST", "/api/courses", { code: "CS101", name: "Nhập môn lập trình", credits: 3 }); }
  catch { const l = await api<any>("GET", "/api/courses?pageSize=100"); course = l.items.find((c: any) => c.code === "CS101"); }
  await api("PATCH", `/api/courses/${course.id}`, { teachingMethods: "Thuyết giảng + thực hành dự án", assessmentMethods: "Giữa kỳ 40% + cuối kỳ 60%", content: "Biến, cấu trúc điều khiển, hàm, mảng…" }).catch(() => {});
  let cloId = "";
  try { const clo = await api<any>("POST", `/api/courses/${course.id}/clos`, { code: "CLO1", description: "Viết được chương trình cơ bản", order: 1 }); cloId = clo.id; } catch {}
  if (plos[0]) await api("POST", "/api/matrices/plo-course", { ploId: plos[0], courseId: course.id, level: "R" }).catch(() => {});
  if (plos[0] && cloId) await api("POST", "/api/matrices/clo-plo", { cloId, ploId: plos[0] }).catch(() => {});

  // Đợt + SAR
  const cycle = await api<any>("POST", "/api/cycles", { name: "Kiểm định AUN-QA 2024", year: 2024, standardVersionId: stdVer });
  ids.cycleId = cycle.id;
  const sar = await api<any>("POST", "/api/sars", { assessmentCycleId: cycle.id, programmeVersionId: versionId, title: "SAR ngành CNTT 2024" });
  ids.sarId = sar.id;
  // Nhập 1 tiêu chí
  const sarFull = await api<any>("GET", `/api/sars/${sar.id}`);
  const r0 = sarFull.responses[0];
  await api("PATCH", `/api/sar-responses/${r0.id}`, { currentState: "Chương trình đã công bố chuẩn đầu ra rõ ràng.", strengths: "PLO bám sát nhu cầu thị trường.", selfScore: 5, status: "in_progress" }).catch(() => {});

  // Minh chứng
  const ev = await api<any>("POST", "/api/evidence", { title: "Bản mô tả chương trình đào tạo", academicYear: "2023-2024", criterionIds: [], requirementIds: [] });
  ids.evidenceId = ev.id;

  // Nhiệm vụ
  await api("POST", "/api/tasks", { title: "Thu thập minh chứng tiêu chí 1", priority: "high" }).catch(() => {});
  await api("POST", "/api/tasks", { title: "Viết SAR tiêu chí 2", priority: "normal" }).catch(() => {});

  // Kế hoạch cải tiến
  const plan = await api<any>("POST", "/api/improvement-plans", { title: "Cải tiến phương pháp đánh giá", issue: "Thiếu rubric thống nhất", cause: "Chưa có quy định chung" });
  ids.improvementPlanId = plan.id;
  await api("POST", `/api/improvement-plans/${plan.id}/actions`, { action: "Xây dựng bộ rubric mẫu", pdcaPhase: "plan", responsibleUnit: "Phòng ĐBCL" }).catch(() => {});
  await api("POST", `/api/improvement-plans/${plan.id}/kpis`, { name: "Số học phần có rubric", unit: "học phần", target: 20 }).catch(() => {});

  // Khảo sát + mở
  const survey = await api<any>("POST", "/api/surveys", { title: "Khảo sát mức độ hài lòng cựu sinh viên" });
  ids.surveyId = survey.id;
  await api("POST", `/api/surveys/${survey.id}/questions`, { text: "Mức độ hài lòng về chương trình?", type: "rating", order: 1 }).catch(() => {});
  await api("POST", `/api/surveys/${survey.id}/questions`, { text: "Góp ý cải thiện chương trình", type: "text", order: 2 }).catch(() => {});
  const opened = await api<any>("POST", `/api/surveys/${survey.id}/open`).catch(() => null);
  if (opened?.token) ids.surveyToken = opened.token;

  // Dữ liệu C5-C8
  await api("POST", "/api/academic-staff", { fullName: "PGS.TS Nguyễn Văn An", academicRank: "PGS", degree: "TS", specialization: "Khoa học máy tính", publications: 24 }).catch(() => {});
  await api("POST", "/api/academic-staff", { fullName: "TS. Trần Thị Bình", degree: "TS", specialization: "Hệ thống thông tin", publications: 11 }).catch(() => {});
  await api("POST", "/api/facilities", { name: "Phòng thực hành máy tính A1", type: "lab", quantity: 3, capacity: 50 }).catch(() => {});
  await api("POST", "/api/outcomes", { name: "Tỷ lệ có việc làm sau 12 tháng", category: "employment", value: 92, unit: "%", academicYear: "2022-2023" }).catch(() => {});
  await api("POST", "/api/student-services", { category: "scholarship", title: "Học bổng khuyến khích học tập", academicYear: "2023-2024" }).catch(() => {});

  await fs.writeFile("docs/screenshots/_ids.json", JSON.stringify(ids, null, 2));
  console.log("✔ Seed demo content:", ids);
}

main().catch((e) => { console.error(e); process.exit(1); });
