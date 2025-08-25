// course-script.js
document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE = "https://withtime.shop"; // HTTPS API 도메인 직접 호출

  const courseList = document.getElementById("courseList");
  const modal = document.getElementById("courseModal");
  const modalTitleEl = modal ? modal.querySelector("#modalTitle") : null;
  const modalBodyEl = modal ? modal.querySelector(".modal-body") : null;
  const modalFooterEl = modal ? modal.querySelector(".modal-footer") : null;
  let loadingEl = document.getElementById("courseLoading");

  let openRow = null;
  let lastFocused = null;
  let currentCourse = null;
  let coursesCache = [];

  const useTpl = (id) => {
    const tpl = document.getElementById(id);
    if (!tpl) throw new Error(`#${id} 템플릿을 찾을 수 없어요`);
    return tpl.content.firstElementChild.cloneNode(true);
  };

  const params = new URLSearchParams(location.search);
  const norm = {};
  for (const [k, v] of params.entries())
    norm[k.trim().toLowerCase()] = String(v).trim().toUpperCase();
  const ALLOWED = {
    market: ["TONGIN", "MANGWON", "NAMDAEMUN"],
    humanlevel: ["SOLO", "COUPLE", "FAMILY"],
    spicylevel: ["HOT", "MILD", "NONE"],
    fulllevel: ["LIGHT", "NORMAL", "FULL"],
  };
  const pickEnum = (key, fb) =>
    ALLOWED[key]?.includes(norm[key]) ? norm[key] : fb;
  const bodyData = {
    market: pickEnum("market", "TONGIN"),
    humanLevel: pickEnum("humanlevel", "SOLO"),
    spicyLevel: pickEnum("spicylevel", "NONE"),
    fullLevel: pickEnum("fulllevel", "LIGHT"),
  };

  const MARKET_KO = {
    TONGIN: "통인시장",
    MANGWON: "망원시장",
    NAMDAEMUN: "남대문시장",
  };

  (function setPageTitle() {
    const titleEl = document.querySelector(".title");
    if (!titleEl) return;
    const marketKo = MARKET_KO[bodyData.market] || "추천";
    titleEl.innerHTML = `AI가 엄선한 <span class="accent">${marketKo}</span> 코스 3가지!`;
  })(); // ✅ 추가된 부분: 페이지 로드 시 market 이름을 localStorage에 저장

  const marketCode = params.get("market");
  if (marketCode && MARKET_KO[marketCode.toUpperCase()]) {
    localStorage.setItem(
      "selectedMarketName",
      MARKET_KO[marketCode.toUpperCase()]
    );
  }
  const to2 = (n) => String(n ?? 0).padStart(2, "0");
  function parseTimeToHHmm(t) {
    if (!t) return "";
    if (typeof t === "object" && typeof t.hour === "number") {
      return `${to2(t.hour)}:${to2(t.minute ?? 0)}`;
    }
    if (typeof t === "string") {
      const m = t.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
      if (m) {
        const h = to2(Number(m[1]));
        const mm = to2(Number(m[2] ?? 0));
        return `${h}:${mm}`;
      }
      const clean = t.replace(/\s+/g, " ").trim();
      if (/^\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}$/.test(clean)) return clean;
    }
    return "";
  }
  function buildTimeLine(obj) {
    if (!obj) return "";
    const open = obj.openTime;
    const close = obj.closeTime;
    const holidays = Array.isArray(obj.holidays)
      ? obj.holidays.filter(Boolean).join(", ")
      : obj.holidays || "";

    let range = "";
    const openStr = parseTimeToHHmm(open);
    const closeStr = parseTimeToHHmm(close);

    if (
      openStr &&
      closeStr &&
      !openStr.includes("-") &&
      !closeStr.includes("-")
    ) {
      range = `${openStr} - ${closeStr}`;
    } else if (openStr && !openStr.includes("-") && !closeStr) {
      range = openStr;
    } else if (!openStr && closeStr && !closeStr.includes("-")) {
      range = closeStr;
    } else if (!openStr && !closeStr) {
      const both =
        typeof open === "string"
          ? open
          : typeof close === "string"
          ? close
          : "";
      const clean = (both || "").replace(/\s+/g, " ").trim();
      if (/^\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}$/.test(clean)) {
        range = clean.replace("~", " - ");
      } else {
        range = "";
      }
    } else {
      const cand = [openStr, closeStr].find((v) => v.includes("-")) || "";
      range = cand.replace("~", " - ");
    }

    const holidayLine = holidays ? ` / 휴무: ${holidays}` : "";
    return `${range}${holidayLine}`.trim();
  }

  // 시장명 결정(우선순위: bodyData → course.marketName → title에서 추출)
  function resolveMarketName(course) {
    const byBody = MARKET_KO?.[bodyData?.market];
    if (byBody) return byBody;
    if (course?.marketName) return String(course.marketName).trim();
    const t = (course?.title || "").trim();
    const m = t.match(/(통인|망원|남대문)(시장)?/);
    return m ? `${m[1]}시장` : "";
  }

  // 지도 페이지에 필요한 최소 정보만 남기기(용량 절감)
  function sanitizeCourseForMap(course) {
    const shops = Array.isArray(course?.shops) ? course.shops : [];
    const slimShops = shops.map((s) => {
      const name = s.name || s._shop?.title || "";
      // 좌표 보강: xPos/yPos 없으면 _shop 또는 lat/lng에서 채움
      const x = s.xPos ?? s.lng ?? s._shop?.xPos ?? s._shop?.lng ?? null;
      const y = s.yPos ?? s.lat ?? s._shop?.yPos ?? s._shop?.lat ?? null;
      return {
        shopId: s.shopId ?? s.id ?? null,
        name,
        xPos: x,
        yPos: y,
        location: s.location || s._shop?.addr || "",
        signatureMenu: s.signatureMenu || "",
      };
    });

    return {
      title: course?.title || "",
      marketName: resolveMarketName(course) || "",
      shops: slimShops,
      _savedAt: Date.now(),
    };
  }

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

  // Shops 인덱스/캐시

  const shopsIndex = { ready: false, byId: new Map() };
  async function ensureShopsIndex() {
    if (shopsIndex.ready) return;
    const json = await httpGetJSON(`${API_BASE}/api/shops`);
    const arr = Array.isArray(json?.result) ? json.result : [];
    arr.forEach((raw) => {
      const d = formatShop(raw);
      if (d?.id != null) shopsIndex.byId.set(d.id, d);
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
      shopCacheById.set(id, detail);
    }
    return detail;
  }

  async function getMenusByShopIdCached(shopId) {
    if (shopId == null) return [];
    if (menuCacheByShopId.has(shopId)) return menuCacheByShopId.get(shopId);
    const json = await httpGetJSON(
      `${API_BASE}/api/shops/${encodeURIComponent(shopId)}/menus`
    );
    const list = Array.isArray(json?.result?.menuPreviewList)
      ? json.result.menuPreviewList
      : [];
    menuCacheByShopId.set(shopId, list);
    return list;
  }

  async function fetchCourses() {
    try {
      const res = await fetch(`${API_BASE}/api/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(bodyData),
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.warn("[/api/courses JSON parse fail]", e, text);
      }
      if (!res.ok || data?.isSuccess === false) {
        const msg = data?.message || `코스 추천 서버 오류 (${res.status})`;
        throw new Error(msg);
      }
      return Array.isArray(data?.result?.courses) ? data.result.courses : [];
    } catch (err) {
      console.error("courses fetch 실패:", err);
      showToast(
        "코스를 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요 🙏"
      );
      return [];
    }
  }

  async function enrichCoursesWithShops(courses = []) {
    await ensureShopsIndex();
    const tasks = [];
    (Array.isArray(courses) ? courses : []).forEach((course) => {
      (Array.isArray(course.shops) ? course.shops : []).forEach((s) => {
        tasks.push(
          (async () => {
            let detail = null;
            if (s.shopId != null) detail = await getShopByIdSmart(s.shopId);
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
  function saveSelectedCourse(course) {
    try {
      localStorage.setItem("selectedCourse", JSON.stringify(course));

      const marketName = resolveMarketName(course); // ✅ 여기 수정
      if (marketName) {
        localStorage.setItem("selectedMarketName", marketName);
      } else {
        localStorage.removeItem("selectedMarketName");
      }
    } catch (e) {
      console.warn("[random→map] localStorage 저장 실패:", e);
    }
  }

  function goToMapWithCourse(course) {
    if (!course) return;
    saveSelectedCourse(course);

    const url = new URL("../map-page/map-page.html", location.href); // 형제 폴더
    const marketKo = MARKET_KO[bodyData.market];

    if (marketKo) {
      url.searchParams.set("marketName", marketKo);

      // ✅ 선택된 시장명을 localStorage에도 저장 (일관성 유지)
      localStorage.setItem("selectedMarketName", marketKo);
    }

    location.href = url.href;
  }
  function goToMapWithCourse(course) {
    if (!course) return;
    saveSelectedCourse(course);

    const url = new URL("../map-page/map-page.html", location.href); // 형제 폴더
    const marketKo = MARKET_KO[bodyData.market];

    if (marketKo) {
      url.searchParams.set("marketName", marketKo);

      // ✅ 선택된 시장명을 localStorage에도 저장 (일관성 유지)
      localStorage.setItem("selectedMarketName", marketKo);
    }

    location.href = url.href;
  }
  function goToMapWithCourse(course) {
    if (!course) return;
    saveSelectedCourse(course);
    const url = new URL("../map-page/map-page.html", location.href); // 형제 폴더
    const marketKo = MARKET_KO[bodyData.market];
    if (marketKo) url.searchParams.set("marketName", marketKo);
    location.href = url.href;
  }

  // 렌더 — 코스 배열/순서: 백 그대로, 코스명: title 그대로, signatureMenu만

  function saveSelectedCourse(course) {
    try {
      localStorage.setItem("selectedCourse", JSON.stringify(course));

      const marketName = pickMarketNameFromCourse(course);
      if (marketName) {
        localStorage.setItem("selectedMarketName", marketName);
      } else {
        localStorage.removeItem("selectedMarketName"); // 시장 못 찾으면 이전값 지움
      }
    } catch (e) {
      console.warn("[random→map] localStorage 저장 실패:", e);
    }
  }

  // =========================
  // 3번 반영: 이동 함수(중복 제거 + 더블클릭 방지 + 시장명 일관 저장)
  // =========================
  let __goingToMap = false; // 더블클릭/중복 이동 방지

  // 뒤로가기(BFCache) 복원/탭 복귀 때 가드 리셋
  function resetGoGuard() {
    __goingToMap = false;
  }
  window.addEventListener("pageshow", resetGoGuard); // BFCache 복원 포함
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resetGoGuard();
  });
  window.addEventListener("popstate", resetGoGuard); // 히스토리 이동 시

  function goToMapWithCourse(course) {
    if (!course || __goingToMap) return;

    // 빈 코스 방지
    if (!Array.isArray(course.shops) || course.shops.length === 0) {
      alert("이 코스에 가게 정보가 없어 지도로 이동할 수 없어요.");
      return;
    }

    __goingToMap = true;

    // 시장명 결정(일관 처리)
    const marketKo = resolveMarketName(course);
    if (marketKo) {
      // URL 쿼리 + 로컬 스토리지 모두 기록
      localStorage.setItem("selectedMarketName", marketKo);
    }

    // 선택 코스 저장(슬림)
    saveSelectedCourse(course);

    // 지도 페이지로 이동
    const url = new URL("../map-page/map-page.html", location.href); // 형제 폴더
    if (marketKo) url.searchParams.set("marketName", marketKo);
    location.href = url.href;
  }
  // =========================

  // 렌더 — 코스 배열/순서: 백 그대로, 코스명: title 그대로, signatureMenu만

  function renderCourses(courses) {
    const frag = document.createDocumentFragment();

    (Array.isArray(courses) ? courses : []).forEach((c, idx) => {
      const rowEl = useTpl("tpl-course-row");
      const labelEl = rowEl.querySelector(".course-label");
      const flowEl = rowEl.querySelector(".flow");

      // 코스명 그대로
      const title = c.title || `코스${idx + 1}`;
      labelEl.textContent = title;

      // 스텝
      const shops = Array.isArray(c.shops) ? c.shops : [];
      shops.forEach((s, i) => {
        const stepEl = useTpl("tpl-step");
        const sig = (s.signatureMenu || "").trim();
        const nameToShow = s.name || s._shop?.title || "";
        stepEl.querySelector(".name").textContent = nameToShow || "";
        stepEl.querySelector(".desc").textContent = sig || "-";
        flowEl.appendChild(stepEl);
        if (i < shops.length - 1) flowEl.appendChild(useTpl("tpl-arrow"));
      });

      // 버튼 인덱스 부여
      rowEl
        .querySelectorAll("[data-go-map], [data-open-modal]")
        .forEach((btn) => (btn.dataset.courseIndex = String(idx)));
      frag.appendChild(rowEl);
    });

    courseList.innerHTML = "";
    courseList.appendChild(frag);
    coursesCache = Array.isArray(courses) ? courses : [];
  }

  // 모달

  function openModal(course, openerBtn) {
    if (!modal) return;
    currentCourse = course;
    if (modalTitleEl) modalTitleEl.textContent = course?.title || "코스";

    if (modalBodyEl) {
      const frag = document.createDocumentFragment();
      (course.shops || []).forEach((s) => {
        const poiEl = useTpl("tpl-modal-poi");
        if (s.imageUrl || s._shop?.imageUrl) {
          const th = poiEl.querySelector(".thumb");
          th.style.backgroundImage = `url('${
            s.imageUrl || s._shop?.imageUrl
          }')`;
          th.style.backgroundSize = "cover";
          th.style.backgroundPosition = "center";
        }
        const sig = (s.signatureMenu || "").trim(); // signatureMenu만
        const nameToShow = s.name || s._shop?.title || "";
        const addrToShow = s.location || s._shop?.addr || "";
        poiEl.querySelector(".poi-title").textContent = `${nameToShow} - ${
          sig || "-"
        }`;
        poiEl.querySelector(".poi-addr").textContent = addrToShow;
        poiEl.querySelector(".poi-time").textContent =
          buildTimeLine(s._shop || s) || "";
        frag.appendChild(poiEl);
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
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
    if (lastFocused && typeof lastFocused.focus === "function")
      lastFocused.focus();
    lastFocused = null;
  } // ✅ 수정된 부분: goToMap 함수를 수정합니다.

  function goToMap(course) {
    if (!course) return; // localStorage에서 최신 시장 이름 가져오기

    const marketName =
      localStorage.getItem("selectedMarketName") || "추천 시장";

    localStorage.setItem("selectedCourse", JSON.stringify(course)); // URL에 marketName 파라미터를 추가하여 페이지 이동

    window.location.href = `../map-page/map-page.html?marketName=${encodeURIComponent(
      marketName
    )}`;
  }

  function showToast(msg) {
    alert(msg);
  }

  // 로딩 오버레이(없어도 생성)

  function ensureLoading() {
    if (loadingEl && document.body.contains(loadingEl)) return;
    loadingEl = document.createElement("div");
    loadingEl.id = "courseLoading";
    loadingEl.className = "course-loading-overlay";
    loadingEl.style.cssText =
      "position:fixed;inset:0;background:#fff;display:grid;place-items:center;z-index:9999;";
    const inner = document.createElement("div");
    inner.style.cssText =
      "display:flex;flex-direction:column;align-items:center;gap:10px;";
    const ico = document.createElement("span");
    ico.style.cssText =
      "width:28px;height:28px;background:url('icon/refresh_icon.png') center/contain no-repeat;animation:spin .9s linear infinite;";
    const txt = document.createElement("div");
    txt.textContent = "로딩 중입니다...";
    txt.style.cssText = "color:#362e2e;font-weight:700;";
    inner.appendChild(ico);
    inner.appendChild(txt);
    loadingEl.appendChild(inner);
    document.body.appendChild(loadingEl);
    const style = document.createElement("style");
    style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }
  function showCourseLoading() {
    ensureLoading();
    if (loadingEl) loadingEl.style.display = "grid";
  }
  function hideCourseLoading() {
    if (loadingEl) loadingEl.style.display = "none";
  }

  // 클릭 이벤트
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
      const course = coursesCache[idx];

      if (course) goToMapWithCourse(course);
      return;
    }
    // 지도 이동(모달 버튼) — 모달 내부 버튼이 2개여도 전부 잡음
    const goModalBtnAny = e.target.closest(
      ".modal [data-go-map-modal], .modal [data-go-map], .modal .btn-go-map"
    );
    if (goModalBtnAny) {
      if (currentCourse) {
        goToMapWithCourse(currentCourse);
      } else {
        const title = modalTitleEl?.textContent?.trim() || "";
        const course = (coursesCache || []).find(
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
      const course = coursesCache[idx] || null;
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open"))
      closeModal();
  });

  // 실행 — 로딩 표시 → 백 응답 그대로 보강 → 렌더 → 로딩 숨김

  try {
    showCourseLoading();
    const courses = await fetchCourses();
    const enriched = await enrichCoursesWithShops(courses);
    renderCourses(enriched);
  } catch (e) {
    console.error("[course] run error:", e);
    showToast(
      "코스를 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요 🙏"
    );
  } finally {
    hideCourseLoading();
  }

  if (modal) modal.style.display = "none";
});
