(() => {
  const { byId, qsa, escapeHtml, request, fileToDataUrl, toast, formatDateTime, downloadCsv } = window.PhysicsStudio;

  const state = {
    settings: null,
    chapters: [],
    materials: [],
    exams: [],
    students: [],
    mobileNavOpen: false,
    activeSection: "dashboard",
    studentSearch: "",
    leaderboardGradeFilter: "all",
    leaderboardChapterFilter: "all",
    refreshTimer: null,
  };

  const ADMIN_SECTIONS = [
    ["dashboard", "لوحة عامة"],
    ["students", "الطلاب"],
    ["alerts", "الإشعارات"],
    ["settings", "الإعدادات"],
    ["chapters", "الأبواب"],
    ["materials", "المذكرات"],
    ["exams", "الامتحانات"],
  ];

  function ensureAuth() {
    return request("/api/auth/me").catch(() => {
      window.location.replace("/login.html");
      throw new Error("unauthorized");
    });
  }

  function chapterLabel(chapterId) {
    const chapter = state.chapters.find((item) => item.id === chapterId);
    if (!chapter) return "باب غير معروف";
    return `${chapter.title} - ${chapter.grade}`;
  }

  function studentChapterId(student) {
    const exam = state.exams.find((item) => item.id === student.lastExamId);
    return exam?.chapterId || "";
  }

  function filteredStudents() {
    const term = state.studentSearch.trim().toLowerCase();
    const rows = state.students
      .slice()
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "ar"));

    if (!term) return rows;
    return rows.filter((student) =>
      [student.fullName, student.studentNumber, student.mobileNumber, student.guardianNumber, student.school, student.grade]
        .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)),
    );
  }

  function adminSectionButtonClasses(active) {
    return `rounded-[1.1rem] border px-4 py-3 text-right font-bold transition ${active ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-700"}`;
  }

  function renderAdminNavButtons(activeSection = state.activeSection) {
    return ADMIN_SECTIONS.map(
      ([section, label]) => `
        <button type="button" class="${adminSectionButtonClasses(activeSection === section)}" data-section="${section}">${label}</button>
      `,
    ).join("");
  }

  function bindAdminDrawerSwipe() {
    const panel = byId("admin-mobile-panel");
    if (!panel || panel.dataset.swipeBound) return;
    panel.dataset.swipeBound = "true";

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    panel.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      currentY = startY;
    }, { passive: true });

    panel.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 1) return;
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    }, { passive: true });

    panel.addEventListener("touchend", () => {
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Swiping right in RTL drawer closes it
      if (deltaX > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        setMobileDrawer(false);
      }
    }, { passive: true });
  }

  function setMobileDrawer(open) {
    state.mobileNavOpen = Boolean(open);
    document.body.style.overflow = open ? "hidden" : "";
    const drawer = byId("admin-mobile-drawer");
    const backdrop = byId("admin-mobile-backdrop");
    const panel = byId("admin-mobile-panel");
    const openButton = byId("admin-drawer-open");

    if (drawer) {
      drawer.classList.toggle("opacity-0", !open);
      drawer.classList.toggle("opacity-100", open);
      drawer.classList.toggle("pointer-events-none", !open);
      drawer.classList.toggle("pointer-events-auto", open);
      drawer.setAttribute("aria-hidden", String(!open));
    }

    if (backdrop) {
      backdrop.classList.toggle("hidden", !open);
    }

    if (panel) {
      panel.classList.toggle("translate-x-full", !open);
      panel.classList.toggle("translate-x-0", open);
    }

    if (openButton) {
      openButton.setAttribute("aria-expanded", String(open));
    }

    if (open) {
      bindAdminDrawerSwipe();
    }
  }

  async function buildSettingsPayload(overrides = {}) {
    const marqueeInput = byId("marquee-text-input");
    const whatsappInput = byId("whatsapp-number-input");
    const siteLockedInput = byId("site-locked-input");
    const whatsappVisibleInput = byId("whatsapp-visible-input");
    const fileInput = byId("teacher-image-input");
    const currentSiteLocked = Boolean(state.settings?.siteLocked);
    const currentWhatsappVisible = state.settings?.whatsappVisible !== false;

    const body = {
      marqueeText: String(marqueeInput?.value || state.settings?.marqueeText || "").trim(),
      whatsappNumber: String(whatsappInput?.value || state.settings?.whatsappNumber || "").trim(),
      siteLocked: typeof overrides.siteLocked === "boolean" ? overrides.siteLocked : siteLockedInput?.checked ?? currentSiteLocked,
      whatsappVisible:
        typeof overrides.whatsappVisible === "boolean"
          ? overrides.whatsappVisible
          : whatsappVisibleInput?.checked ?? currentWhatsappVisible,
    };

    const file = fileInput?.files && fileInput.files[0];
    if (file) {
      body.file = {
        name: file.name,
        type: file.type,
        dataUrl: await fileToDataUrl(file),
      };
    }

    return body;
  }

  async function saveSettings(overrides = {}, successMessage = "تم حفظ الإعدادات") {
    const body = await buildSettingsPayload(overrides);
    const response = await request("/api/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    toast(successMessage, "success");
    await loadAll({ silent: true });
    return response;
  }

  function renderShell() {
    const app = byId("admin-app");
    app.innerHTML = `
      <div class="grid gap-4 sm:gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside class="glass-panel sticky top-4 hidden h-fit rounded-2xl sm:rounded-[2rem] p-4 lg:block">
          <p class="text-xs font-bold uppercase tracking-[0.28em] text-sky-500">لوحة الأدمن</p>
          <h1 class="mt-1 text-2xl font-extrabold text-slate-900">Al-Shater Physics</h1>
          <div class="mt-4 grid gap-2">
            ${renderAdminNavButtons()}
          </div>
          <div class="mt-6 grid gap-2">
            <button type="button" data-logout-btn class="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">تسجيل الخروج</button>
          </div>
        </aside>

        <div id="admin-mobile-drawer" class="fixed inset-0 z-40 lg:hidden opacity-0 pointer-events-none transition-opacity duration-200 ease-out" aria-hidden="true">
          <button type="button" id="admin-mobile-backdrop" class="absolute inset-0 hidden bg-slate-950/35 backdrop-blur-[2px]" aria-label="إغلاق القائمة"></button>
          <aside id="admin-mobile-panel" class="drawer-panel absolute inset-y-0 right-0 w-[min(85vw,320px)] translate-x-full overflow-y-auto rounded-l-2xl bg-white p-4 transition-transform duration-200 ease-out shadow-2xl">
            <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.24em] text-sky-500">لوحة الأدمن</p>
                <p class="mt-0.5 text-lg font-extrabold text-slate-900">أكاديمية الشاطر</p>
              </div>
              <button type="button" id="admin-drawer-close" class="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 transition hover:bg-slate-50 active:scale-95" aria-label="إغلاق القائمة">×</button>
            </div>
            <div class="mt-4 grid gap-2">
              ${renderAdminNavButtons()}
            </div>
            <div class="mt-5 grid gap-2">
              <button type="button" data-logout-btn class="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700">تسجيل الخروج</button>
            </div>
            <div class="mt-6 rounded-xl bg-sky-50 p-3 text-center text-xs text-sky-700">
              👈 اسحب القائمة لليمين لإغلاقها بسهولة
            </div>
          </aside>
        </div>

        <section class="grid gap-4 sm:gap-5">
          <header class="glass-panel rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex items-start gap-2.5">
                <button type="button" id="admin-drawer-open" data-admin-drawer-open class="grid h-10 w-10 place-items-center rounded-full border border-sky-100 bg-white text-sky-600 shadow-sm transition active:scale-95 lg:hidden" aria-label="فتح القائمة" aria-expanded="false">
                  <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </svg>
                </button>
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.24em] text-sky-500">الأدمن</p>
                  <h2 class="mt-0.5 text-lg font-extrabold text-slate-900 sm:text-2xl">إدارة المنصة بشكل مباشر</h2>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span class="rounded-full ${state.settings?.siteLocked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"} px-3 py-1.5 font-bold">${state.settings?.siteLocked ? "الصيانة مفعلة" : "الموقع شغال"}</span>
                <span class="rounded-full bg-sky-100 px-3 py-1.5 font-bold text-sky-700">واتساب: ${state.settings?.whatsappVisible === false ? "مخفي" : "ظاهر"}</span>
              </div>
            </div>
            <div class="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" id="stats-row"></div>
          </header>

          <section id="section-dashboard" class="admin-section"></section>
          <section id="section-students" class="admin-section hidden"></section>
          <section id="section-alerts" class="admin-section hidden"></section>
          <section id="section-settings" class="admin-section hidden"></section>
          <section id="section-chapters" class="admin-section hidden"></section>
          <section id="section-materials" class="admin-section hidden"></section>
          <section id="section-exams" class="admin-section hidden"></section>
        </section>
      </div>
      <button type="button" data-admin-drawer-open class="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-xs sm:text-sm font-extrabold text-white shadow-xl shadow-slate-900/30 transition hover:bg-slate-800 active:scale-95 lg:hidden">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
        <span>القائمة</span>
      </button>
    `;
  }

  function renderStats() {
    const alertCount = state.students.filter((student) => student.securityAlert).length;
    const stats = [
      { label: "الطلاب", value: state.students.length },
      { label: "الأبواب", value: state.chapters.length },
      { label: "المذكرات", value: state.materials.length },
      { label: "الامتحانات", value: state.exams.length },
      { label: "إنذارات حمراء", value: alertCount, tone: alertCount ? "danger" : "neutral" },
      { label: "الصيانة", value: state.settings?.siteLocked ? "مفعلة" : "متوقفة", tone: state.settings?.siteLocked ? "danger" : "neutral" },
    ];

    byId("stats-row").innerHTML = stats
      .map(
        (item) => `
          <div class="rounded-xl border border-slate-100 bg-white p-3 text-center sm:text-right">
            <p class="text-xl sm:text-2xl font-extrabold ${item.tone === "danger" ? "text-rose-700" : "text-slate-900"}">${item.value}</p>
            <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(item.label)}</p>
          </div>
        `,
      )
      .join("");
  }

  function setActiveSection(section) {
    state.activeSection = section;
    qsa("[data-section]").forEach((button) => {
      const active = button.getAttribute("data-section") === section;
      button.className = adminSectionButtonClasses(active);
    });
    ["dashboard", "students", "alerts", "settings", "chapters", "materials", "exams"].forEach((name) => {
      const panel = byId(`section-${name}`);
      if (panel) panel.classList.toggle("hidden", name !== section);
    });
    setMobileDrawer(false);
  }

  function renderDashboardSection() {
    const alertStudents = state.students.filter((student) => student.securityAlert).slice(0, 6);
    byId("section-dashboard").innerHTML = `
      <div class="grid gap-4 sm:gap-5">
        <div class="glass-panel rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">لوحة عامة</p>
              <h3 class="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900">ملخص المنصة السريع</h3>
            </div>
            <div class="flex gap-2">
              <button type="button" id="refresh-now" class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">تحديث الآن</button>
            </div>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-3.5">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-sky-500">آخر تنبيه مباشر</p>
              <p class="mt-1 text-xs sm:text-sm leading-6 text-slate-600">${escapeHtml(state.settings?.marqueeText || "مفيش إشعار مباشر مكتوب دلوقتي")}</p>
            </div>
            <div class="rounded-xl bg-slate-50 p-3.5">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">واتساب التواصل</p>
              <p class="mt-1 text-xs sm:text-sm leading-6 text-slate-600">${escapeHtml(state.settings?.whatsappNumber || "غير مضاف")}</p>
            </div>
          </div>
        </div>

        <div class="glass-panel rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-5">
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">الإنذارات الحمراء</p>
          <div class="mt-3 grid gap-3">
            ${
              alertStudents.length
                ? alertStudents
                    .map(
                      (student) => `
                        <article class="rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <div class="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p class="text-base font-extrabold text-rose-800">${escapeHtml(student.fullName)}</p>
                              <p class="mt-0.5 text-xs text-rose-700">${escapeHtml(student.securityAlertReason || "إنذار بسبب اختلاف جهاز أو IP خلال وقت قصير")}</p>
                            </div>
                            <span class="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">إنذار أحمر</span>
                          </div>
                        </article>
                      `,
                    )
                    .join("")
                : '<div class="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-500">مفيش إنذارات حالياً.</div>'
            }
          </div>
        </div>
      </div>
    `;

    byId("refresh-now").addEventListener("click", () => loadAll({ silent: false }));
  }

  function renderStudentsSection() {
    const rows = filteredStudents();
    byId("section-students").innerHTML = `
      <div class="glass-panel rounded-[2rem] p-5 sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-sm font-bold uppercase tracking-[0.28em] text-sky-500">الطلاب</p>
            <h3 class="mt-2 text-2xl font-extrabold text-slate-900">بحث، تعديل، حظر، وتصدير</h3>
          </div>
          <button type="button" id="export-students" class="rounded-full bg-gradient-to-l from-sky-400 via-sky-300 to-cyan-200 px-5 py-3 font-extrabold text-slate-900">تصدير CSV</button>
        </div>
        <label class="mt-5 block">
          <span class="mb-2 block text-sm font-bold text-slate-700">بحث</span>
          <input id="student-search" type="search" placeholder="ابحث بالاسم أو الرقم أو المدرسة" value="${escapeHtml(state.studentSearch)}" class="w-full rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" />
        </label>
      </div>

      <div class="mt-5 grid gap-4 md:hidden">
        ${
          rows.length
            ? rows
                .map(
                  (student) => `
                    <article class="glass-panel rounded-[1.5rem] p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-lg font-extrabold text-slate-900">${escapeHtml(student.fullName)}</p>
                          <p class="text-sm text-slate-500">${escapeHtml(student.studentNumber)} • ${escapeHtml(student.grade || "-")}</p>
                        </div>
                        <span class="rounded-full px-3 py-1 text-xs font-bold ${student.securityAlert ? "bg-rose-100 text-rose-700" : student.blocked ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}">${student.securityAlert ? "إنذار" : student.blocked ? "محظور" : "نشط"}</span>
                      </div>
                      <div class="mt-4 grid gap-1 text-sm text-slate-600">
                        <p>الموبايل: ${escapeHtml(student.mobileNumber || "-")}</p>
                        <p>ولي الأمر: ${escapeHtml(student.guardianNumber || "-")}</p>
                        <p>المدرسة: ${escapeHtml(student.school || "-")}</p>
                        <p>الدرجة: <span class="font-bold text-emerald-600">${Number(student.score || 0)}</span></p>
                        <p>آخر تحديث: ${escapeHtml(formatDateTime(student.updatedAt || student.lastExamAt || ""))}</p>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" data-edit-student="${escapeHtml(student.id)}">تعديل</button>
                        <button type="button" class="rounded-full px-3 py-2 text-sm font-bold ${student.blocked ? "border border-slate-200 bg-white text-slate-700" : "bg-rose-100 text-rose-700"}" data-toggle-block="${escapeHtml(student.id)}">${student.blocked ? "فك الحظر" : "حظر"}</button>
                        <button type="button" class="rounded-full bg-slate-900 px-3 py-2 text-sm font-bold text-white" data-whatsapp="${escapeHtml(student.id)}">واتساب</button>
                        <button type="button" class="rounded-full bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700" data-delete-student="${escapeHtml(student.id)}">حذف</button>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : '<div class="glass-panel rounded-[1.5rem] p-6 text-center text-slate-500">مفيش طلاب مسجلين.</div>'
        }
      </div>

      <div class="glass-panel mt-5 hidden overflow-hidden rounded-[2rem] md:block">
        <table class="min-w-full text-right">
          <thead class="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th class="px-4 py-3">الاسم</th>
              <th class="px-4 py-3">رقم الطالب</th>
              <th class="px-4 py-3">الموبايل</th>
              <th class="px-4 py-3">ولي الأمر</th>
              <th class="px-4 py-3">المدرسة</th>
              <th class="px-4 py-3">الصف</th>
              <th class="px-4 py-3">الدرجة</th>
              <th class="px-4 py-3">الحالة</th>
              <th class="px-4 py-3">آخر تحديث</th>
              <th class="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              rows.length
                ? rows
                    .map(
                      (student) => `
                        <tr class="bg-white/80 align-top">
                          <td class="px-4 py-4 font-bold text-slate-900">${escapeHtml(student.fullName)}</td>
                          <td class="px-4 py-4">${escapeHtml(student.studentNumber)}</td>
                          <td class="px-4 py-4">${escapeHtml(student.mobileNumber || "-")}</td>
                          <td class="px-4 py-4">${escapeHtml(student.guardianNumber || "-")}</td>
                          <td class="px-4 py-4">${escapeHtml(student.school || "-")}</td>
                          <td class="px-4 py-4">${escapeHtml(student.grade || "-")}</td>
                          <td class="px-4 py-4 font-extrabold text-emerald-600">${Number(student.score || 0)}</td>
                          <td class="px-4 py-4">
                            <span class="inline-flex rounded-full px-3 py-1 text-xs font-bold ${student.securityAlert ? "bg-rose-100 text-rose-700" : student.blocked ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}">${student.securityAlert ? "إنذار أحمر" : student.blocked ? "محظور" : "نشط"}</span>
                          </td>
                          <td class="px-4 py-4 text-sm text-slate-500">${escapeHtml(formatDateTime(student.updatedAt || student.lastExamAt || ""))}</td>
                          <td class="px-4 py-4">
                            <div class="flex flex-wrap gap-2">
                              <button type="button" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" data-edit-student="${escapeHtml(student.id)}">تعديل</button>
                              <button type="button" class="rounded-full px-3 py-2 text-sm font-bold ${student.blocked ? "border border-slate-200 bg-white text-slate-700" : "bg-rose-100 text-rose-700"}" data-toggle-block="${escapeHtml(student.id)}">${student.blocked ? "فك الحظر" : "حظر"}</button>
                              <button type="button" class="rounded-full bg-slate-900 px-3 py-2 text-sm font-bold text-white" data-whatsapp="${escapeHtml(student.id)}">واتساب</button>
                              <button type="button" class="rounded-full bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700" data-delete-student="${escapeHtml(student.id)}">حذف</button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join("")
                : '<tr><td colspan="10"><div class="px-4 py-8 text-center text-slate-500">مفيش طلاب مسجلين.</div></td></tr>'
            }
          </tbody>
        </table>
      </div>
    `;

    byId("student-search").addEventListener("input", (event) => {
      state.studentSearch = event.target.value;
      renderStudentsSection();
      bindStudentActions();
    });
    byId("export-students").addEventListener("click", exportStudents);
  }

  function renderAlertsSection() {
    const alertStudents = state.students.filter((student) => student.securityAlert);
    byId("section-alerts").innerHTML = `
      <div class="glass-panel rounded-[2rem] p-5 sm:p-6">
        <p class="text-sm font-bold uppercase tracking-[0.28em] text-rose-500">الإنذارات</p>
        <h3 class="mt-2 text-2xl font-extrabold text-slate-900">رادار التلاعب</h3>
      </div>
      <div class="mt-5 grid gap-3">
        ${
          alertStudents.length
            ? alertStudents
                .map(
                  (student) => `
                    <article class="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p class="text-lg font-extrabold text-rose-800">${escapeHtml(student.fullName)}</p>
                          <p class="mt-1 text-sm leading-7 text-rose-700">${escapeHtml(student.securityAlertReason || "إنذار بسبب اختلاف جهاز أو IP خلال وقت قصير")}</p>
                          <p class="mt-1 text-xs text-rose-600">${escapeHtml(student.lastIp || "")} • ${escapeHtml(student.lastDeviceType || "")}</p>
                        </div>
                        <span class="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">إنذار أحمر</span>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : '<div class="glass-panel rounded-[1.5rem] p-6 text-center text-slate-500">مفيش إنذارات دلوقتي.</div>'
        }
      </div>
    `;
  }

  function renderSettingsSection() {
    const settings = state.settings || {};
    byId("section-settings").innerHTML = `
      <div class="glass-panel rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-5">
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-sky-500">الإعدادات العامة</p>
        <h3 class="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900">الصيانة، التاكر، والواتساب</h3>
        <form id="settings-form" class="mt-4 grid gap-3.5">
          <label class="grid gap-1.5">
            <span class="text-xs sm:text-sm font-bold text-slate-700">صورة الأستاذ</span>
            <input id="teacher-image-input" type="file" accept="image/*" class="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm" />
          </label>
          <div class="grid gap-2">
            <span class="text-xs sm:text-sm font-bold text-slate-700">المعاينة الحالية</span>
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              ${
                settings.teacherImageUrl
                  ? `<img src="${escapeHtml(settings.teacherImageUrl)}" alt="صورة الأستاذ الحالية" class="h-36 w-full object-cover sm:h-44" />`
                  : `<div class="grid h-36 place-items-center text-xs sm:text-sm text-slate-400">مفيش صورة مرفوعة دلوقتي</div>`
              }
            </div>
          </div>
          <label class="grid gap-1.5">
            <span class="text-xs sm:text-sm font-bold text-slate-700">شريط الإشعارات (التاكر)</span>
            <textarea id="marquee-text-input" rows="2" class="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-sky-300">${escapeHtml(settings.marqueeText || "")}</textarea>
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs sm:text-sm font-bold text-slate-700">رقم واتساب</span>
            <input id="whatsapp-number-input" type="text" value="${escapeHtml(settings.whatsappNumber || "")}" class="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-sky-300" placeholder="+2010..." />
          </label>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm">
              <input id="site-locked-input" type="checkbox" class="h-4 w-4 accent-slate-900" ${settings.siteLocked ? "checked" : ""} />
              <span class="font-bold text-slate-700">تفعيل الصيانة العامة</span>
            </label>
            <label class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm">
              <input id="whatsapp-visible-input" type="checkbox" class="h-4 w-4 accent-slate-900" ${settings.whatsappVisible === false ? "" : "checked"} />
              <span class="font-bold text-slate-700">إظهار زر واتساب</span>
            </label>
          </div>
          <div class="flex items-center justify-end gap-2.5 mt-2">
            <button type="submit" class="rounded-full bg-slate-900 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white transition hover:bg-slate-800">حفظ الإعدادات</button>
          </div>
        </form>

        <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p class="font-extrabold text-rose-900 text-sm sm:text-base">زرار الطوارئ (Kill Switch)</p>
              <p class="text-xs text-rose-700 mt-0.5">تنبيه: هذا الزر مخصص للأدمن فقط لقفل أو فتح الموقع بالكامل فوراً.</p>
            </div>
            <button type="button" id="preview-kill-switch" class="rounded-full ${settings.siteLocked ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white transition active:scale-95 shadow-md">
              ${settings.siteLocked ? "فتح الموقع الآن" : "إغلاق الموقع (Kill Switch)"}
            </button>
          </div>
        </div>
      </div>
    `;

    byId("settings-form").addEventListener("submit", handleSettingsSubmit);
    byId("preview-kill-switch").addEventListener("click", toggleSiteLock);
  }

  function bindShellActions() {
    qsa("[data-section]").forEach((button) => {
      button.addEventListener("click", () => setActiveSection(button.getAttribute("data-section")));
    });

    qsa("[data-logout-btn]").forEach((button) => {
      button.addEventListener("click", async () => {
        await request("/api/auth/logout", { method: "POST" });
        window.location.replace("/login.html");
      });
    });

    qsa("[data-admin-drawer-open]").forEach((button) => {
      button.addEventListener("click", () => setMobileDrawer(true));
    });
    byId("admin-drawer-close")?.addEventListener("click", () => setMobileDrawer(false));
    byId("admin-mobile-backdrop")?.addEventListener("click", () => setMobileDrawer(false));
  }

  function renderChaptersSection() {
    byId("section-chapters").innerHTML = `
      <div class="glass-panel rounded-[2rem] p-5 sm:p-6">
        <p class="text-sm font-bold uppercase tracking-[0.28em] text-sky-500">الأبواب</p>
        <h3 class="mt-2 text-2xl font-extrabold text-slate-900">إضافة باب جديد</h3>
        <form id="chapter-form" class="mt-5 grid gap-4">
          <div class="grid gap-4 md:grid-cols-3">
            <label class="grid gap-2"><span class="text-sm font-bold text-slate-700">اسم الباب</span><input name="title" type="text" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" /></label>
            <label class="grid gap-2"><span class="text-sm font-bold text-slate-700">الصف</span><input name="grade" type="text" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" /></label>
            <label class="grid gap-2"><span class="text-sm font-bold text-slate-700">ترتيب الباب</span><input name="sortOrder" type="number" min="1" step="1" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" /></label>
          </div>
          <div class="flex justify-end"><button type="submit" class="rounded-full bg-slate-900 px-5 py-3 font-extrabold text-white">إضافة</button></div>
        </form>
      </div>
      <div class="mt-5 grid gap-3">
        ${
          state.chapters.length
            ? state.chapters
                .slice()
                .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
                .map(
                  (chapter) => `
                    <div class="glass-panel rounded-[1.5rem] p-4">
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p class="text-sm font-bold uppercase tracking-[0.24em] text-emerald-500">${escapeHtml(chapter.grade)}</p>
                          <h4 class="mt-1 text-xl font-extrabold text-slate-900">${escapeHtml(chapter.title)}</h4>
                        </div>
                        <button type="button" class="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700" data-delete-chapter="${escapeHtml(chapter.id)}">حذف</button>
                      </div>
                    </div>
                  `,
                )
                .join("")
            : '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">مفيش أبواب مضافة.</div>'
        }
      </div>
    `;

    byId("chapter-form").addEventListener("submit", handleChapterSubmit);
    qsa("[data-delete-chapter]", byId("section-chapters")).forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("متأكد من حذف الباب؟")) return;
        await request(`/api/chapters?id=${encodeURIComponent(button.getAttribute("data-delete-chapter"))}`, { method: "DELETE" });
        await loadAll({ silent: true });
      });
    });
  }

  function renderMaterialsSection() {
    const chapterOptions = state.chapters
      .map((chapter) => `<option value="${escapeHtml(chapter.id)}">${escapeHtml(chapter.title)} - ${escapeHtml(chapter.grade)}</option>`)
      .join("");

    byId("section-materials").innerHTML = `
      <div class="glass-panel rounded-[2rem] p-5 sm:p-6">
        <p class="text-sm font-bold uppercase tracking-[0.28em] text-emerald-500">المذكرات</p>
        <h3 class="mt-2 text-2xl font-extrabold text-slate-900">رفع مذكرة جديدة</h3>
        <form id="material-form" class="mt-5 grid gap-4">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-bold text-slate-700">الباب</span>
              <select name="chapterId" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300">
                <option value="">اختار الباب</option>
                ${chapterOptions}
              </select>
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-bold text-slate-700">عنوان المذكرة</span>
              <input name="title" type="text" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" />
            </label>
          </div>
          <label class="grid gap-2">
            <span class="text-sm font-bold text-slate-700">ملف المذكرة</span>
            <input name="file" type="file" accept=".pdf,image/*" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3" />
          </label>
          <div class="flex justify-end"><button type="submit" class="rounded-full bg-slate-900 px-5 py-3 font-extrabold text-white">حفظ/رفع</button></div>
        </form>
      </div>

      <div class="mt-5 grid gap-3">
        ${
          state.materials.length
            ? state.materials
                .map(
                  (material) => `
                    <div class="glass-panel rounded-[1.5rem] p-4">
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p class="text-lg font-extrabold text-slate-900">${escapeHtml(material.title)}</p>
                          <p class="text-sm text-slate-500">${escapeHtml(chapterLabel(material.chapterId))}</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <a href="${escapeHtml(material.signedUrl)}" target="_blank" rel="noopener" class="rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-700">فتح</a>
                          <button type="button" class="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700" data-delete-material="${escapeHtml(material.id)}">حذف</button>
                        </div>
                      </div>
                    </div>
                  `,
                )
                .join("")
            : '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">مفيش مذكرات مضافة.</div>'
        }
      </div>
    `;

    byId("material-form").addEventListener("submit", handleMaterialSubmit);
    qsa("[data-delete-material]", byId("section-materials")).forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("متأكد من حذف المذكرة؟")) return;
        await request(`/api/materials?id=${encodeURIComponent(button.getAttribute("data-delete-material"))}`, { method: "DELETE" });
        await loadAll({ silent: true });
      });
    });
  }

  function renderExamsSection() {
    const chapterOptions = state.chapters
      .map((chapter) => `<option value="${escapeHtml(chapter.id)}">${escapeHtml(chapter.title)} - ${escapeHtml(chapter.grade)}</option>`)
      .join("");

    byId("section-exams").innerHTML = `
      <div class="glass-panel rounded-[2rem] p-5 sm:p-6">
        <p class="text-sm font-bold uppercase tracking-[0.28em] text-amber-500">الامتحانات</p>
        <h3 class="mt-2 text-2xl font-extrabold text-slate-900">رفع امتحان جديد</h3>
        <form id="exam-form" class="mt-5 grid gap-4">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-bold text-slate-700">الباب</span>
              <select name="chapterId" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300">
                <option value="">اختار الباب</option>
                ${chapterOptions}
              </select>
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-bold text-slate-700">الوقت بالدقائق</span>
              <input name="timeLimitMinutes" type="number" min="1" step="1" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" />
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-bold text-slate-700">الإجابة الصحيحة</span>
              <select name="correctAnswer" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300">
                <option value="">اختار</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-bold text-slate-700">عنوان الامتحان</span>
              <input name="title" type="text" class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" />
            </label>
          </div>
          <label class="grid gap-2">
            <span class="text-sm font-bold text-slate-700">نص السؤال / شرح</span>
            <textarea name="questionText" rows="3" class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-300" placeholder="يدعم KaTeX لو كتبت الصيغ الرياضية بين \\( \\) أو $$ $$"></textarea>
          </label>
          <label class="grid gap-2">
            <span class="text-sm font-bold text-slate-700">صورة السؤال</span>
            <input name="file" type="file" accept="image/*" required class="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3" />
          </label>
          <div class="flex justify-end"><button type="submit" class="rounded-full bg-slate-900 px-5 py-3 font-extrabold text-white">حفظ/رفع</button></div>
        </form>
      </div>

      <div class="mt-5 grid gap-3">
        ${
          state.exams.length
            ? state.exams
                .map(
                  (exam) => `
                    <article class="glass-panel rounded-[1.5rem] p-4">
                      <div class="grid gap-4 lg:grid-cols-[1fr_220px]">
                        <div class="grid gap-2">
                          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p class="text-lg font-extrabold text-slate-900">${escapeHtml(exam.title || "امتحان الباب")}</p>
                              <p class="text-sm text-slate-500">${escapeHtml(chapterLabel(exam.chapterId))}</p>
                              ${exam.questionText ? `<p class="text-sm leading-7 text-slate-600">${escapeHtml(exam.questionText)}</p>` : ""}
                              <p class="text-sm text-slate-500">الإجابة الصحيحة: ${escapeHtml(exam.correctAnswer || "")} • ${escapeHtml(String(exam.timeLimitMinutes || 0))} دقيقة</p>
                            </div>
                            <button type="button" class="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700" data-delete-exam="${escapeHtml(exam.id)}">حذف</button>
                          </div>
                        </div>
                        <div class="overflow-hidden rounded-[1.25rem] bg-slate-50">
                          <img src="${escapeHtml(exam.imageUrl)}" alt="صورة السؤال" class="h-36 w-full object-cover" />
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : '<div class="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">مفيش امتحانات مضافة.</div>'
        }
      </div>
    `;

    byId("exam-form").addEventListener("submit", handleExamSubmit);
    qsa("[data-delete-exam]", byId("section-exams")).forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("متأكد من حذف الامتحان؟")) return;
        await request(`/api/exams?id=${encodeURIComponent(button.getAttribute("data-delete-exam"))}`, { method: "DELETE" });
        await loadAll({ silent: true });
      });
    });
  }

  function openStudentEdit(studentId) {
    const student = state.students.find((item) => item.id === studentId);
    if (!student) return;

    const dialog = byId("student-edit-dialog");
    const form = byId("student-edit-form");
    form.elements.id.value = student.id;
    form.elements.fullName.value = student.fullName || "";
    form.elements.studentNumber.value = student.studentNumber || "";
    form.elements.mobileNumber.value = student.mobileNumber || "";
    form.elements.guardianNumber.value = student.guardianNumber || "";
    form.elements.school.value = student.school || "";
    form.elements.grade.value = student.grade || "";
    form.elements.score.value = student.score ?? "";
    form.elements.blocked.checked = Boolean(student.blocked);
    dialog.showModal();
  }

  function bindStudentActions() {
    qsa("[data-edit-student]", byId("section-students")).forEach((button) => {
      button.addEventListener("click", () => openStudentEdit(button.getAttribute("data-edit-student")));
    });

    qsa("[data-toggle-block]", byId("section-students")).forEach((button) => {
      button.addEventListener("click", async () => {
        const student = state.students.find((item) => item.id === button.getAttribute("data-toggle-block"));
        if (!student) return;
        await request(`/api/students?id=${encodeURIComponent(student.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            ...student,
            blocked: !student.blocked,
          }),
        });
        await loadAll({ silent: true });
      });
    });

    qsa("[data-delete-student]", byId("section-students")).forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("متأكد من حذف الطالب؟")) return;
        await request(`/api/students?id=${encodeURIComponent(button.getAttribute("data-delete-student"))}`, { method: "DELETE" });
        await loadAll({ silent: true });
      });
    });

    qsa("[data-whatsapp]", byId("section-students")).forEach((button) => {
      button.addEventListener("click", () => {
        const student = state.students.find((item) => item.id === button.getAttribute("data-whatsapp"));
        if (!student) return;
        const number = String(state.settings?.whatsappNumber || "").replace(/[^\d+]/g, "");
        if (!number) {
          toast("اضف رقم واتساب من الإعدادات الأول", "error");
          return;
        }
        const message = `متابعة الطالب ${student.fullName} (${student.studentNumber})`;
        window.open(`https://wa.me/${number.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      });
    });
  }

  async function handleStudentEditSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    await request(`/api/students?id=${encodeURIComponent(payload.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        id: payload.id,
        fullName: payload.fullName,
        studentNumber: payload.studentNumber,
        mobileNumber: payload.mobileNumber,
        guardianNumber: payload.guardianNumber,
        school: payload.school,
        grade: payload.grade,
        score: payload.score === "" ? 0 : Number(payload.score),
        blocked: form.elements.blocked.checked,
      }),
    });

    byId("student-edit-dialog").close();
    toast("تم حفظ بيانات الطالب", "success");
    await loadAll({ silent: true });
  }

  async function handleSettingsSubmit(event) {
    event.preventDefault();
    try {
      await saveSettings();
    } catch (error) {
      toast(error.message || "تعذر حفظ الإعدادات", "error");
    }
  }

  async function handleChapterSubmit(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await request("/api/chapters", {
      method: "POST",
      body: JSON.stringify({
        title: payload.title,
        grade: payload.grade,
        sortOrder: Number(payload.sortOrder || 0),
      }),
    });
    toast("تمت إضافة الباب", "success");
    await loadAll({ silent: true });
  }

  async function handleMaterialSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const file = form.elements.file.files && form.elements.file.files[0];

    if (!file) {
      toast("اختار ملف المذكرة الأول", "error");
      return;
    }

    await request("/api/materials", {
      method: "POST",
      body: JSON.stringify({
        chapterId: data.chapterId,
        title: data.title,
        file: {
          name: file.name,
          type: file.type,
          dataUrl: await fileToDataUrl(file),
        },
      }),
    });

    form.reset();
    toast("تم حفظ/رفع المذكرة", "success");
    await loadAll({ silent: true });
  }

  async function handleExamSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const file = form.elements.file.files && form.elements.file.files[0];

    if (!file) {
      toast("اختار صورة السؤال الأول", "error");
      return;
    }

    await request("/api/exams", {
      method: "POST",
      body: JSON.stringify({
        chapterId: data.chapterId,
        title: data.title || "",
        questionText: data.questionText || "",
        correctAnswer: data.correctAnswer,
        timeLimitMinutes: Number(data.timeLimitMinutes || 1),
        file: {
          name: file.name,
          type: file.type,
          dataUrl: await fileToDataUrl(file),
        },
      }),
    });

    form.reset();
    toast("تم حفظ/رفع الامتحان", "success");
    await loadAll({ silent: true });
  }

  function exportStudents() {
    const rows = [
      ["الاسم رباعي", "رقم الطالب", "رقم الموبايل", "رقم ولي الأمر", "المدرسة", "الصف", "الدرجة", "الحالة"],
      ...state.students.map((student) => [
        student.fullName || "",
        student.studentNumber || "",
        student.mobileNumber || "",
        student.guardianNumber || "",
        student.school || "",
        student.grade || "",
        student.score ?? 0,
        student.securityAlert ? "إنذار" : student.blocked ? "محظور" : "نشط",
      ]),
    ];
    downloadCsv("students.csv", rows);
  }

  async function toggleSiteLock() {
    if (!state.settings) return;
    try {
      await saveSettings({ siteLocked: !state.settings.siteLocked }, state.settings.siteLocked ? "تم فتح الموقع" : "تم تفعيل الصيانة");
    } catch (error) {
      toast(error.message || "تعذر تحديث حالة الموقع", "error");
    }
  }

  async function loadAll(options = { silent: false }) {
    const [settings, chapters, materials, exams, students] = await Promise.all([
      request("/api/settings"),
      request("/api/chapters"),
      request("/api/materials"),
      request("/api/exams"),
      request("/api/students"),
    ]);

    state.settings = settings;
    state.chapters = chapters;
    state.materials = materials;
    state.exams = exams;
    state.students = students;

    renderShell();
    setMobileDrawer(false);
    bindShellActions();

    renderStats();
    renderDashboardSection();
    renderStudentsSection();
    renderAlertsSection();
    renderSettingsSection();
    renderChaptersSection();
    renderMaterialsSection();
    renderExamsSection();
    setActiveSection(state.activeSection || "dashboard");
    bindStudentActions();

    if (!options.silent) {
      toast("تم تحديث البيانات", "success");
    }
  }

  function isEditing() {
    const active = document.activeElement;
    return Boolean(active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName));
  }

  function anyDialogOpen() {
    return Boolean(byId("student-edit-dialog")?.open);
  }

  function setupAutoRefresh() {
    if (state.refreshTimer) window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(async () => {
      if (isEditing() || anyDialogOpen()) return;
      try {
        await loadAll({ silent: true });
      } catch (_) {
        // ignore and retry
      }
    }, 5000);
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      await ensureAuth();
      byId("student-edit-form").addEventListener("submit", handleStudentEditSubmit);
      qsa("[data-close-student-edit]").forEach((button) => {
        button.addEventListener("click", () => byId("student-edit-dialog").close());
      });
      byId("student-edit-dialog").addEventListener("cancel", (event) => {
        event.preventDefault();
        byId("student-edit-dialog").close();
      });

      await loadAll({ silent: true });
      setupAutoRefresh();
    } catch (error) {
      if (error.message !== "unauthorized") {
        byId("admin-app").innerHTML = `
          <section class="glass-panel rounded-[2rem] p-6 text-center">
            <h2 class="text-2xl font-extrabold text-slate-900">حصل خطأ في تحميل لوحة الأدمن</h2>
            <p class="mt-2 text-slate-600">راجع إعدادات Supabase أو الـ API.</p>
          </section>
        `;
      }
    }
  });
})();

