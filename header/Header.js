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

        // 버튼 이벤트 등록
        const button1 = document.getElementsByClassName("btn1");
        const button2 = document.getElementsByClassName("btn2");
        const logo = document.getElementsByClassName("logo"); // ✅ 로고 선택

        Array.from(button1).forEach((btn) => {
          btn.addEventListener("click", () => {
            window.location.href = "../preference-page/preference-page.html";
          });
        });

        Array.from(button2).forEach((btn) => {
          btn.addEventListener("click", () => {
            window.location.href = "../map-page/map-page.html";
          });
        });

        // ✅ 로고 클릭 시 start-page 이동
        Array.from(logo).forEach((img) => {
          img.addEventListener("click", () => {
            window.location.href = "../start-page/start-page.html";
          });
        });
      })
      .catch((err) => console.error("헤더 로드 실패:", err));
  });
}
