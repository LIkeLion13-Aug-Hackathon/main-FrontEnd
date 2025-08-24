export function loadHeader(path = "../header/Header.html") {
  document.addEventListener("DOMContentLoaded", () => {
    const headerEl = document.getElementById("header");
    if (!headerEl) {
      console.error("main-header 요소를 찾을 수 없습니다.");
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

        Array.from(button2).forEach((btn) => {
          btn.addEventListener("click", () => {
            let marketName =
              localStorage.getItem("selectedMarketName") || "선택된 시장";

            const selectedCourseString = localStorage.getItem("selectedCourse");
            if (selectedCourseString) {
              try {
                const selectedCourse = JSON.parse(selectedCourseString);
                if (selectedCourse && selectedCourse.marketName) {
                  marketName = selectedCourse.marketName;
                }
              } catch (error) {
                console.error("localStorage 코스 데이터 파싱 실패:", error);
              }
            }

            // ✅ 항상 최신 시장명을 localStorage에 저장
            localStorage.setItem("selectedMarketName", marketName);

            window.location.href = `../map-page/map-page.html?marketName=${encodeURIComponent(
              marketName
            )}`;
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
