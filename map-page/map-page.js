// map.js
let courseData = [];
let map;

// === 선택된 코스 불러오기 ===
async function loadCourseData() {
  const selectedCourseString = localStorage.getItem("selectedCourse");
  if (!selectedCourseString) {
    console.error("localStorage에 선택된 코스가 없습니다.");
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

  const fetchPromises = selectedCourse.shops.map(async (shop) => {
    try {
      const shopRes = await fetch(
        `http://54.180.163.161:8080/api/shops/${shop.shopId}`
      );
      if (!shopRes.ok) throw new Error(`가게 조회 실패: ${shop.name}`);
      const shopData = await shopRes.json();
      const shopResult = shopData.result || {};

      const menus = Array.isArray(shopResult.menus)
        ? shopResult.menus.map((menu) => ({
            name: menu.name,
            image: menu.imageUrl || "",
            price: menu.price || "가격 정보 없음",
            description: menu.description || "",
          }))
        : [];

      return {
        id: shopResult.shopId,
        name: shopResult.name,
        lat: shopResult.yPos,
        lng: shopResult.xPos,
        address: shopResult.location,
        phone: shopResult.phone || "정보 없음",
        hours: `${shopResult.openTime || "-"} ~ ${shopResult.closeTime || "-"}`,
        image: shopResult.imageUrl || "",
        menus,
      };
    } catch (err) {
      console.error(`[가게 정보 로딩 실패] ${shop.name}:`, err);
      return null; // 실패 시 null 반환
    }
  });

  const results = await Promise.all(fetchPromises);
  return results.filter((r) => r !== null); // null 제거
}

// === 지도 초기화 ===
async function initMap() {
  courseData = await loadCourseData();

  // ✅ URL 파라미터에서 시장 이름 확인
  const urlParams = new URLSearchParams(window.location.search);
  const marketName = urlParams.get("marketName") || "";

  // ✅ 남대문시장일 경우 줌 레벨 다르게
  const initialZoom = marketName === "남대문시장" ? 15 : 16.5;

  // ✅ 지도 기본 세팅 (코스 없어도 항상 지도는 뜨게)
  map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(37.5665, 126.978), // 기본값: 서울 시청
    zoom: initialZoom,
  });

  if (courseData.length === 0) {
    console.warn("코스 데이터가 없어 기본 지도만 표시됩니다.");

    // 코스 추천 이동 UI 표시
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
      // 👉 실제 코스 추천 페이지 경로로 수정해
    };

    headerContainer.appendChild(infoDiv);
    headerContainer.appendChild(goBtn);
    return;
  }

  // ✅ 코스 있을 때만 정상 동작
  let totalLat = 0;
  let totalLng = 0;
  courseData.forEach((shop) => {
    totalLat += shop.lat;
    totalLng += shop.lng;
  });

  const centerLat = totalLat / courseData.length;
  const centerLng = totalLng / courseData.length;

  map.setCenter(new naver.maps.LatLng(centerLat, centerLng));
  renderCourseButtons();
  renderMarkersAndPath();
}

// === 버튼 생성 ===
function renderCourseButtons() {
  const headerContainer = document.getElementById("courseBar");
  headerContainer.innerHTML = "";

  // ✅ 수정된 부분: URL 쿼리 파라미터에서 시장 이름을 가져옵니다.
  const urlParams = new URLSearchParams(window.location.search);

  // ✅ localStorage > URL > 기본값
  const marketName =
    localStorage.getItem("selectedMarketName") ||
    urlParams.get("marketName") ||
    "선택된 시장";

  const specialBtn = document.createElement("button");
  specialBtn.className = "course-btn special-btn";
  specialBtn.textContent = marketName;

  specialBtn.onclick = () => {
    if (courseData.length > 0) {
      moveToLocation(courseData[0].lat, courseData[0].lng);
    }
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
      moveToLocation(store.lat, store.lng);
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

// === 거리 계산 ===
function distance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// === 마커 + 라벨 겹침 방지 + 경로 + 클릭 이벤트 ===
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

  courseData.forEach((store) => {
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

    const labelText = store.name;

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
               ${labelText}
          </div>
        `,
        anchor: new naver.maps.Point(0, 0),
      },
    });

    naver.maps.Event.addListener(marker, "click", function () {
      showDetailPanel(store);
    });
    naver.maps.Event.addListener(labelDiv, "click", function () {
      showDetailPanel(store);
    });
  });

  // === 경로 그리기 ===
  if (positions.length >= 2) {
    let mergedPath = [];

    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i].position;
      const end = positions[i + 1].position;

      try {
        const url = new URL("http://54.180.163.161:8080/api/directions");
        url.searchParams.set("alat", start.lat());
        url.searchParams.set("alng", start.lng());
        url.searchParams.set("blat", end.lat());
        url.searchParams.set("blng", end.lng());
        url.searchParams.set("priority", "RECOMMEND");

        const res = await fetch(url);
        const data = await res.json();

        if (data.path && Array.isArray(data.path) && data.path.length > 0) {
          const segmentPath = data.path.map(
            ([lat, lng]) => new naver.maps.LatLng(lat, lng)
          );

          if (i === 0) mergedPath.push(start);

          for (let pt of segmentPath) {
            const last = mergedPath[mergedPath.length - 1];
            if (
              !last ||
              pt.lat().toFixed(6) !== last.lat().toFixed(6) ||
              pt.lng().toFixed(6) !== last.lng().toFixed(6)
            ) {
              mergedPath.push(pt);
            }
          }

          if (i === positions.length - 2) mergedPath.push(end);
        }
      } catch (error) {
        console.error(`${positions[i + 1].store.name} 길찾기 오류:`, error);
      }
    }

    if (mergedPath.length > 1) {
      new naver.maps.Polyline({
        map,
        path: mergedPath,
        strokeWeight: 3,
        strokeColor: "#FF0013",
        strokeOpacity: 0.9,
        strokeStyle: "solid",
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
    }
  }
}
// === 상세 패널 ===
async function showDetailPanel(data) {
  document.getElementById("storeName").textContent = data.name;
  document.getElementById("storeAddr").textContent = data.address;
  document.getElementById("storeTime").textContent = data.hours;
  document.getElementById("storePhone").textContent = data.phone;

  const menuContainer = document.getElementById("storeImages");
  menuContainer.innerHTML = "<p>메뉴 불러오는 중...</p>";

  try {
    // 메뉴 API 호출
    const res = await fetch(
      `http://54.180.163.161:8080/api/shops/${data.id}/menus`
    );
    if (!res.ok) throw new Error("메뉴 불러오기 실패");
    const menuData = await res.json();

    const menuList = menuData.result?.menuPreviewList || [];

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

// 닫기 버튼 이벤트
document.getElementById("closePanel").onclick = function () {
  document.getElementById("detailPanel").style.display = "none";
};

// 지도 이동 함수
function moveToLocation(lat, lng) {
  map.setCenter(new naver.maps.LatLng(lat, lng));
}

// 이 함수는 사용되지 않으므로 제거하거나 그대로 둡니다.
async function openStoreDetail(shopId) {
  console.error(
    "openStoreDetail 함수는 더 이상 사용되지 않습니다. showDetailPanel을 사용하세요."
  );
}

// 스크립트가 로드되면 지도 초기화를 실행합니다.
window.onload = initMap;
