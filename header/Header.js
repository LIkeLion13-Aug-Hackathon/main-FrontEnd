export function loadHeader(path = "../header/Header.html") {
  // ===== 공통 헬퍼 =====
  function parseJSONSafe(s, fb = null) {
    try {
      return s ? JSON.parse(s) : fb;
    } catch {
      return fb;
    }
  }
  function resolveMarketNameFrom(course, fallback = "") {
    if (!course) return fallback;
    if (course.marketName) return String(course.marketName).trim(); // 코스 객체에 있으면 우선
    const saved = localStorage.getItem("selectedMarketName"); // 과거 저장값
    if (saved) return saved;
    const t = (course.title || "").trim(); // 타이틀에서 추출
    const m = t.match(/(통인|망원|남대문)(시장)?/);
    return m ? `${m[1]}시장` : fallback;
  }
  function isValidCourse(c) {
    return c && Array.isArray(c.shops) && c.shops.length > 0;
  }
  // =====================

  document.addEventListener("DOMContentLoaded", () => {
    const headerEl = document.getElementById("header");
    if (!headerEl) {
      console.error("main-header 요소를 찾을 수 없습니다.");
      bindViewMapButton();

      function bindViewMapButton() {
        const header = document.getElementById("header");
        if (!header) return;

        const mapUrlBase = new URL("../map-page/map-page.html", location.href)
          .href;

        // 버튼 탐색: data-view-map, id, 텍스트 등 다양하게 대응
        let btn =
          header.querySelector("[data-view-map], #viewMapBtn, #viewMap") ||
          Array.from(header.querySelectorAll("a, button")).find((el) => {
            const t = (el.textContent || "").trim().toLowerCase();
            return t.includes("view map") || t.includes("지도");
          });

        if (!btn) return;

        if (btn.tagName === "A") btn.setAttribute("href", mapUrlBase);

        // 조건부 이동: 코스 있으면 코스 지도, 없으면 빈 지도
        btn.addEventListener("click", (e) => {
          e.preventDefault();

          const mapUrl = new URL("../map-page/map-page.html", location.href);
          const raw = localStorage.getItem("selectedCourse");
          const course = parseJSONSafe(raw);

          if (isValidCourse(course)) {
            // 코스 있는 경우 → 해당 코스 지도
            const marketName = resolveMarketNameFrom(course, "");
            if (marketName) {
              localStorage.setItem("selectedMarketName", marketName);
              mapUrl.searchParams.set("marketName", marketName);
            }
            location.href = mapUrl.href;
          } else {
            // 코스 없는 경우 → 빈 지도(완전 초기화)
            localStorage.removeItem("selectedCourse");
            localStorage.removeItem("selectedMarketName");
            location.href = mapUrl.href; // 쿼리 없이
          }
        });
      }
      return;
    }

    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP 오류: ${response.status}`);
        return response.text();
      })
      .then((data) => {
        headerEl.innerHTML = data;

        const button1 = document.getElementsByClassName("btn1");
        const button2 = document.getElementsByClassName("btn2");
        const logo = document.getElementsByClassName("logo");

        // 코스 설문으로 이동
        Array.from(button1).forEach((btn) => {
          btn.addEventListener("click", () => {
            window.location.href = "../preference-page/preference-page.html";
          });
        });

        // view map(= btn2) → 코스 있으면 코스 지도, 없으면 빈 지도
        Array.from(button2).forEach((btn) => {
          const mapUrlBase = new URL("../map-page/map-page.html", location.href)
            .href;
          if (btn.tagName === "A") btn.setAttribute("href", mapUrlBase);

          btn.addEventListener("click", (e) => {
            e.preventDefault();

            const mapUrl = new URL("../map-page/map-page.html", location.href);
            const raw = localStorage.getItem("selectedCourse");
            const course = parseJSONSafe(raw);

            if (isValidCourse(course)) {
              // 코스 있는 경우 → 해당 코스 지도
              const marketName = resolveMarketNameFrom(course, "");
              if (marketName) {
                localStorage.setItem("selectedMarketName", marketName);
                mapUrl.searchParams.set("marketName", marketName);
              }
              window.location.href = mapUrl.href;
            } else {
              // 코스 없는 경우 → 빈 지도(완전 초기화)
              localStorage.removeItem("selectedCourse");
              localStorage.removeItem("selectedMarketName");
              window.location.href = mapUrl.href; // 쿼리 없이
            }
          });
        });

        // 로고 → 시작 페이지
        Array.from(logo).forEach((img) => {
          img.addEventListener("click", () => {
            window.location.href = "../start-page/start-page.html";
          });
        });
      })
      .catch((err) => console.error("헤더 로드 실패:", err));
  });
}
