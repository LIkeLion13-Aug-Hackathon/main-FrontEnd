export function loadHeader(path = "../header/Header.html") {
  document.addEventListener("DOMContentLoaded", () => {
    const headerEl = document.getElementById("header");
    if (!headerEl) {
      console.error("main-header 요소를 찾을 수 없습니다.");
      bindViewMapButton();

      function bindViewMapButton() {
        const header = document.getElementById("header");
        if (!header) return;

        // 형제 폴더 기준(map-page)으로 절대 URL 구성
        const mapUrl = new URL("../map-page/map-page.html", location.href).href;

        // 버튼 탐색: data-view-map, id, 텍스트 등 다양하게 대응
        let btn =
          header.querySelector("[data-view-map], #viewMapBtn, #viewMap") ||
          Array.from(header.querySelectorAll("a, button")).find((el) => {
            const t = (el.textContent || "").trim().toLowerCase();
            return t.includes("view map") || t.includes("지도");
          });

        if (!btn) return;

        // a 태그면 href도 세팅(자바스크립트 비활성 시 대비)
        if (btn.tagName === "A") btn.setAttribute("href", mapUrl);

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          // 코스 선택 비우기 → map-page 이동
          localStorage.removeItem("selectedCourse");
          // marketName은 비워서 “코스 없는 지도”가 뜨게
          location.href = mapUrl;
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

        Array.from(button1).forEach((btn) => {
          btn.addEventListener("click", () => {
            window.location.href = "../preference-page/preference-page.html";
          });
        });

        // view map(= btn2) → 항상 "선택 전" 지도 열기
        Array.from(button2).forEach((btn) => {
          const mapUrl = new URL("../map-page/map-page.html", location.href)
            .href;

          // a 태그라면 href도 안전하게 세팅(비자바스크립트 환경 대비)
          if (btn.tagName === "A") btn.setAttribute("href", mapUrl);

          btn.addEventListener("click", (e) => {
            e.preventDefault();
            // 선택 상태 초기화
            localStorage.removeItem("selectedCourse");
            localStorage.removeItem("selectedMarketName");
            // 쿼리 없이 지도 페이지로 이동 → map-page의 "코스 없음" 분기 진입
            window.location.href = mapUrl;
          });
        });

        Array.from(logo).forEach((img) => {
          img.addEventListener("click", () => {
            window.location.href = "../start-page/start-page.html";
          });
        });
      })
      .catch((err) => console.error("헤더 로드 실패:", err));
  });
}
