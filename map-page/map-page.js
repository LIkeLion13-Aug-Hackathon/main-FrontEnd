// map-page.js
let courseData = [];
let map;
window.routeLine = null; // 이전 라인 지우기 용도

// HTTPS API 도메인 직접 호출
const API_BASE = "https://withtime.shop";

// 캐시
const shopByNameCache = new Map(); // name → shop detail
const menusByIdCache = new Map(); // shopId → menuPreviewList

// 공통 GET(JSON + 타임아웃, JSON 아닌 응답도 안전 처리)
async function httpGetJSON(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => "");
    const ct = res.headers.get("content-type") || "";
    let data = null;
    if (text && ct.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch {}
    }
    if (!res.ok || data?.isSuccess === false) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// === 선택된 코스 불러오기 ===
async function loadCourseData() {
  const selectedCourseString = localStorage.getItem("selectedCourse");
  if (!selectedCourseString) {
    console.warn("localStorage에 선택된 코스가 없습니다.");
    return [];
  }

  let selectedCourse;
  try {
    selectedCourse = JSON.parse(selectedCourseString);
  } catch (err) {
    console.error("코스 데이터 파싱 실패:", err);
    return [];
  }

  if (!selectedCourse || !Array.isArray(selectedCourse.shops)) {
    console.error("코스 데이터 형식이 올바르지 않습니다.");
    return [];
  }

  // id → 실패 시 name으로 폴백 조회
  const fetchShopDetail = async (shop) => {
    // id 우선
    if (shop.shopId != null) {
      const byId = await httpGetJSON(
        `${API_BASE}/api/shops/${encodeURIComponent(shop.shopId)}`
      );
      if (byId?.result) return byId.result;
    }
    // 이름 폴백(캐시)
    const nameKey = (shop.name || "").trim().toLowerCase();
    if (nameKey) {
      if (shopByNameCache.has(nameKey)) return shopByNameCache.get(nameKey);
      const url = new URL(`${API_BASE}/api/shops/shop-name`);
      url.searchParams.set("name", shop.name || "");
      const byName = await httpGetJSON(url.toString());
      const detail = byName?.result || null;
      if (detail) shopByNameCache.set(nameKey, detail);
      return detail;
    }
    return null;
  };

  const results = await Promise.all(
    selectedCourse.shops.map(async (shop) => {
      const s = await fetchShopDetail(shop);
      if (!s) {
        // 좌표를 못 찾았어도 항목은 유지(경로에는 제외됨, 모달 텍스트는 표시)
        return {
          id: shop.shopId ?? null,
          name: shop.name || "",
          lat: null,
          lng: null,
          address: "",
          phone: "정보 없음",
          openTime: "",
          closeTime: "",
          holidays: "",
          image: "",
        };
      }
      return {
        id: s.shopId ?? null,
        name: s.name || shop.name || "",
        lat: s.yPos ?? null,
        lng: s.xPos ?? null,
        address: s.location || "",
        phone: s.phone || "정보 없음",
        openTime: s.openTime,
        closeTime: s.closeTime,
        holidays: s.holidays || s.holiday || "",
        image: s.imageUrl || "",
      };
    })
  );

  return results;
}

