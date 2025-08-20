const start_button1 = document.getElementsByClassName("start-btn1");
const start_button2 = document.getElementsByClassName("start-btn2");

Array.from(start_button1).forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "../preference-page/preference-page.html";
  });
});

Array.from(start_button2).forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "../map-page/map-page.html";
  });
});
