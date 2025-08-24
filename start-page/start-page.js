// start-page.html에 추가하거나 수정할 JavaScript 코드
document.addEventListener("DOMContentLoaded", () => {
  const start_button1 = document.getElementsByClassName("start-btn1");
  const start_button2 = document.getElementsByClassName("start-btn2");

  Array.from(start_button1).forEach((btn) => {
    btn.addEventListener("click", () => {
      // '코스 선택하기' 버튼 클릭 시, 기존 코스 데이터 초기화
      localStorage.removeItem("selectedCourse");
      window.location.href = "../preference-page/preference-page.html";
    });
  });

  Array.from(start_button2).forEach((btn) => {
    btn.addEventListener("click", () => {
      const marketName =
        localStorage.getItem("selectedMarketName") || "선택된 시장";

      window.location.href = `../map-page/map-page.html?marketName=${encodeURIComponent(
        marketName
      )}`;
    });
  });
});