// === 메뉴 조회(튼튼 폴백) ===
async function fetchMenusByShopIdCached(shopId) {
  if (shopId == null) return [];
  if (menusByIdCache.has(shopId)) return menusByIdCache.get(shopId);
  const data = await httpGetJSON(
    `${API_BASE}/api/shops/${encodeURIComponent(shopId)}/menus`,
    8000
  );
  const list = Array.isArray(data?.result?.menuPreviewList)
    ? data.result.menuPreviewList
    : [];
  menusByIdCache.set(shopId, list);
  return list;
}
async function fetchShopByNameCached(name) {
  const key = (name || "").trim().toLowerCase();
  if (!key) return null;
  if (shopByNameCache.has(key)) return shopByNameCache.get(key);
  const url = new URL(`${API_BASE}/api/shops/shop-name`);
  url.searchParams.set("name", name);
  const data = await httpGetJSON(url.toString(), 8000);
  const detail = data?.result || null;
  if (detail) shopByNameCache.set(key, detail);
  return detail;
}
async function getMenusSmart(shop) {
  // 1) id로 먼저
  let menus = [];
  if (shop?.id != null) {
    menus = await fetchMenusByShopIdCached(shop.id);
  }
  // 2) 비었으면 이름으로 id 찾아 재조회
  if ((!menus || menus.length === 0) && shop?.name) {
    const detail = await fetchShopByNameCached(shop.name);
    if (detail?.shopId != null) {
      menus = await fetchMenusByShopIdCached(detail.shopId);
      // 보강: id 없던 항목이라면 id 기억해두기
      if (shop.id == null) shop.id = detail.shopId;
    }
  }
  return Array.isArray(menus) ? menus : [];
}

// === 시간/도움 함수 ===
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
  const open = parseTimeToHHmm(shopLike.openTime);
  const close = parseTimeToHHmm(shopLike.closeTime);
  const holidays = normalizeHolidays(shopLike.holidays || shopLike.holiday);
  const range =
    open || close ? `${open}${open && close ? " - " : ""}${close}` : "";
  const holidayLine = holidays ? ` / 휴무: ${holidays}` : "";
  const out = `${range}${holidayLine}`.trim();
  return out || "-";
}

function samePoint(a, b) {
  return (
    a.lat().toFixed(6) === b.lat().toFixed(6) &&
    a.lng().toFixed(6) === b.lng().toFixed(6)
  );
}
function distMetersLL(lat1, lng1, lat2, lng2) {
  const R = 6371e3,
    toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1),
    dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function sanitizePath(path, jumpThreshold = 3000) {
  if (!Array.isArray(path) || path.length < 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = out[out.length - 1],
      cur = path[i];
    if (samePoint(prev, cur)) continue;
    const d = distMetersLL(prev.lat(), prev.lng(), cur.lat(), cur.lng());
    if (d > jumpThreshold) continue;
    out.push(cur);
  }
  return out;
}
function closestIndexTo(target, path) {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = distMetersLL(
      target.lat(),
      target.lng(),
      path[i].lat(),
      path[i].lng()
    );
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// === 지도 초기화 ===
async function initMap() {
  courseData = await loadCourseData();

  // URL 파라미터에서 시장 이름 확인(줌 조정 용도)
  const urlParams = new URLSearchParams(window.location.search);
  const marketName = urlParams.get("marketName") || "";
  const initialZoom = marketName === "남대문시장" ? 15 : 16.5;

  // 지도 기본 세팅 (코스 없어도 항상 지도는 뜨게)

  map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(37.5665, 126.978), // 기본값: 서울 시청
    zoom: initialZoom,
  });

  if (courseData.length === 0) {
    console.warn("코스 데이터가 없어 기본 지도만 표시됩니다.");

    const headerContainer = document.getElementById("courseBar");
    headerContainer.innerHTML = "";

    const infoDiv = document.createElement("div");
    infoDiv.className = "no-course-info";
    infoDiv.textContent =
      "아직 선택된 코스가 없습니다. 코스 추천을 받아보세요!";

    const goBtn = document.createElement("button");
    goBtn.className = "course-btn special-btn";
    goBtn.textContent = "AI로 먹킷 코스 짜기";
    goBtn.onclick = () => {
      window.location.href = "../preference-page/preference-page.html";
    };

    headerContainer.appendChild(infoDiv);
    headerContainer.appendChild(goBtn);
    return;
  }

  // <<<<<<< HEAD
  //   // ✅ 코스 있을 때만 정상 동작
  //   let totalLat = 0;
  //   let totalLng = 0;
  //   courseData.forEach((shop) => {
  //     totalLat += shop.lat;
  //     totalLng += shop.lng;
  //   });

  //   const centerLat = totalLat / courseData.length;
  //   const centerLng = totalLng / courseData.length;

  //   map.setCenter(new naver.maps.LatLng(centerLat, centerLng));
  // =======
  // 코스 평균 위치로 센터 이동(좌표 있는 것만 평균)
  const coords = courseData.filter((s) => s.lat != null && s.lng != null);
  const center = coords.length
    ? new naver.maps.LatLng(
        coords.reduce((a, c) => a + c.lat, 0) / coords.length,
        coords.reduce((a, c) => a + c.lng, 0) / coords.length
      )
    : new naver.maps.LatLng(37.5665, 126.978);
  map.setCenter(center);

  renderCourseButtons();
  renderMarkersAndPath();
}

