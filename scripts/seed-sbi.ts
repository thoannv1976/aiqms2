/**
 * Seed dữ liệu mẫu ĐẦY ĐỦ cho trường demo: một đợt kiểm định AUN-QA thực cho
 * chương trình "SBI" — Thương mại điện tử (Thương mại số thông minh & Đổi mới KD),
 * dựa trên Đề án mở ngành của ĐH Ngoại thương (mã 7340122).
 *
 * Yêu cầu: dev server đang chạy + đã seed cơ bản (npm run db:seed).
 * Chạy: npx tsx scripts/seed-sbi.ts
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TENANT = "demo";
const PW = "Demo1234!";
let cookie = "";

async function login(email: string, password = PW): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant": TENANT },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email} -> ${res.status}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}
async function api<T = any>(method: string, path: string, body?: unknown, ck = cookie): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-tenant": TENANT, cookie: ck },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${txt.slice(0, 140)}`);
  return txt ? JSON.parse(txt) : (null as T);
}
async function tryApi<T = any>(method: string, path: string, body?: unknown): Promise<T | null> {
  try { return await api<T>(method, path, body); } catch { return null; }
}
async function listItems<T = any>(path: string): Promise<T[]> {
  const r = await tryApi<{ items: T[] }>("GET", path);
  return r?.items ?? [];
}

async function main() {
  cookie = await login("admin@demo.local");
  const log = (m: string) => console.log("  • " + m);

  // ── 0) Tự cấp đủ vai trò cho tài khoản seed ─────────────────────────────────
  // Seed nền cũ có thể chỉ gán admin demo vai trò qa_office (thiếu sar.write,
  // evidence.upload...). qa_office có quyền user.manage nên ta tự gán đủ vai trò
  // rồi đăng nhập lại để JWT mang quyền mới — không cần đổi gì trên server.
  try {
    const me = await api<any>("GET", "/api/auth/me");
    if (!me.isSuperAdmin) {
      const need = ["qa_office", "programme_committee", "internal_reviewer"];
      const cur: string[] = me.roles ?? [];
      const merged = Array.from(new Set([...cur, ...need]));
      if (need.some((r) => !cur.includes(r))) {
        await api("PATCH", `/api/users/${me.user.id}`, { roleCodes: merged });
        cookie = await login("admin@demo.local"); // làm mới JWT với vai trò mới
        log(`Đã cấp đủ vai trò cho admin demo: ${merged.join(", ")}`);
      }
    }
  } catch (e) {
    console.log("  ! Không tự cấp được vai trò:", String(e).slice(0, 100));
  }

  // ── 1) Người dùng theo vai trò ─────────────────────────────────────────────
  const users = [
    { email: "qa@demo.local", fullName: "Phòng Khảo thí & ĐBCL", roleCodes: ["qa_office"] },
    { email: "chunhiem@demo.local", fullName: "Chủ nhiệm CTĐT TMĐT", roleCodes: ["programme_committee"] },
    { email: "truongkhoa@demo.local", fullName: "Trưởng khoa Kinh doanh số", roleCodes: ["faculty"] },
    { email: "gv.nguyen@demo.local", fullName: "GV. Nguyễn Thị Lan", roleCodes: ["lecturer"] },
    { email: "gv.tran@demo.local", fullName: "GV. Trần Văn Minh", roleCodes: ["lecturer"] },
    { email: "reviewer1@demo.local", fullName: "Hội đồng rà soát 1", roleCodes: ["internal_reviewer"] },
    { email: "reviewer2@demo.local", fullName: "Hội đồng rà soát 2", roleCodes: ["internal_reviewer"] },
    { email: "lanhdao@demo.local", fullName: "PHT. Phụ trách đào tạo", roleCodes: ["leadership"] },
  ];
  for (const u of users) await tryApi("POST", "/api/users", { ...u, password: PW });
  log(`Người dùng: ${users.length} (mật khẩu: ${PW})`);

  // ── 2) Bộ tiêu chuẩn AUN-QA + tiêu chí ──────────────────────────────────────
  const stds = await api<any[]>("GET", "/api/standards");
  const aun = stds.find((s) => s.code === "AUN-QA");
  const stdVer = aun.activeVersion.id;
  const detail = await api<any>("GET", `/api/standards/${aun.id}`);
  const criteria: { id: string; code: string; titleVi: string }[] = detail.criteria;

  // ── 3) Chương trình SBI + phiên bản + PEO + PLO ─────────────────────────────
  let prog = (await listItems<any>("/api/programmes?pageSize=200")).find((p) => p.code === "SBI");
  if (!prog) {
    prog = await api("POST", "/api/programmes", {
      code: "SBI", name: "Thương mại điện tử – Thương mại số thông minh & Đổi mới kinh doanh (SBI)",
      nameEn: "Smart Digital Commerce and Business Innovation", level: "bachelor",
      totalCredits: 131, initialVersion: "2025",
    });
  }
  const full = await api<any>("GET", `/api/programmes/${prog.id}`);
  const versionId = full.versions[0].id;

  const peos = [
    ["PEO1", "Có phẩm chất chính trị, đạo đức, định hướng nghề nghiệp rõ ràng; sức khỏe, trách nhiệm, phục vụ cộng đồng; năng lực đổi mới sáng tạo, khởi nghiệp."],
    ["PEO2", "Có kiến thức nền tảng vững chắc và chuyên môn toàn diện về TMĐT, thương mại số, kinh doanh số và kinh doanh thông minh để thiết kế và triển khai ý tưởng kinh doanh."],
    ["PEO3", "Có kỹ năng ứng dụng, vận hành và giải quyết vấn đề trong hệ thống TMĐT/doanh nghiệp số; thông thạo tiếng Anh và CNTT."],
  ];
  for (const [code, description] of peos) await tryApi("POST", "/api/peos", { programmeVersionId: versionId, code, description, order: 1 });

  const plos: [string, string][] = [
    ["PLO1", "Vận dụng kiến thức nền tảng KH chính trị, xã hội & nhân văn để học tập, nghiên cứu và làm việc."],
    ["PLO2", "Phân tích các yếu tố môi trường kinh doanh trong nước & quốc tế tác động đến TMĐT, thương mại số, kinh doanh số/thông minh và quản trị doanh nghiệp số."],
    ["PLO3", "Áp dụng kiến thức nền tảng & chuyên sâu về TMĐT/thương mại số để vận hành, phát triển hệ thống kinh doanh và đề xuất đổi mới sáng tạo trong môi trường số."],
    ["PLO4", "Thành thạo kỹ năng giải quyết vấn đề và ra quyết định liên quan TMĐT/kinh doanh số/thông minh."],
    ["PLO5", "Thành thạo làm việc độc lập, lãnh đạo và làm việc nhóm."],
    ["PLO6", "Thành thạo kỹ năng & năng lực số (mức 5/8) và ứng dụng AI (mức 4/8) theo Khung năng lực số."],
    ["PLO7", "Giao tiếp hiệu quả; sử dụng tiếng Anh chuyên ngành TMĐT tương đương Bậc 5/6."],
    ["PLO8", "Tinh thần hợp tác, chủ động; tự học và đổi mới sáng tạo; đạo đức & trách nhiệm nghề nghiệp."],
  ];
  const ploId: Record<string, string> = {};
  for (const [code, description] of plos) {
    const r = await tryApi<any>("POST", "/api/plos", { programmeVersionId: versionId, code, description, order: 1 });
    if (r?.id) ploId[code] = r.id;
  }
  // nếu đã tồn tại (re-run), lấy lại id — /api/plos trả MẢNG thuần (không {items})
  const ploList = (await tryApi<any[]>("GET", `/api/plos?versionId=${versionId}`)) ?? [];
  for (const p of ploList) ploId[p.code] = p.id;
  log(`CTĐT SBI: 3 PEO, ${Object.keys(ploId).length} PLO`);

  // ── 4) Học phần + CLO + ma trận ─────────────────────────────────────────────
  const courses: [string, string, number][] = [
    ["TOAH108", "Toán, xác suất và thống kê trong kinh tế", 3],
    ["PLUE111", "Pháp luật đại cương", 3],
    ["DTIE100", "Tư duy thiết kế và đổi mới sáng tạo", 3],
    ["TINE210", "Công nghệ số và ứng dụng trí tuệ nhân tạo", 3],
    ["KTEE201", "Kinh tế vi mô", 3],
    ["KTEE203", "Kinh tế vĩ mô", 3],
    ["QTRE303", "Quản trị học", 3],
    ["MKTE301", "Marketing căn bản", 3],
    ["KETE201", "Nguyên lý kế toán", 3],
    ["TMAE306", "Thương mại điện tử căn bản", 3],
    ["TINE313", "Hệ quản trị CSDL và công nghệ dữ liệu lớn", 3],
    ["QTRE201", "Hệ thống thông tin quản lý", 3],
    ["SBIE201", "AI trong Thương mại điện tử", 3],
    ["SBIH202", "Thương mại số", 3],
    ["QTRE318", "Quản trị marketing số", 3],
    ["SBIE302", "An toàn thông tin và bảo mật trong thương mại số", 3],
    ["QTR407", "Quản trị dự án", 3],
    ["SBIE303", "Công nghệ số và nền tảng trong TMĐT", 3],
  ];
  const courseId: Record<string, string> = {};
  for (const [code, name, credits] of courses) {
    let c = (await listItems<any>("/api/courses?pageSize=200")).find((x) => x.code === code);
    if (!c) c = await tryApi("POST", "/api/courses", { code, name, credits });
    if (c?.id) courseId[code] = c.id;
  }
  log(`Học phần: ${Object.keys(courseId).length}`);

  // CLO cho vài học phần chuyên ngành + cập nhật đề cương
  const cloPlan: Record<string, [string, string][]> = {
    TMAE306: [["CLO1", "Trình bày các mô hình TMĐT B2B/B2C/C2C"], ["CLO2", "Phân tích quy trình giao dịch TMĐT"]],
    SBIE201: [["CLO1", "Vận dụng AI vào cá nhân hoá trải nghiệm khách hàng"], ["CLO2", "Đánh giá rủi ro khi ứng dụng AI trong TMĐT"]],
    SBIE302: [["CLO1", "Áp dụng biện pháp bảo mật dữ liệu trong thương mại số"]],
  };
  const cloId: Record<string, string> = {};
  for (const [code, clos] of Object.entries(cloPlan)) {
    const cid = courseId[code]; if (!cid) continue;
    await tryApi("PATCH", `/api/courses/${cid}`, {
      teachingMethods: "Thuyết giảng + thảo luận tình huống + dự án nhóm",
      assessmentMethods: "Chuyên cần 10% + Giữa kỳ/dự án 30% + Cuối kỳ 60%",
      content: "Theo đề cương chi tiết ban hành kèm CTĐT.",
    });
    const existing = (await tryApi<any>("GET", `/api/courses/${cid}`))?.clos ?? [];
    for (const [ccode, desc] of clos) {
      let found = existing.find((x: any) => x.code === ccode);
      if (!found) found = await tryApi("POST", `/api/courses/${cid}/clos`, { code: ccode, description: desc, order: 1 });
      if (found?.id) cloId[`${code}.${ccode}`] = found.id;
    }
  }

  // Ma trận PLO-học phần (I/R/M)
  const map: [string, string, string][] = [
    ["PLO3", "TMAE306", "I"], ["PLO3", "SBIH202", "R"], ["PLO3", "SBIE303", "M"],
    ["PLO6", "TINE210", "I"], ["PLO6", "SBIE201", "R"], ["PLO6", "TINE313", "R"],
    ["PLO2", "KTEE201", "I"], ["PLO2", "KTEE203", "I"], ["PLO4", "QTR407", "M"],
    ["PLO5", "DTIE100", "I"], ["PLO3", "QTRE318", "R"],
  ];
  for (const [plo, course, level] of map) {
    if (ploId[plo] && courseId[course]) await tryApi("POST", "/api/matrices/plo-course", { ploId: ploId[plo], courseId: courseId[course], level });
  }
  // CLO -> PLO
  if (cloId["TMAE306.CLO1"] && ploId.PLO3) await tryApi("POST", "/api/matrices/clo-plo", { cloId: cloId["TMAE306.CLO1"], ploId: ploId.PLO3 });
  if (cloId["SBIE201.CLO1"] && ploId.PLO6) await tryApi("POST", "/api/matrices/clo-plo", { cloId: cloId["SBIE201.CLO1"], ploId: ploId.PLO6 });
  log("Ma trận PLO-học phần & CLO-PLO đã nạp");

  // ── 5) Đợt + SAR (8 tiêu chí có nội dung) ───────────────────────────────────
  let cycle = (await listItems<any>("/api/cycles?pageSize=100")).find((c) => c.name === "Kiểm định AUN-QA chu kỳ 2025");
  if (!cycle) cycle = await api("POST", "/api/cycles", { name: "Kiểm định AUN-QA chu kỳ 2025", year: 2025, standardVersionId: stdVer });

  let sar = (await listItems<any>("/api/sars?pageSize=100")).find((s) => s.title === "SAR ngành TMĐT (SBI) 2025");
  if (!sar) sar = await api("POST", "/api/sars", { assessmentCycleId: cycle.id, programmeVersionId: versionId, title: "SAR ngành TMĐT (SBI) 2025" });
  const sarFull = await api<any>("GET", `/api/sars/${sar.id}`);

  const sarContent: Record<string, { currentState: string; strengths: string; weaknesses: string; score: number }> = {
    C1: { currentState: "CTĐT SBI công bố 8 PLO bám sát Khung năng lực số và nhu cầu thị trường TMĐT.", strengths: "PLO đo lường được, có đối sánh CT quốc tế (Clermont, UMassD).", weaknesses: "Cần lượng hoá thêm chỉ số đo lường PLO6 về AI.", score: 5 },
    C2: { currentState: "Cấu trúc 131 tín chỉ, khối kiến thức đại cương → cơ sở ngành → chuyên ngành TMĐT.", strengths: "Trình tự logic, tích hợp dự án/thực hành.", weaknesses: "Tỉ lệ học phần tự chọn còn hạn chế.", score: 4 },
    C3: { currentState: "Triết lý lấy người học làm trung tâm; dạy học dựa trên dự án và năng lực số.", strengths: "Nhiều học phần dùng case study, sandbox dữ liệu.", weaknesses: "Cần tăng học liệu số hoá tương tác.", score: 4 },
    C4: { currentState: "Đánh giá đa dạng (chuyên cần, dự án, cuối kỳ) gắn rubric với CLO.", strengths: "Rubric công khai cho người học.", weaknesses: "Chưa đồng bộ rubric giữa các học phần.", score: 4 },
    C5: { currentState: "Đội ngũ GV trình độ TS trở lên, có công bố quốc tế và kinh nghiệm thực tiễn số.", strengths: "Tỉ lệ TS cao, hợp tác quốc tế.", weaknesses: "Cần bổ sung GV chuyên sâu AI/Big Data.", score: 5 },
    C6: { currentState: "Hệ thống cố vấn học tập, hỗ trợ học bổng, thực tập tại doanh nghiệp số.", strengths: "Mạng lưới doanh nghiệp đối tác rộng.", weaknesses: "Cần số hoá quy trình theo dõi tiến độ người học.", score: 4 },
    C7: { currentState: "Phòng lab dữ liệu, hạ tầng CNTT, thư viện số và phần mềm bản quyền đầy đủ.", strengths: "Hạ tầng hiện đại, LMS ổn định.", weaknesses: "Cần mở rộng phòng thực hành chuyên ngành.", score: 4 },
    C8: { currentState: "Theo dõi tỉ lệ tốt nghiệp, việc làm và mức hài lòng các bên liên quan.", strengths: "Tỉ lệ việc làm cao, phản hồi NTD tích cực.", weaknesses: "Dữ liệu đo lường mức đạt PLO theo khoá cần đầy đủ hơn.", score: 4 },
  };
  const critByCode: Record<string, string> = {};
  for (const c of criteria) critByCode[c.code] = c.id;
  for (const resp of sarFull.responses) {
    const code = criteria.find((c) => c.id === resp.criterionId)?.code ?? "";
    const c = sarContent[code];
    if (c) await tryApi("PATCH", `/api/sar-responses/${resp.id}`, {
      currentState: c.currentState, strengths: c.strengths, weaknesses: c.weaknesses,
      selfScore: c.score, status: "completed",
    });
  }
  await tryApi("POST", `/api/sars/${sar.id}/status`, { to: "collecting" });
  log(`SAR "${sar.title}": đã nhập ${Object.keys(sarContent).length} tiêu chí`);

  // ── 6) Minh chứng + liên kết tiêu chí + xác minh ────────────────────────────
  const c = (code: string) => critByCode[code];
  const evidences: { title: string; year: string; crit: string[]; status?: string }[] = [
    { title: "Đề án mở ngành Thương mại điện tử (SBI)", year: "2024-2025", crit: ["C1", "C2"], status: "valid" },
    { title: "Bản mô tả chương trình đào tạo SBI", year: "2024-2025", crit: ["C1", "C2"], status: "valid" },
    { title: "Ma trận PLO – học phần", year: "2024-2025", crit: ["C2"], status: "valid" },
    { title: "Đề cương chi tiết các học phần", year: "2024-2025", crit: ["C2", "C3", "C4"], status: "valid" },
    { title: "Quy chế và rubric đánh giá người học", year: "2024-2025", crit: ["C4"], status: "needs_more" },
    { title: "Lý lịch khoa học & công bố của giảng viên", year: "2024-2025", crit: ["C5"], status: "valid" },
    { title: "Danh mục cơ sở vật chất, phòng lab dữ liệu", year: "2024-2025", crit: ["C7"], status: "valid" },
    { title: "Quy trình cố vấn học tập & hỗ trợ sinh viên", year: "2024-2025", crit: ["C6"] },
    { title: "Khảo sát mức độ hài lòng của nhà tuyển dụng", year: "2023-2024", crit: ["C8"], status: "valid" },
    { title: "Thống kê tỉ lệ tốt nghiệp & việc làm", year: "2023-2024", crit: ["C8"], status: "valid" },
    { title: "Biên bản rà soát & cải tiến CTĐT", year: "2024-2025", crit: ["C1", "C2"] },
    { title: "Quyết định ban hành CTĐT (4365/QĐ-ĐHNT)", year: "2024-2025", crit: ["C1"], status: "valid" },
  ];
  const existingEv = await listItems<any>("/api/evidence?pageSize=200");
  for (const e of evidences) {
    if (existingEv.find((x) => x.title === e.title)) continue;
    const critIds = e.crit.map(c).filter(Boolean);
    const ev = await tryApi<any>("POST", "/api/evidence", { title: e.title, academicYear: e.year, criterionIds: critIds, requirementIds: [] });
    if (ev?.id && e.status && e.status !== "pending") await tryApi("POST", `/api/evidence/${ev.id}/verify`, { toStatus: e.status, note: "Đã kiểm tra trong đợt." });
  }
  log(`Minh chứng: ${evidences.length}`);

  // ── 7) Dữ liệu C5–C8 ────────────────────────────────────────────────────────
  const staff = [
    { fullName: "PGS.TS Nguyễn Văn An", academicRank: "PGS", degree: "TS", specialization: "Thương mại điện tử", publications: 28 },
    { fullName: "TS. Lê Thị Bình", degree: "TS", specialization: "Khoa học dữ liệu", publications: 15 },
    { fullName: "TS. Phạm Quốc Cường", degree: "TS", specialization: "Marketing số", publications: 12 },
    { fullName: "ThS. Trần Thu Hà", degree: "ThS", specialization: "Hệ thống thông tin", publications: 4 },
  ];
  const facilities = [
    { name: "Phòng Lab Khoa học dữ liệu DS-01", type: "lab", quantity: 2, capacity: 60 },
    { name: "Phòng thực hành TMĐT EC-02", type: "lab", quantity: 1, capacity: 50 },
    { name: "Thư viện số FTU", type: "library" },
    { name: "Hệ thống LMS & phần mềm bản quyền", type: "software" },
  ];
  const outcomes = [
    { name: "Tỉ lệ tốt nghiệp đúng hạn", category: "graduation", value: 88, unit: "%", academicYear: "2023-2024" },
    { name: "Tỉ lệ có việc làm sau 12 tháng", category: "employment", value: 94, unit: "%", academicYear: "2023-2024" },
    { name: "Mức hài lòng của nhà tuyển dụng", category: "satisfaction", value: 4.4, unit: "/5", academicYear: "2023-2024" },
    { name: "Mức đạt PLO6 (năng lực số)", category: "plo_attainment", value: 82, unit: "%", academicYear: "2023-2024" },
  ];
  const services = [
    { category: "scholarship", title: "Học bổng khuyến khích học tập", academicYear: "2024-2025" },
    { category: "internship", title: "Chương trình thực tập tại doanh nghiệp số", academicYear: "2024-2025" },
    { category: "career", title: "Ngày hội việc làm TMĐT", academicYear: "2024-2025" },
  ];
  const has = async (path: string, field: string, val: string) => (await listItems<any>(path)).some((x) => x[field] === val);
  for (const s of staff) if (!(await has("/api/academic-staff?pageSize=200", "fullName", s.fullName))) await tryApi("POST", "/api/academic-staff", s);
  for (const f of facilities) if (!(await has("/api/facilities?pageSize=200", "name", f.name))) await tryApi("POST", "/api/facilities", f);
  for (const o of outcomes) if (!(await has("/api/outcomes?pageSize=200", "name", o.name))) await tryApi("POST", "/api/outcomes", o);
  for (const s of services) if (!(await has("/api/student-services?pageSize=200", "title", s.title))) await tryApi("POST", "/api/student-services", s);
  log("Dữ liệu C5–C8: đội ngũ, CSVC, kết quả đầu ra, hỗ trợ người học");

  // ── 8) Nhiệm vụ + cải tiến + khảo sát ───────────────────────────────────────
  const tasks = [
    { title: "Thu thập minh chứng tiêu chí C4 (rubric)", priority: "high" },
    { title: "Hoàn thiện ma trận PLO-học phần", priority: "normal" },
    { title: "Chuẩn bị phỏng vấn đánh giá ngoài", priority: "normal" },
    { title: "Bổ sung dữ liệu đo lường PLO6", priority: "high" },
  ];
  const existTasks = await listItems<any>("/api/tasks?pageSize=200");
  for (const t of tasks) if (!existTasks.find((x) => x.title === t.title)) await tryApi("POST", "/api/tasks", t);

  if (!(await listItems<any>("/api/improvement-plans?pageSize=100")).find((p) => p.title === "Đồng bộ rubric đánh giá toàn CTĐT")) {
    const plan = await tryApi<any>("POST", "/api/improvement-plans", { title: "Đồng bộ rubric đánh giá toàn CTĐT", issue: "Rubric chưa nhất quán giữa các học phần (C4)", cause: "Chưa có quy định chung" });
    if (plan?.id) {
      await tryApi("POST", `/api/improvement-plans/${plan.id}/actions`, { action: "Xây bộ rubric mẫu theo CLO", pdcaPhase: "plan", responsibleUnit: "Phòng ĐBCL" });
      await tryApi("POST", `/api/improvement-plans/${plan.id}/actions`, { action: "Tập huấn giảng viên áp dụng rubric", pdcaPhase: "do", responsibleUnit: "Khoa" });
      await tryApi("POST", `/api/improvement-plans/${plan.id}/kpis`, { name: "Số học phần áp dụng rubric chuẩn", unit: "học phần", target: 18 });
    }
  }

  let survey = (await listItems<any>("/api/surveys?pageSize=100")).find((s) => s.title === "Khảo sát hài lòng cựu sinh viên TMĐT");
  if (!survey) {
    survey = await tryApi<any>("POST", "/api/surveys", { title: "Khảo sát hài lòng cựu sinh viên TMĐT" });
    if (survey?.id) {
      await tryApi("POST", `/api/surveys/${survey.id}/questions`, { text: "Mức độ hài lòng về chương trình?", type: "rating", order: 1 });
      await tryApi("POST", `/api/surveys/${survey.id}/questions`, { text: "Kỹ năng nào cần tăng cường?", type: "text", order: 2 });
      await tryApi("POST", `/api/surveys/${survey.id}/open`);
    }
  }
  log("Nhiệm vụ, kế hoạch cải tiến (PDCA), khảo sát đã tạo");

  // ── 9) Đánh giá nội bộ: 2 reviewer chấm điểm 8 tiêu chí ──────────────────────
  const reviewerScores: Record<string, number> = { C1: 5, C2: 4, C3: 4, C4: 3, C5: 5, C6: 4, C7: 4, C8: 4 };
  for (const [email, delta] of [["reviewer1@demo.local", 0], ["reviewer2@demo.local", 1]] as [string, number][]) {
    try {
      const ck = await login(email);
      const rv = await api<any>("POST", `/api/sars/${sar.id}/reviews`, undefined, ck);
      for (const [code, base] of Object.entries(reviewerScores)) {
        const cid = critByCode[code]; if (!cid) continue;
        const score = Math.min(7, base + delta);
        await api("POST", `/api/reviews/${rv.id}/scores`, { criterionId: cid, score, recommendation: delta ? "Nên bổ sung minh chứng định lượng." : "Đạt yêu cầu." }, ck);
      }
    } catch (e) { console.log("  ! reviewer", email, String(e).slice(0, 80)); }
  }
  log("Đánh giá nội bộ: 2 thành viên hội đồng đã chấm điểm");

  console.log("\n✔ Hoàn tất seed dữ liệu ngành SBI cho trường demo.");
}

main().catch((e) => { console.error(e); process.exit(1); });
