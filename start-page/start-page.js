// start-page.html JS
document.addEventListener("DOMContentLoaded", () => {
  const start_button1 = document.getElementsByClassName("start-btn1");
  const start_button2 = document.getElementsByClassName("start-btn2");

  // 1) AI로 먹킷 코스 짜기 → 기존 코스는 그대로 두고 설문 페이지로 이동
  Array.from(start_button1).forEach((btn) => {
    btn.addEventListener("click", () => {
      // ❌ 삭제 코드 제거
      // localStorage.removeItem("selectedCourse");
      // localStorage.removeItem("selectedMarketName");

      window.location.href = "../preference-page/preference-page.html";
    });
  });

  // 2) 지도 탐색 버튼은 기존 로직 그대로 유지
  Array.from(start_button2).forEach((btn) => {
    const mapUrl = new URL("../map-page/map-page.html", location.href).href;
    if (btn.tagName === "A") btn.setAttribute("href", mapUrl);

    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const raw = localStorage.getItem("selectedCourse");
      let course = null;
      try {
        course = raw ? JSON.parse(raw) : null;
      } catch {}

      if (course && Array.isArray(course.shops) && course.shops.length > 0) {
        // 코스 있는 경우 → 최근 코스 그대로 지도 페이지로
        window.location.href = mapUrl;
      } else {
        // 코스 없는 경우 → 초기화 후 빈 지도
        localStorage.removeItem("selectedCourse");
        localStorage.removeItem("selectedMarketName");
        window.location.href = mapUrl;
      }
    });
  });
});
//예은