function renderCourseButtons() {
  const headerContainer = document.getElementById("courseBar");
  headerContainer.innerHTML = "";

  const urlParams = new URLSearchParams(window.location.search);
  const marketName =
    localStorage.getItem("selectedMarketName") ||
    urlParams.get("marketName") ||
    "선택된 시장";

  const specialBtn = document.createElement("button");
  specialBtn.className = "course-btn special-btn";
  specialBtn.textContent = marketName;

  specialBtn.onclick = () => {
    const first = courseData.find((s) => s.lat != null && s.lng != null);
    if (first) moveToLocation(first.lat, first.lng);
  };
  headerContainer.appendChild(specialBtn);

  courseData.forEach((store, index) => {
    const btn = document.createElement("button");
    btn.className = "course-btn";

    const pinImg = document.createElement("img");
    pinImg.src = "../map-page/map_asset/red-pin.png";
    pinImg.alt = "Red Pin";
    pinImg.className = "pin-icon";

    const textSpan = document.createElement("span");
    textSpan.textContent = store.name;

    btn.appendChild(pinImg);
    btn.appendChild(textSpan);

    btn.onclick = () => {
      if (store.lat != null && store.lng != null) {
        moveToLocation(store.lat, store.lng);
      }

      showDetailPanel(store);
    };
    headerContainer.appendChild(btn);

    if (index < courseData.length - 1) {
      const arrowImg = document.createElement("img");
      arrowImg.src = "../map-page/map_asset/map-arrow.png";
      arrowImg.alt = "Arrow";
      arrowImg.className = "arrow-icon";
      headerContainer.appendChild(arrowImg);
    }
  });
}

// === 마커 + 라벨 + 경로(좌→우, 중간 1개, 시작→끝만) ===

