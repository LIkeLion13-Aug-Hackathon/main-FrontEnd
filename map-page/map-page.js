let courseData = [
  {
    id: 1,
    name: "통인시장",
    lat: 37.58099,
    lng: 126.97098,
  },
  {
    id: 2,
    name: "전주 콩나물 국밥",
    lat: 37.5564437,
    lng: 126.9059919,
    mainMenu: "순두부 비빔밥",
  },
  {
    id: 3,
    name: "○○분식",
    lat: 37.5553218,
    lng: 126.9058578,
    mainMenu: "국물 떡볶이",
  },
  {
    id: 4,
    name: "○○시장 종로방앗간",
    lat: 37.5568264,
    lng: 126.9058578,
    mainMenu: "부대찌개",
  },
];

let map;

// 지도 초기화
function initMap() {
  map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(courseData[3].lat, courseData[3].lng),
    zoom: 17,
  });

  renderCourseButtons();
  renderMarkersAndPath();
}

// 버튼 생성
function renderCourseButtons() {
  const headerContainer = document.getElementById("courseBar");
  headerContainer.innerHTML = "";

  courseData.forEach((store, index) => {
    const btn = document.createElement("button");
    btn.className = "course-btn";

    if (index === 0) {
      btn.classList.add("special-btn");
      btn.textContent = store.name;
    } else {
      const pinImg = document.createElement("img");
      pinImg.src = "../map-page/map_asset/red-pin.png";
      pinImg.alt = "Red Pin";
      pinImg.className = "pin-icon";

      const textSpan = document.createElement("span");
      textSpan.textContent = store.name;

      btn.appendChild(pinImg);
      btn.appendChild(textSpan);
    }

    btn.onclick = () => {
      moveToLocation(store.lat, store.lng);
      openStoreDetail(store);
    };

    headerContainer.appendChild(btn);

    if (index > 0 && index < courseData.length - 1) {
      const arrowImg = document.createElement("img");
      arrowImg.src = "../map-page/map_asset/map-arrow.png";
      arrowImg.alt = "Arrow";
      arrowImg.className = "arrow-icon";
      headerContainer.appendChild(arrowImg);
    }
  });
}

function renderMarkersAndPath() {
  let pathPoints = [];

  courseData.forEach((store, index) => {
    if (index === 0) return; // 통인시장 제외

    const position = new naver.maps.LatLng(store.lat, store.lng);
    pathPoints.push({ store, position });

    const labelText = store.mainMenu || store.name;

    // 마커 생성 (말풍선 + 핀 위로 살짝 올리기)
    const marker = new naver.maps.Marker({
      position: position,
      map: map,
      icon: {
        content: `
          <div class="marker-label-container">${labelText}</div>
          <img src="../map-page/map_asset/map-pin.png" class="marker-label-pin" />
        `,
        anchor: new naver.maps.Point(12, 50), // y값 키워서 마커/말풍선 위로 올리기
      },
    });

    // 마커 클릭 이벤트
    naver.maps.Event.addListener(marker, "click", function () {
      openStoreDetail(store);
    });
  });

  // === Polyline 경로 정렬 ===
  // 여기서는 lat(위도) 오름차순으로 정렬, 필요하면 lng(경도) 기준으로 바꿀 수 있음
  pathPoints.sort((a, b) => a.store.lat - b.store.lat);

  const sortedPath = pathPoints.map((p) => p.position);

  // Polyline 생성
  new naver.maps.Polyline({
    path: sortedPath,
    map: map,
    strokeColor: "rgba(248, 155, 155, 1)",
    strokeOpacity: 0.8,
    strokeWeight: 4,
  });
}
// 모달 데이터 열기
function openStoreDetail(store) {
  const dummyData = {
    name: store.name,
    address: "서울특별시 종로구 내자동 1-3",
    hours: "06:00 - 21:00",
    phone: "010-1234-5678",
    menus: [
      { name: "순두부 비빔밥", image: "../map-page/map_asset/modal-image.png" },
      {
        name: "해물 콩나물국밥",
        image: "../map-page/map_asset/modal-image.png",
      },
      { name: "부대찌개", image: "../map-page/map_asset/modal-image.png" },
    ],
  };
  showDetailPanel(dummyData);
}

// 모달 표시
function showDetailPanel(data) {
  document.getElementById("storeName").textContent = data.name;
  document.getElementById("storeAddr").textContent = data.address;
  document.getElementById("storeTime").textContent = data.hours;
  document.getElementById("storePhone").textContent = data.phone;

  const menuContainer = document.getElementById("storeImages");
  menuContainer.innerHTML = "";
  data.menus.forEach((menu) => {
    const menuItem = document.createElement("div");
    menuItem.className = "menu-item";
    menuItem.innerHTML = `
      <img src="${menu.image}" alt="${menu.name}" />
      <span>${menu.name}</span>
    `;
    menuContainer.appendChild(menuItem);
  });

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

// 페이지 로드 시 실행
window.onload = initMap;
