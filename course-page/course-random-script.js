// course-random-script.js
document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE = "https://withtime.shop"; // HTTPS API 도메인 직접 호출
  document.body.classList.add("is-random");

  const courseList = document.getElementById("courseList");
  const modal = document.getElementById("courseModal");
  const modalTitleEl = modal?.querySelector("#modalTitle");
  const modalBodyEl = modal?.querySelector(".modal-body");
  const loadingEl = document.getElementById("courseLoading");

  let openRow = null;
  let lastFocused = null;
  let currentCourse = null;
  let randomCoursesCache = [];

  // 로딩 오버레이
  const showCourseLoading = () => {
    if (loadingEl) loadingEl.style.display = "grid";
  };
  const hideCourseLoading = () => {
    if (loadingEl) loadingEl.style.display = "none";
  };

  // 공통 GET
  async function httpGetJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (res.status === 404 || !res.ok || data?.isSuccess === false) {
      console.warn(
        `[GET] ${url} ${res.status} ${res.statusText} ${data?.message || text}`
      );
      return null;
    }
    return data;
  }

  // 시간 헬퍼(분까지)
  const to2 = (n) => String(n ?? 0).padStart(2, "0");
  function parseTimeToHHmm(t) {
    if (!t) return "";
    if (typeof t === "object" && typeof t.hour === "number") {
      return `${to2(t.hour)}:${to2(t.minute ?? 0)}`;
    }
    if (typeof t === "string") {
      const m = t.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
      if (m) return `${to2(Number(m[1]))}:${to2(Number(m[2] ?? 0))}`;
      const clean = t.replace(/\s+/g, " ").trim();
      if (/^\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}$/.test(clean))
        return clean.replace("~", " - ");
    }
    return "";
  }
  function normalizeHolidays(val) {
    if (!val) return "";
    if (Array.isArray(val)) return val.filter(Boolean).join(", ");
    return String(val);
  }
  function buildTimeLineFrom(shopLike) {
    if (!shopLike) return "-";
    const open = parseTimeToHHmm(shopLike.openTime);
    const close = parseTimeToHHmm(shopLike.closeTime);
    const holidays = normalizeHolidays(shopLike.holidays || shopLike.holiday);
    const range =
      open || close ? `${open}${open && close ? " - " : ""}${close}` : "";
    const holidayLine = holidays ? ` / 휴무: ${holidays}` : "";
    const out = `${range}${holidayLine}`.trim();
    return out || "-";
  }

  // 제목 포맷(시장 토큰 강조 1줄 + 코스명 1줄)
  function formatTitleTwoLines(rawTitle) {
    const t = (rawTitle || "").trim();
    const m = t.match(/(통인|망원|남대문)(시장)?/);
    if (!m) return null;
    const token = m[0];
    const rest =
      (t.slice(0, m.index) + t.slice(m.index + token.length))
        .replace(/^[\s\-–—:/|·]+/, "")
        .replace(/[\s\-–—:/|·]+$/, "")
        .trim() || "코스";
    const nowrap = token.includes("남대문") ? " nowrap" : "";
    return `<span class="accent market-line${nowrap}">${token}</span><span class="course-name-line">${rest}</span>`;
  }

  // Shop 포맷
  function formatShop(shop) {
    if (!shop) return null;
    const holidays = Array.isArray(shop.holidays)
      ? shop.holidays.filter(Boolean).join(", ")
      : shop.holidays || "";
    return {
      id: shop.shopId,
      title: shop.name || "",
      desc: shop.description || "",
      addr: shop.location || "",
      openTime: shop.openTime,
      closeTime: shop.closeTime,
      imageUrl: shop.imageUrl || "",
      holidays,
      phone: shop.phone || "",
      category: shop.category || "",
      xPos: shop.xPos,
      yPos: shop.yPos,
    };
  }

  // 인덱스/캐시
  const shopsIndex = { ready: false, byId: new Map(), byName: new Map() };
  async function ensureShopsIndex() {
    if (shopsIndex.ready) return;
    const json = await httpGetJSON(`${API_BASE}/api/shops`);
    const arr = Array.isArray(json?.result) ? json.result : [];
    arr.forEach((raw) => {
      const d = formatShop(raw);
      if (!d) return;
      if (d.id != null) shopsIndex.byId.set(d.id, d);
      if (d.title) shopsIndex.byName.set(d.title.trim().toLowerCase(), d);
    });
    shopsIndex.ready = true;
  }
  const shopCacheById = new Map();
  const menuCacheByShopId = new Map();

  async function getShopByIdSmart(id) {
    if (id == null) return null;
    await ensureShopsIndex();
    if (shopsIndex.byId.has(id)) return shopsIndex.byId.get(id);
    if (shopCacheById.has(id)) return shopCacheById.get(id);
    const json = await httpGetJSON(
      `${API_BASE}/api/shops/${encodeURIComponent(id)}`
    );
    const detail = formatShop(json?.result);
    if (detail) {
      shopsIndex.byId.set(id, detail);
      if (detail.title)
        shopsIndex.byName.set(detail.title.trim().toLowerCase(), detail);
      shopCacheById.set(id, detail);
    }
    return detail;
  }
  async function getShopByNameSmart(name) {
    if (!name) return null;
    await ensureShopsIndex();
    const key = name.trim().toLowerCase();
    if (shopsIndex.byName.has(key)) return shopsIndex.byName.get(key);
    const url = new URL(`${API_BASE}/api/shops/shop-name`);
    url.searchParams.set("name", name);
    const json = await httpGetJSON(url.toString());
    const detail = formatShop(json?.result);
    if (detail) {
      if (detail.id != null) shopsIndex.byId.set(detail.id, detail);
      if (detail.title)
        shopsIndex.byName.set(detail.title.trim().toLowerCase(), detail);
    }
    return detail;
  }
  async function getMenusByShopIdCached(id) {
    if (id == null) return [];
    if (menuCacheByShopId.has(id)) return menuCacheByShopId.get(id);
    const json = await httpGetJSON(
      `${API_BASE}/api/shops/${encodeURIComponent(id)}/menus`
    );
    const list = Array.isArray(json?.result?.menuPreviewList)
      ? json.result.menuPreviewList
      : [];
    menuCacheByShopId.set(id, list);
    return list;
  }

  // 랜덤 API
  async function fetchRandomCoursesOnce() {
    try {
      const res = await fetch(`${API_BASE}/api/courses/random`, {
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok || data?.isSuccess === false) return [];
      return Array.isArray(data?.result?.courses) ? data.result.courses : [];
    } catch {
      return [];
    }
  }
  function mergeAppend(base = [], extra = []) {
    return base.concat(extra);
  }
  async function fetchRandomCoursesMin(min = 3, maxTries = 3) {
    let result = await fetchRandomCoursesOnce();
    let tries = 0;
    while (result.length < min && tries < maxTries) {
      const more = await fetchRandomCoursesOnce();
      result = mergeAppend(result, more);
      tries++;
    }
    while (result.length < min)
      result.push({ title: `코스 ${result.length + 1}`, shops: [] });
    return result;
  }

  // 보강(상세/메뉴)
  async function enrichCoursesWithShops(courses = []) {
    await ensureShopsIndex();
    const tasks = [];
    courses.forEach((course) => {
      const shops = Array.isArray(course.shops) ? course.shops : [];
      shops.forEach((s) => {
        tasks.push(
          (async () => {
            let detail = null;
            if (s.shopId != null) detail = await getShopByIdSmart(s.shopId);
            if (!detail && s.name) detail = await getShopByNameSmart(s.name);
            if (!detail && s.name) {
              const key = s.name.trim().toLowerCase();
              detail = shopsIndex.byName.get(key) || null;
            }
            s._shop = detail;
            s._menus =
              detail?.id != null ? await getMenusByShopIdCached(detail.id) : [];
          })()
        );
      });
    });
    await Promise.all(tasks);
    return courses;
  }

  // 지도 연결 헬퍼
  const MARKET_KO = {
    TONGIN: "통인시장",
    MANGWON: "망원시장",
    NAMDAEMUN: "남대문시장",
  };
  function pickMarketNameFromCourse(c) {
    if (c?.marketName) return c.marketName.trim();
    if (c?.marketType && MARKET_KO[c.marketType])
      return MARKET_KO[c.marketType];
    const t = (c?.title || "").trim();
    const m = t.match(/(통인|망원|남대문)(시장)?/);
    return m ? `${m[1]}시장` : "";
  }
  function saveSelectedCourse(course) {
    try {
      localStorage.setItem("selectedCourse", JSON.stringify(course));
    } catch (e) {
      console.warn("[random→map] localStorage 저장 실패:", e);
    }
  }
  function goToMapWithCourse(course) {
    if (!course) return;
    saveSelectedCourse(course);
    const url = new URL("../map-page/map-page.html", location.href); // 형제 폴더
    const marketName = pickMarketNameFromCourse(course);
    if (marketName) url.searchParams.set("marketName", marketName);
    location.href = url.href;
  }

  // 렌더(백 순서/제목 그대로, 시장 토큰만 1줄째 주황)
  function render(courses) {
    const frag = document.createDocumentFragment();

    (Array.isArray(courses) ? courses : []).forEach((c, idx) => {
      const row = document
        .getElementById("tpl-course-row")
        .content.firstElementChild.cloneNode(true);
      const label = row.querySelector(".course-label");
      const flow = row.querySelector(".flow");

      const title = c.title || `코스${idx + 1}`;
      const html = formatTitleTwoLines(title);
      if (html) label.innerHTML = html;
      else label.textContent = title;

      const shops = Array.isArray(c.shops) ? c.shops : [];
      shops.forEach((s, i) => {
        const step = document
          .getElementById("tpl-step")
          .content.firstElementChild.cloneNode(true);
        const sig = (s.signatureMenu || "").trim();
        step.querySelector(".name").textContent =
          s._shop?.title || s.name || "";
        step.querySelector(".desc").textContent = sig || "-";
        flow.appendChild(step);
        if (i < shops.length - 1)
          flow.appendChild(
            document
              .getElementById("tpl-arrow")
              .content.firstElementChild.cloneNode(true)
          );
      });

      row
        .querySelectorAll("[data-go-map], [data-open-modal]")
        .forEach((b) => (b.dataset.courseIndex = String(idx)));
      frag.appendChild(row);
    });

    courseList.innerHTML = "";
    courseList.appendChild(frag);
    randomCoursesCache = courses;
  }

  // 모달
  function openModal(course, openerBtn) {
    if (!modal) return;
    currentCourse = course;
    if (modalTitleEl) modalTitleEl.textContent = course?.title || "코스";

    if (modalBodyEl) {
      const frag = document.createDocumentFragment();
      (course.shops || []).forEach((s) => {
        const poi = document
          .getElementById("tpl-modal-poi")
          .content.firstElementChild.cloneNode(true);
        if (s.imageUrl || s._shop?.imageUrl) {
          const th = poi.querySelector(".thumb");
          th.style.backgroundImage = `url('${
            s.imageUrl || s._shop?.imageUrl
          }')`;
          th.style.backgroundSize = "cover";
          th.style.backgroundPosition = "center";
        }
        const sig = (s.signatureMenu || "").trim();
        poi.querySelector(".poi-title").textContent = `${
          s._shop?.title || s.name || ""
        } - ${sig || "-"}`;
        poi.querySelector(".poi-addr").textContent = s._shop?.addr || "";
        // 시간 다시 표시
        poi.querySelector(".poi-time").textContent =
          buildTimeLineFrom(s._shop || s) || "-";
        frag.appendChild(poi);
      });
      modalBodyEl.innerHTML = "";
      modalBodyEl.appendChild(frag);
    }

    lastFocused = openerBtn || document.activeElement;
    modal.classList.add("is-open");
    modal.style.display = "flex";
    document.body.classList.add("modal-open");
    setTimeout(() => modal.querySelector(".modal-close")?.focus(), 0);
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
    if (lastFocused?.focus) lastFocused.focus();
    lastFocused = null;
  }

  // 클릭 이벤트(지도 연결 포함) — 모달 내부 버튼이 2개여도 전부 잡음
  document.addEventListener("click", (e) => {
    // 모달 닫기
    if (e.target === modal || e.target.closest(".modal-close")) {
      if (modal?.classList.contains("is-open")) {
        closeModal();
        return;
      }
    }

    // 지도 이동(카드 버튼)
    const goMapBtn = e.target.closest("[data-go-map]");
    if (goMapBtn) {
      const idx = parseInt(goMapBtn.dataset.courseIndex || "-1", 10);
      const course = (randomCoursesCache || [])[idx];
      if (course) goToMapWithCourse(course);
      return;
    }

    // 지도 이동(모달 버튼)
    const goModalBtn = e.target.closest("[data-go-map-modal], .btn-go-map]");
    const goModalBtnAny = e.target.closest(
      ".modal [data-go-map-modal], .modal [data-go-map], .modal .btn-go-map"
    );
    if (goModalBtnAny) {
      if (currentCourse) {
        goToMapWithCourse(currentCourse);
      } else {
        const title = modalTitleEl?.textContent?.trim() || "";
        const course = (randomCoursesCache || []).find(
          (c) => (c.title || "").trim() === title
        );
        if (course) goToMapWithCourse(course);
      }
      return;
    }

    // 모달 열기
    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) {
      const idx = parseInt(openBtn.dataset.courseIndex || "-1", 10);
      const course = randomCoursesCache[idx] || null;
      openModal(course || { title: "", shops: [] }, openBtn);
      return;
    }

    // 카드 토글
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
      row.setAttribute("aria-expanded", "false");
      row.querySelector(".course-actions")?.setAttribute("aria-hidden", "true");
    }
    const willOpen = !row.classList.contains("open");
    row.classList.toggle("open", willOpen);
    row.setAttribute("aria-expanded", willOpen ? "true" : "false");
    row
      .querySelector(".course-actions")
      ?.setAttribute("aria-hidden", willOpen ? "false" : "true");
    openRow = willOpen ? row : null;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open"))
      closeModal();
  });

  // 하단 새로고침
  const refreshLink = document.getElementById("randomRefreshLink");
  if (refreshLink) {
    const ico = refreshLink.querySelector(".refresh-ico");
    const runRefresh = async () => {
      try {
        refreshLink.setAttribute("aria-disabled", "true");
        if (ico) ico.classList.add("is-rotating");

        // 캐시 리셋 + 인덱스 재로딩
        menuCacheByShopId?.clear?.();
        shopCacheById?.clear?.();
        shopsIndex.ready = false;
        await ensureShopsIndex();

        showCourseLoading();
        let courses = await fetchRandomCoursesMin(3);
        courses = await enrichCoursesWithShops(courses);
        render(courses);
      } catch (e) {
        console.warn("[random refresh fail]", e);
        alert("코스를 새로 불러오지 못했어요. 잠시 후 다시 시도해 주세요!");
      } finally {
        hideCourseLoading();
        if (ico) ico.classList.remove("is-rotating");
        refreshLink.removeAttribute("aria-disabled");
      }
    };
    refreshLink.addEventListener("click", (e) => {
      e.preventDefault();
      runRefresh();
    });
  }

  // 실행
  try {
    showCourseLoading();
    let courses = await fetchRandomCoursesMin(3);
    courses = await enrichCoursesWithShops(courses);
    render(courses);
  } catch (e) {
    console.error("[random] run error:", e);
    alert(
      "코스를 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요 🙏"
    );
  } finally {
    hideCourseLoading();
  }

  if (modal) modal.style.display = "none";
});