async function renderMarkersAndPath() {
  const positions = [];
  const labelBounds = [];
  const projection = map.getProjection();

  function isOverlapping(a, b) {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  // 마커/라벨/클릭(모달)
  courseData.forEach((store) => {
    if (store.lat == null || store.lng == null) return; // 좌표 없는 항목은 경로/마커 제외

    const position = new naver.maps.LatLng(store.lat, store.lng);
    positions.push({ position, store });

    const marker = new naver.maps.Marker({
      position,
      map,
      icon: {
        url: "../map-page/map_asset/map-pin.png",
        size: new naver.maps.Size(32, 48),
        scaledSize: new naver.maps.Size(20, 48),
        anchor: new naver.maps.Point(16, 32),
      },
      title: store.name,
    });

    // 라벨 위치 겹침 방지

    const directions = [
      { x: 10, y: -45, className: "right" },
      { x: -60, y: -80, className: "top" },
      { x: -50, y: 20, className: "bottom" },
      { x: -160, y: -25, className: "left" },
    ];

    let chosen = directions[0];
    const point = projection.fromCoordToOffset(position);

    for (let dir of directions) {
      const newBox = {
        left: point.x + dir.x,
        right: point.x + dir.x + 120,
        top: point.y + dir.y,
        bottom: point.y + dir.y + 40,
      };
      const overlap = labelBounds.some((box) => isOverlapping(newBox, box));
      if (!overlap) {
        chosen = dir;
        labelBounds.push(newBox);
        break;
      }
    }

    const labelDiv = new naver.maps.Marker({
      position,
      map,
      icon: {
        content: `
          <div class="marker-label-container ${chosen.className}"
               style="transform: translate(${chosen.x}px, ${chosen.y}px);">

            ${store.name}

          </div>
        `,
        anchor: new naver.maps.Point(0, 0),
      },
    });

    naver.maps.Event.addListener(marker, "click", () => showDetailPanel(store));
    naver.maps.Event.addListener(labelDiv, "click", () =>
      showDetailPanel(store)
    );
  });

  // 이전 라인 제거
  if (window.routeLine) {
    window.routeLine.setMap(null);
    window.routeLine = null;
  }

  // 경로 계산: 좌→우 (가장 왼쪽을 시작, 가장 오른쪽을 끝, 중간 1개만)
  if (positions.length < 2) return;

  // 좌표 정렬용 복사
  const sortedByLng = positions
    .slice()
    .sort((a, b) => a.position.lng() - b.position.lng());
  const start = sortedByLng[0];
  const end = sortedByLng[sortedByLng.length - 1];

  // 중간 후보: start.lng < cand.lng < end.lng
  let middle = null;
  const middleCandidates = sortedByLng.slice(1, -1).filter((p) => {
    const x = p.position.lng();
    return x > start.position.lng() && x < end.position.lng();
  });

  if (middleCandidates.length === 1) {
    middle = middleCandidates[0];
  } else if (middleCandidates.length > 1) {
    // 총 거리 최소( start→m + m→end )
    let best = null,
      bestD = Infinity;
    for (const cand of middleCandidates) {
      const d =
        distMetersLL(
          start.position.lat(),
          start.position.lng(),
          cand.position.lat(),
          cand.position.lng()
        ) +
        distMetersLL(
          cand.position.lat(),
          cand.position.lng(),
          end.position.lat(),
          end.position.lng()
        );
      if (d < bestD) {
        bestD = d;
        best = cand;
      }
    }
    middle = best;
  } else {
    middle = null;
  }

  const routeNodes = middle ? [start, middle, end] : [start, end];

  // 세그먼트 병합(시작→끝만, 중간 1개 있을 때 두 구간)
  let mergedPath = [];
  for (let i = 0; i < routeNodes.length - 1; i++) {
    const segStart = routeNodes[i].position;
    const segEnd = routeNodes[i + 1].position;

    try {
      const url = new URL(`${API_BASE}/api/directions`);
      url.searchParams.set("alat", segStart.lat());
      url.searchParams.set("alng", segStart.lng());
      url.searchParams.set("blat", segEnd.lat());
      url.searchParams.set("blng", segEnd.lng());
      url.searchParams.set("priority", "RECOMMEND");

      const data = await httpGetJSON(url.toString(), 9000);

      let segmentPath = [];
      if (Array.isArray(data?.path) && data.path.length > 0) {
        segmentPath = data.path.map(
          ([lat, lng]) => new naver.maps.LatLng(lat, lng)
        );
        // path를 segStart~segEnd 구간으로 정확히 트리밍
        const idxS = closestIndexTo(segStart, segmentPath);
        const idxE = closestIndexTo(segEnd, segmentPath);
        const a = Math.min(idxS, idxE),
          b = Math.max(idxS, idxE);
        segmentPath = segmentPath.slice(a, b + 1);
      } else {
        segmentPath = [segStart, segEnd]; // 실패 시 직선
      }

      segmentPath = sanitizePath(segmentPath);

      // 세그먼트 양 끝 보장
      if (!samePoint(segmentPath[0], segStart)) segmentPath.unshift(segStart);
      if (!samePoint(segmentPath[segmentPath.length - 1], segEnd))
        segmentPath.push(segEnd);

      // 첫 세그먼트 시작점 보장
      if (
        i === 0 &&
        (!mergedPath.length || !samePoint(mergedPath[0], segStart))
      )
        mergedPath.push(segStart);

      // 세그먼트를 중복 없이 이어붙이기
      for (const pt of segmentPath) {
        const last = mergedPath[mergedPath.length - 1];
        if (!last || !samePoint(last, pt)) mergedPath.push(pt);
      }
    } catch (error) {
      console.error(`길찾기 오류: ${error}`);
      if (i === 0) mergedPath.push(segStart);
      const last = mergedPath[mergedPath.length - 1];
      if (!last || !samePoint(last, segEnd)) mergedPath.push(segEnd);
    }
  }

  // 병합 결과 검증/보정
  if (!Array.isArray(mergedPath) || mergedPath.length < 2) {
    mergedPath = routeNodes.map((p) => p.position); // 직선 다중 연결로라도
  }

  // 최종 끝점에 정확히 스냅(꼬리 방지)
  const finalEnd = routeNodes[routeNodes.length - 1].position;
  const idxEnd = closestIndexTo(finalEnd, mergedPath);
  mergedPath = mergedPath.slice(0, idxEnd + 1);
  const last = mergedPath[mergedPath.length - 1];
  const endD = distMetersLL(
    last.lat(),
    last.lng(),
    finalEnd.lat(),
    finalEnd.lng()
  );
  if (endD > 15) mergedPath.push(finalEnd);
  mergedPath = sanitizePath(mergedPath);

  // 최종 라인 그리기 + 화면에 맞추기
  if (mergedPath.length > 1) {
    window.routeLine = new naver.maps.Polyline({
      map,
      path: mergedPath,
      strokeWeight: 3,
      strokeColor: "#FF0013",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      zIndex: 100,
    });

    const bounds = new naver.maps.LatLngBounds();
    mergedPath.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds);
  }
}

