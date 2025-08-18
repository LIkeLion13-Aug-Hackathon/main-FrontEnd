(function () {
  const modal = document.getElementById("courseModal");
  let openRow = null;
  let lastFocused = null;

  document.addEventListener("click", (e) => {
    // 0) 페이지 이동: 코스 액션 버튼
    const goMapBtn = e.target.closest("[data-go-map]");
    if (goMapBtn) {
      const row = goMapBtn.closest(".course-row");
      const label =
        row?.querySelector(".course-label")?.textContent.trim() || "";
      const url = `./map.html?course=${encodeURIComponent(label)}`;
      window.location.href = url; // 새 탭이면: window.open(url, "_blank", "noopener");
      return; // 아래 토글/모달 로직 실행되지 않도록 종료
    }

    // 0-2) 페이지 이동: 모달 풋터 버튼
    const goModalBtn = e.target.closest("[data-go-map-modal]");
    if (goModalBtn) {
      const label =
        modal.querySelector("#modalTitle")?.textContent.trim() || "";
      const url = `./map.html?course=${encodeURIComponent(label)}`;
      window.location.href = url; // 새 탭이면: window.open(url, "_blank", "noopener");
      return;
    }

    // 1) '코스 정보 자세히 보기' 버튼 → 모달 열기
    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) {
      const row = openBtn.closest(".course-row");
      const labelText =
        row?.querySelector(".course-label")?.textContent.trim() || "코스";
      modal.querySelector("#modalTitle").textContent = labelText;

      lastFocused = openBtn;
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");
      setTimeout(() => modal.querySelector(".modal-close")?.focus(), 0);
      return;
    }

    // 2) 코스 컨테이너 열고 닫기(액션 영역 클릭 시에는 토글 안 함)
    const row = e.target.closest(".course-row");
    if (!row) return;
    if (e.target.closest(".course-actions")) return;

    if (openRow && openRow !== row) {
      openRow.classList.remove("open");
      openRow.setAttribute("aria-expanded", "false");
      openRow
        .querySelector(".course-actions")
        ?.setAttribute("aria-hidden", "true");
    }
    const willOpen = !row.classList.contains("open");
    row.classList.toggle("open", willOpen);
    row.setAttribute("aria-expanded", willOpen ? "true" : "false");
    row
      .querySelector(".course-actions")
      ?.setAttribute("aria-hidden", willOpen ? "false" : "true");
    openRow = willOpen ? row : null;
  });

  // 모달 닫기(오버레이, X, Esc)
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest(".modal-close")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open"))
        closeModal();
    });
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    if (lastFocused) {
      lastFocused.focus();
      lastFocused = null;
    }
  }
})();
