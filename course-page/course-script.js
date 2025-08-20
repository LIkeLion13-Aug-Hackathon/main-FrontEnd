// course-script.js
document.addEventListener("DOMContentLoaded", async () => {
  const courseList = document.getElementById("courseList");
  const modal = document.getElementById("courseModal");
  const modalTitleEl = modal ? modal.querySelector("#modalTitle") : null;
  const modalBodyEl = modal ? modal.querySelector(".modal-body") : null; // ✅ class로 찾기
  const modalFooterEl = modal ? modal.querySelector(".modal-footer") : null;

  let openRow = null;
  let lastFocused = null;
  let currentCourse = null;
  let coursesCache = [];

  // 1) 쿼리 파싱 + 표준화
  const params = new URLSearchParams(window.location.search);
  const raw = Object.fromEntries(params.entries());
  const norm = {};
  Object.entries(raw).forEach(([k, v]) => {
    norm[k.trim().toLowerCase()] = String(v).trim().toUpperCase();
  });

  const ALLOWED = {
    market: ["TONGIN", "MANGWON", "NAMDAEMUN"],
    humanlevel: ["SOLO", "COUPLE", "FAMILY", "GROUP"],
    spicylevel: ["NONE", "MILD", "MEDIUM", "HOT", "EXTREME"],
    fulllevel: ["LIGHT", "NORMAL", "FULL"],
  };
  const pickEnum = (key, fallback) =>
    ALLOWED[key]?.includes(norm[key]) ? norm[key] : fallback;

  const bodyData = {
    market: pickEnum("market", "TONGIN"),
    humanLevel: pickEnum("humanlevel", "SOLO"),
    spicyLevel: pickEnum("spicylevel", "NONE"),
    fullLevel: pickEnum("fulllevel", "LIGHT"),
  };

  // 2) API
  async function fetchCourses() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("https://api.withtime.shop/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(bodyData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error("JSON 파싱 실패:", e, text);
      }
      if (!res.ok)
        throw new Error(data?.message || `코스 추천 서버 오류 (${res.status})`);

      return data?.result?.courses ?? [];
    } catch (err) {
      console.error("courses fetch 실패:", err);
      showToast("코스 추천 서버가 잠시 아파요. 잠시 후 다시 시도해 주세요 🙏");
      return [
        {
          title: "임시 코스",
          shops: [{ name: "샘플 가게", signatureMenu: "시그니처 메뉴" }],
        },
      ];
    }
  }

  // 3) 렌더
  function renderCourses(courses) {
    if (!courseList) return; // 안전장치
    if (!Array.isArray(courses) || courses.length === 0) {
      courseList.innerHTML = "<p>추천 코스를 불러올 수 없어요.</p>";
      return;
    }

    courseList.innerHTML = courses
      .map(
        (c, idx) => `
      <section class="course-row" role="button" tabindex="0"
        aria-labelledby="course${idx + 1}-label" aria-expanded="false">
        <div class="course-label" id="course${idx + 1}-label">${c.title}</div>
        <div class="flow">
          ${(c.shops || [])
            .map(
              (s, i) => `
            <div class="step">
              <div class="step-group">
                <span class="pin" aria-hidden="true"></span>
                <div class="txt">
                  <div class="name">${s.name}</div>
                  <div class="desc">${s.signatureMenu || "-"}</div>
                </div>
              </div>
            </div>
            ${
              i < (c.shops?.length || 0) - 1
                ? `<div class="arrow" aria-hidden="true">→</div>`
                : ""
            }
          `
            )
            .join("")}
        </div>
        <div class="course-actions" aria-hidden="true">
          <button type="button" class="btn btn-primary" data-go-map data-course-index="${idx}">
            이 코스 지도로 보기
          </button>
          <button type="button" class="btn btn-outline" data-open-modal data-course-index="${idx}">
            코스 정보 자세히 보기
          </button>
        </div>
      </section>
    `
      )
      .join("");
  }

  // 4) 모달 열기/닫기
  function ensureModalFooterButtons() {
    if (!modalFooterEl) return;
    const hasGo = modalFooterEl.querySelector("[data-go-map-modal]");
    const hasClose = modalFooterEl.querySelector("[data-close-modal]");
    if (hasGo && hasClose) return;

    modalFooterEl.innerHTML = `
      <button type="button" class="btn btn-outline" data-close-modal>닫기</button>
      <button type="button" class="btn btn-primary" data-go-map-modal>이 코스 지도로 보기</button>
    `;
  }

  function openModal(course, openerBtn) {
    if (!modal) return;

    currentCourse = course;
    if (modalTitleEl) modalTitleEl.textContent = course?.title || "코스";

    if (modalBodyEl) {
      modalBodyEl.innerHTML = (course?.shops || [])
        .map(
          (s) => `
          <div class="poi">
            <div class="thumb"></div>
            <div class="poi-list">
              <div class="poi-row">
                <span class="poi-ico ico-title" aria-hidden="true"></span>
                <div class="poi-title">${s.name} - ${
            s.signatureMenu || "-"
          }</div>
              </div>
            </div>
          </div>
        `
        )
        .join("");
    }

    ensureModalFooterButtons();

    lastFocused = openerBtn || document.activeElement;
    modal.classList.add("is-open");
    modal.style.display = "flex"; // ✅ 확실히 보이게
    document.body.classList.add("modal-open");
    setTimeout(() => modal.querySelector(".modal-close")?.focus(), 0);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  function goToMap(courseTitle) {
    const url = `./map.html?course=${encodeURIComponent(courseTitle)}`;
    window.location.href = url;
  }

  // 5) 이벤트 위임
  document.addEventListener("click", (e) => {
    // 지도 이동(코스 버튼)
    const goMapBtn = e.target.closest("[data-go-map]");
    if (goMapBtn) {
      const idx = parseInt(goMapBtn.dataset.courseIndex || "-1", 10);
      const label =
        coursesCache[idx]?.title ||
        goMapBtn
          .closest(".course-row")
          ?.querySelector(".course-label")
          ?.textContent?.trim() ||
        "";
      goToMap(label);
      return;
    }

    // 지도 이동(모달 버튼)
    const goModalBtn = e.target.closest("[data-go-map-modal]");
    if (goModalBtn) {
      const title =
        currentCourse?.title || modalTitleEl?.textContent?.trim() || "";
      goToMap(title);
      return;
    }

    // 모달 닫기(풋터 닫기 버튼, X 버튼, 오버레이 클릭)
    if (
      e.target === modal ||
      e.target.closest(".modal-close") ||
      e.target.closest("[data-close-modal]")
    ) {
      if (modal?.classList.contains("is-open")) {
        closeModal();
        return;
      }
    }

    // 모달 열기
    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) {
      const idx = parseInt(openBtn.dataset.courseIndex || "-1", 10);
      let course = coursesCache[idx];

      if (!course) {
        // DOM에서 추출(폴백)
        const row = openBtn.closest(".course-row");
        const title =
          row?.querySelector(".course-label")?.textContent?.trim() || "코스";
        const shops = [...(row?.querySelectorAll(".step") || [])].map((s) => ({
          name: s.querySelector(".name")?.textContent?.trim() || "",
          signatureMenu: s.querySelector(".desc")?.textContent?.trim() || "",
        }));
        course = { title, shops };
      }

      openModal(course, openBtn);
      return;
    }

    // 코스 토글 (액션 영역 자체를 클릭했을 땐 토글 안 함)
    const row = e.target.closest(".course-row");
    if (!row) return;
    if (e.target.closest(".course-actions")) return;
    if (
      e.target.closest("[data-open-modal]") ||
      e.target.closest("[data-go-map]")
    )
      return;

    if (openRow && openRow !== row) {
      openRow.classList.remove("open");
      openRow.setAttribute("aria-expanded", "false");
      openRow
        .querySelector(".course-actions")
        ?.setAttribute("aria-hidden", "true");
    }
    const willOpen = !row.classList.contains("open");
    row.classList.toggle("open", willOpen);
    row.setAttribute("aria-expanded", willOpen ? "true" : "false");
    row
      .querySelector(".course-actions")
      ?.setAttribute("aria-hidden", willOpen ? "false" : "true");
    openRow = willOpen ? row : null;
  });

  // ESC 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open"))
      closeModal();
  });

  // 6) 실행
  coursesCache = await fetchCourses();
  renderCourses(coursesCache);

  // 안전: 최초 로드 시 모달 숨김
  if (modal) modal.style.display = "none";

  // 유틸
  function showToast(msg) {
    alert(msg); // 프로젝트 토스트로 교체 가능
  }
});