// === 상세 패널 ===
async function showDetailPanel(data) {
  document.getElementById("storeName").textContent = data.name;
  document.getElementById("storeAddr").textContent = data.address || "";
  document.getElementById("storeTime").textContent = buildTimeLineFrom(data);
  document.getElementById("storePhone").textContent = data.phone || "정보 없음";

  const menuContainer = document.getElementById("storeImages");
  menuContainer.innerHTML = "<p>메뉴 불러오는 중...</p>";

  try {
    const menuList = await getMenusSmart(data);

    if (menuList.length === 0) {
      menuContainer.innerHTML = "<p>등록된 메뉴가 없습니다.</p>";
    } else {
      menuContainer.innerHTML = "";

      // 메뉴가 4개 이상일 때는 3개까지만 출력
      const limitedMenuList = menuList.slice(0, 3);

      limitedMenuList.forEach((menu) => {
        const menuItem = document.createElement("div");
        menuItem.className = "menu-item";

        const priceText =
          typeof menu.price === "number"
            ? `${menu.price.toLocaleString()}원`
            : menu.price || "";

        let imageContent = "";
        if (menu.ImageUrl && menu.ImageUrl.trim() !== "") {
          imageContent = `<img src="${menu.ImageUrl}" alt="${menu.name}" class="menu-image"/>`;
        } else {
          imageContent = `<div class="no-image">이미지 없음</div>`;
        }

        menuItem.innerHTML = `
      ${imageContent}
      <div class="menu-details">
        <div class="menu-name">${menu.name}</div>
        <div class="menu-price">${priceText}</div>
      </div>
    `;

        menuContainer.appendChild(menuItem);
      });
    }
  } catch (err) {
    console.error("메뉴 로딩 오류:", err);
    menuContainer.innerHTML = "<p>메뉴 정보를 불러오지 못했습니다.</p>";
  }

  document.getElementById("detailPanel").style.display = "flex";
}

// 닫기 버튼

document.getElementById("closePanel").onclick = function () {
  document.getElementById("detailPanel").style.display = "none";
};

// 지도 이동
function moveToLocation(lat, lng) {
  map.setCenter(new naver.maps.LatLng(lat, lng));
}

// 로드 시 지도 초기화

window.onload = initMap;
