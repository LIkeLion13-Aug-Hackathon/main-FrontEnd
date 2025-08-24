// start-page.html에 추가하거나 수정할 JavaScript 코드
document.addEventListener("DOMContentLoaded", () => {
  const start_button1 = document.getElementsByClassName("start-btn1");
  const start_button2 = document.getElementsByClassName("start-btn2");

  // 1) AI로 먹킷 코스 짜기 → 코스 초기화 후 설문으로
  Array.from(start_button1).forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.removeItem("selectedCourse");
      localStorage.removeItem("selectedMarketName");
      window.location.href = "../preference-page/preference-page.html";
    });
  });

  // 2) 전통시장 지도 탐색하러 가기 → 코스/시장 비우고, 쿼리 없이 지도 페이지로
  Array.from(start_button2).forEach((btn) => {
    const mapUrl = new URL("../map-page/map-page.html", location.href).href;
    if (btn.tagName === "A") btn.setAttribute("href", mapUrl); // a 태그 대비

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("selectedCourse");
      localStorage.removeItem("selectedMarketName");
      window.location.href = mapUrl;
    });
  });
});
