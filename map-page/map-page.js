let courseData = [];
let map;

// === 선택된 코스 불러오기 ===
async function loadCourseData() {
  const selectedCourseString = localStorage.getItem("selectedCourse");
  if (!selectedCourseString) {
    console.error("localStorage에 선택된 코스 데이터가 없습니다.");
    return [];
  }

  const selectedCourse = JSON.parse(selectedCourseString);

  const fetchPromises = selectedCourse.shops.map(async (shop) => {
    try {
      const shopRes = await fetch(
        `http://54.180.163.161:8080/api/shops/${shop.shopId}`
      );
      if (!shopRes.ok) {
        throw new Error(
          `가게 정보 조회 실패: ${shop.name} (${shopRes.status})`
        );
      }
      const shopData = await shopRes.json();
      const shopResult = shopData.result || {};

      const openTime = shopResult.openTime || "-";
      const closeTime = shopResult.closeTime || "-";

      // ✅ 수정된 부분: 메뉴 정보에 price와 description 추가
      const menus = Array.isArray(shopResult.menus)
        ? shopResult.menus.map((menu) => ({
            name: menu.name,
            image: menu.imageUrl || menu.ImageUrl || "",
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
        phone: shopResult.phone || "정보 없음", // ✅ 전화번호
        hours: `${openTime} ~ ${closeTime}`,
        image: shopResult.imageUrl || "",
        menus: menus,
      };
    } catch (err) {
      console.error(`[가게 정보 로딩 실패] ${shop.name || ""}:`, err);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  return results.filter((shop) => shop !== null);
}

// === 지도 초기화 ===
async function initMap() {
  courseData = await loadCourseData();
  if (courseData.length === 0) return;

  map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(courseData[1].lat, courseData[1].lng),
    zoom: 17,
  });

  renderCourseButtons();
  renderMarkersAndPath();
}

// === 버튼 생성 ===
function renderCourseButtons() {
  const headerContainer = document.getElementById("courseBar");
  headerContainer.innerHTML = "";

  const marketName = localStorage.getItem("selectedMarket") || "시장";
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

    // 👉 기본은 오른쪽, 겹치면 top → bottom → left 순서로 fallback
    const directions = [
      { x: 10, y: -25, className: "right" }, // 기본
      { x: -60, y: -80, className: "top" }, // 1차 fallback
      { x: -50, y: 20, className: "bottom" }, // 2차 fallback
      { x: -100, y: -25, className: "left" }, // 최후 fallback
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

    // ✅ 코스 전체 순서대로 (0번 ~ 마지막 가게)
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

          // ✅ 첫 구간이면 출발점 포함
          if (i === 0) mergedPath.push(start);

          // ✅ 중복 좌표 제거 + 잘못된 점 거르기
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

          // ✅ 마지막 구간이면 도착점 포함
          if (i === positions.length - 2) mergedPath.push(end);
        }
      } catch (error) {
        console.error(`${positions[i + 1].store.name} 길찾기 오류:`, error);
      }
    }

    // === Polyline 생성 ===
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
function showDetailPanel(data) {
  document.getElementById("storeName").textContent = data.name;
  document.getElementById("storeAddr").textContent = data.address;
  document.getElementById("storeTime").textContent = data.hours;
  document.getElementById("storePhone").textContent = data.phone;

  const menuContainer = document.getElementById("storeImages");
  menuContainer.innerHTML = "";
  if (data.menus && Array.isArray(data.menus)) {
    data.menus.forEach((menu) => {
      const menuItem = document.createElement("div");
      menuItem.className = "menu-item";

      // ✅ 수정된 부분: 이미지, 이름, 가격, 설명을 포함하도록 HTML 구조 변경
      menuItem.innerHTML = `
                <img src="${menu.image}" alt="${menu.name}" class="menu-image"/>
                <div class="menu-details">
                    <div class="menu-name">${menu.name}</div>
                    <div class="menu-price">${menu.price}원</div>
                    <div class="menu-desc">${menu.description || ""}</div>
                </div>
            `;
      menuContainer.appendChild(menuItem);
    });
  }

  document.getElementById("detailPanel").style.display = "flex";
}

document.getElementById("closePanel").onclick = function () {
  document.getElementById("detailPanel").style.display = "none";
};

function moveToLocation(lat, lng) {
  map.setCenter(new naver.maps.LatLng(lat, lng));
}

// 이 함수는 더 이상 필요하지 않습니다.
async function openStoreDetail(shopId) {
  console.error(
    "openStoreDetail 함수는 더 이상 사용되지 않습니다. showDetailPanel을 사용하세요."
  );
}

window.onload = initMap;
