document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE = window.API_BASE || "http://54.180.163.161:8080";
  document.body.classList.add("is-random");

  const courseList = document.getElementById("courseList");
  const modal = document.getElementById("courseModal");
  const modalTitleEl = modal?.querySelector("#modalTitle");
  const modalBodyEl = modal?.querySelector(".modal-body");
  const modalFooterEl = modal ? modal.querySelector(".modal-footer") : null;
  let loadingEl = document.getElementById("courseLoading");

  let openRow = null;
  let lastFocused = null;
  let currentCourse = null;
  let randomCoursesCache = []; // 로딩 오버레이

  // ⭐ 추가된 코드 시작
  const params = new URLSearchParams(window.location.search);
  const marketCode = params.get("market"); // 예: TONGIN, MANGWON, NAMDAEMUN

  const CODE_TO_NAME = {
    TONGIN: "통인시장",
    MANGWON: "망원시장",
    NAMDAEMUN: "남대문시장",
  };

  if (marketCode && CODE_TO_NAME[marketCode]) {
    // ✅ 항상 최근 시장 이름을 localStorage에 저장
    localStorage.setItem("selectedMarketName", CODE_TO_NAME[marketCode]);
  }
  // ⭐ 추가된 코드 끝

  const showCourseLoading = () => {
    if (loadingEl) loadingEl.style.display = "grid";
  };
  const hideCourseLoading = () => {
    if (loadingEl) loadingEl.style.display = "none";
  }; // 시간(24h) + 휴무

  const to2 = (n) => String(n ?? 0).padStart(2, "0");
  function parseTimeToHHmm(t) {
    if (!t) return "";
    if (typeof t === "object" && typeof t.hour === "number")
      return `${to2(t.hour)}:${to2(t.minute ?? 0)}`;
    if (typeof t === "string") {
      const m = t.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
      if (m) return `${to2(Number(m[1]))}:${to2(Number(m[2] ?? 0))}`;
      const clean = t.replace(/\s+/g, " ").trim();
      if (/^\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}$/.test(clean)) return clean;
    }
    return "";
  }
  function buildTimeLine(obj) {
    if (!obj) return "";
    const open = obj.openTime,
      close = obj.closeTime;
    const holidays = Array.isArray(obj.holidays)
      ? obj.holidays.filter(Boolean).join(", ")
      : obj.holidays || "";
    let range = "";
    const o = parseTimeToHHmm(open),
      c = parseTimeToHHmm(close);
    if (o && c && !o.includes("-") && !c.includes("-")) range = `${o} - ${c}`;
    else if (o && !c) range = o;
    else if (!o && c) range = c;
    else if (!o && !c) {
      const both =
        typeof open === "string"
          ? open
          : typeof close === "string"
          ? close
          : "";
      const clean = (both || "").replace(/\s+/g, " ").trim();
      if (/^\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}$/.test(clean))
        range = clean.replace("~", " - ");
    } else {
      const cand = [o, c].find((v) => v.includes("-")) || "";
      range = cand.replace("~", " - ");
    }
    const holidayLine = holidays ? ` / 휴무: ${holidays}` : "";
    return `${range}${holidayLine}`.trim();
  } // 템플릿

  const useTpl = (id) => {
    const tpl = document.getElementById(id);
    if (!tpl) throw new Error(`#${id} 템플릿을 찾을 수 없어요`);
    return tpl.content.firstElementChild.cloneNode(true);
  }; // 공통 GET

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
  } // Shop 포맷

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
  } // 인덱스/캐시

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
    const url = new URL("/api/shops/shop-name", API_BASE);
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
  } // 랜덤 API

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
  async function fetchRandomCoursesMin(min = 3, maxTries = 6) {
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
  } // 백의 marketType/marketName → 한글 시장명 매핑(최우선), 없으면 title에서 토큰 추출

  const MARKET_KO = {
    TONGIN: "통인시장",
    MANGWON: "망원시장",
    NAMDAEMUN: "남대문시장",
  };

  function pickMarketLabelFromCourse(c) {
    // 1) 코스 객체에 시장 정보가 있으면 그걸 우선 사용
    if (c?.marketName && typeof c.marketName === "string")
      return c.marketName.trim();
    if (c?.marketType && typeof c.marketType === "string")
      return MARKET_KO[c.marketType.trim()] || c.marketType.trim(); // 2) 없으면 title에서 토큰 추출(통인/망원/남대문 + '시장' 유무)

    const t = (c?.title || "").trim();
    const m = t.match(/(통인|망원|남대문)(시장)?/);
    if (m) return `${m[1]}시장`;

    return "랜덤 코스"; // 시장명 알 수 없으면 기본값 반환
  } // 제목을 2줄로: 1줄째(시장명, 주황), 2줄째(시장명 제거한 나머지 제목)

  function formatTitleTwoLinesFromBackend(c) {
    const title = (c?.title || "").trim();
    const market = pickMarketLabelFromCourse(c);
    if (market === "랜덤 코스") {
      // 시장명 모르면 한 줄만(백 title 그대로)
      return `<span class="course-name-line">${title || "코스"}</span>`;
    } // 제목에서 시장명 토큰 제거(시장/비시장 표기 모두 커버)

    const tokenRe = new RegExp(
      `\\b(${market}|${market.replace("시장", "")})\\b`
    );
    const second =
      title
        .replace(tokenRe, "")
        .replace(/^[\s\-–—:/|·]+/, "")
        .replace(/[\s\-–—:/|·]+$/, "")
        .trim() || "코스";

    const nowrap = market === "남대문시장" ? " nowrap" : "";
    return `<span class="accent market-line${nowrap}" data-market="${market}">${market}</span><span class="course-name-line">${second}</span>`;
  } // 제목을 시장명(주황) 1줄 + 나머지 1줄로 만들기 (br 안 씀)

  function formatTitleTwoLines(rawTitle) {
    const t = (rawTitle || "").trim();
    const m = t.match(/(통인|망원|남대문)(시장)?/);
    if (!m) return null; // 시장명 토큰이 없으면 null 반환(그대로 textContent로 처리)
    const token = m[0]; // '통인', '망원', '남대문', '통인시장' 등
    const rest =
      (t.slice(0, m.index) + t.slice(m.index + token.length))
        .replace(/^[\s\-–—:/|·]+/, "")
        .replace(/[\s\-–—:/|·]+$/, "")
        .trim() || "코스"; // 첫 줄: 시장명(오렌지), 둘째 줄: 코스명

    return `<span class="accent market-line">${token}</span><span class="course-name-line">${rest}</span>`;
  } // 보강(상세/메뉴)

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
  } // 렌더(백 응답 순서/제목 그대로, 시장명만 1줄째 강조)

  function render(courses) {
    const frag = document.createDocumentFragment();

    courses.forEach((c, idx) => {
      const row = useTpl("tpl-course-row");
      const label = row.querySelector(".course-label");
      const flow = row.querySelector(".flow");

      const title = c.title || `코스${idx + 1}`;
      const html = formatTitleTwoLines(title);
      if (html) {
        label.innerHTML = html;
      } else {
        label.textContent = title; // 시장명 토큰이 없으면 그대로
      }

      const shops = Array.isArray(c.shops) ? c.shops : [];
      shops.forEach((s, i) => {
        const step = useTpl("tpl-step");
        const sig = (s.signatureMenu || "").trim(); // signatureMenu만 사용
        step.querySelector(".name").textContent =
          s._shop?.title || s.name || "";
        step.querySelector(".desc").textContent = sig || "-";
        flow.appendChild(step);
        if (i < shops.length - 1) flow.appendChild(useTpl("tpl-arrow"));
      });

      row
        .querySelectorAll("[data-go-map], [data-open-modal]")
        .forEach((b) => (b.dataset.courseIndex = String(idx)));
      frag.appendChild(row);
    });

    courseList.innerHTML = "";
    courseList.appendChild(frag);
    randomCoursesCache = courses;
  } // 모달

  function ensureModalFooterButtons() {
    if (!modalFooterEl) return;
    const hasGo = modalFooterEl.querySelector("[data-go-map-modal]");
    if (hasGo) return;

    modalFooterEl.innerHTML = `
    <button type="button" class="btn btn-primary" data-go-map-modal>이 코스 지도로 보기</button>
  `;
  }
  function openModal(course, openerBtn) {
    if (!modal) return;
    currentCourse = course;
    if (modalTitleEl) modalTitleEl.textContent = course?.title || "코스";

    if (modalBodyEl) {
      const frag = document.createDocumentFragment();
      (course.shops || []).forEach((s) => {
        const poi = useTpl("tpl-modal-poi");
        if (s.imageUrl || s._shop?.imageUrl) {
          const th = poi.querySelector(".thumb");
          th.style.backgroundImage = `url('${
            s.imageUrl || s._shop?.imageUrl
          }')`;
          th.style.backgroundSize = "cover";
          th.style.backgroundPosition = "center";
        }
        const sig = (s.signatureMenu || "").trim(); // signatureMenu만 사용
        poi.querySelector(".poi-title").textContent = `${
          s._shop?.title || s.name || ""
        } - ${sig || "-"}`;
        poi.querySelector(".poi-addr").textContent = s._shop?.addr || "";
        poi.querySelector(".poi-time").textContent =
          buildTimeLine(s._shop || s) || "";
        frag.appendChild(poi);
      });
      modalBodyEl.innerHTML = "";
      modalBodyEl.appendChild(frag);
    }

    ensureModalFooterButtons();
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

  // ✅ 수정된 goToMap 함수
  function goToMap(course) {
    if (!course) {
      console.error("goToMap: Course is null or undefined.");
      return;
    }

    // 코스 객체에서 시장 이름 추출
    const marketName = pickMarketLabelFromCourse(course);

    // ✅ 최근 선택한 코스와 시장 이름을 localStorage에 저장
    localStorage.setItem("selectedCourse", JSON.stringify(course));
    localStorage.setItem("selectedMarketName", marketName);

    // URL에 시장 이름 파라미터를 추가하여 페이지 이동
    window.location.href = `../map-page/map-page.html?marketName=${encodeURIComponent(
      marketName
    )}`;
  } // 로딩 오버레이 (course-random-script에서는 이미 존재했으므로 수정 없음) // 이벤트 핸들러 (순서 최적화 및 디버깅 강화)

  document.addEventListener("click", (e) => {
    console.log("DEBUG: Document click detected.", e.target); // 모든 클릭 이벤트 감지 // 1. "이 코스 지도로 보기" 버튼 (리스트 내) 클릭 시 최우선 처리

    const goMapBtn = e.target.closest("[data-go-map]");
    if (goMapBtn) {
      e.preventDefault(); // 기본 링크 이동 방지
      console.log("DEBUG: Found [data-go-map] button:", goMapBtn);
      const idx = parseInt(goMapBtn.dataset.courseIndex || "-1", 10);
      const course = randomCoursesCache[idx];
      console.log(
        "DEBUG: List Map Button - Index:",
        idx,
        "Course from cache:",
        course
      );
      if (course) {
        goToMap(course);
      } else {
        console.error(
          "DEBUG: List Map Button - Course not found in cache for index:",
          idx,
          "Cache status:",
          randomCoursesCache
        );
      }
      return; // 여기서 처리 완료 후 함수 종료
    } // 2. "이 코스 지도로 보기" 버튼 (모달 내) 클릭 시 처리

    const goModalBtn = e.target.closest("[data-go-map-modal]");
    if (goModalBtn) {
      e.preventDefault(); // 기본 링크 이동 방지
      console.log("DEBUG: Found [data-go-map-modal] button:", goModalBtn);
      console.log("DEBUG: Modal Map Button - Current course:", currentCourse);
      if (currentCourse) {
        goToMap(currentCourse);
      } else {
        console.error(
          "DEBUG: Modal Map Button - currentCourse is null or undefined."
        );
      }
      return; // 여기서 처리 완료 후 함수 종료
    } // 3. "코스 정보 자세히 보기" 버튼 (모달 열기) 클릭 시 처리

    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) {
      e.preventDefault(); // 기본 링크 이동 방지
      console.log("DEBUG: Found [data-open-modal] button:", openBtn);
      const idx = parseInt(openBtn.dataset.courseIndex || "-1", 10);
      const course = randomCoursesCache[idx] || null;
      console.log("DEBUG: Open Modal Button - Index:", idx, "Course:", course);
      openModal(course || { title: "새 코스", shops: [] }, openBtn); // 기본값 좀 더 명확하게
      return; // 여기서 처리 완료 후 함수 종료
    } // 4. 모달 닫기 로직 (클릭한 곳이 모달 외부이거나 닫기 버튼일 때)

    if (
      e.target === modal ||
      e.target.closest(".modal-close") ||
      e.target.closest("[data-close-modal]")
    ) {
      if (modal?.classList.contains("is-open")) {
        console.log("DEBUG: Closing modal.");
        closeModal();
        return; // 여기서 처리 완료 후 함수 종료
      }
    } // 5. 코스 행 클릭 (열고 닫기) - 위의 버튼들이 모두 처리되지 않았을 때만 작동

    const row = e.target.closest(".course-row");
    if (!row) {
      console.log("DEBUG: Clicked outside any course row or specific button.");
      return; // 코스 행이 아니면 아무것도 안 함
    } // 코스 행 내부에서 특정 액션 버튼을 클릭한 것이 아니라면 (위에서 이미 처리됨) // 이 부분은 row 자체 클릭으로 "열고 닫는" 동작만 담당합니다.

    if (e.target.closest(".course-actions")) {
      console.log(
        "DEBUG: Clicked inside course-actions, but not on a specific handled button."
      );
      return;
    }

    console.log("DEBUG: Toggling course row open/close for row:", row);
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
  }); // 새로고침(문구+링크)

  const refreshLink = document.getElementById("randomRefreshLink");
  if (refreshLink) {
    const ico = refreshLink.querySelector(".refresh-ico");
    const runRefresh = async () => {
      try {
        refreshLink.setAttribute("aria-disabled", "true");
        if (ico) ico.classList.add("is-rotating");

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
        showToast("코스를 새로 불러오지 못했어요. 잠시 후 다시 시도해 주세요!");
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
  } // Esc 키로 모달 닫기

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open"))
      closeModal();
  }); // 실행

  try {
    showCourseLoading();
    let courses = await fetchRandomCoursesMin(3);
    courses = await enrichCoursesWithShops(courses);
    render(courses);
  } catch (e) {
    console.error("[random] run error:", e);
    showToast(
      "코스를 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요 🙏"
    );
  } finally {
    hideCourseLoading();
  }

  if (modal) modal.style.display = "none"; // showToast 함수를 console.log로 변경 (alert 방지)

  function showToast(msg) {
    console.log("알림:", msg); // 필요하다면, 여기에 실제 사용자에게 보이는 토스트 메시지 UI를 구현할 수 있습니다.
  }
});
