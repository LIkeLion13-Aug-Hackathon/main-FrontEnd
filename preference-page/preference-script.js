document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("question-form");
  const stepEl = document.getElementById("step");
  const titleEl = document.getElementById("question-title");
  const subEl = document.querySelector(".question-sub");
  const nextBtn = document.getElementById("next-btn");
  const backBtn = document.getElementById("back-btn");

  const progressItems = Array.from(document.querySelectorAll(".progress-item"));
  const progressDividers = Array.from(
    document.querySelectorAll(".progress-divider")
  );
  const progressImgs = progressItems.map((pi) => pi.querySelector("img"));
  const originalSrcs = progressImgs.map((img) => img.getAttribute("src"));
  const CHECK_ICON_SRC = "icon/done_icon.png";

  const optionLabels = Array.from(form.querySelectorAll("label"));

  const steps = [
    {
      name: "market",
      title: "AI 먹킷 코스를 볼 전통시장을 선택해 주세요!",
      sub: "한 가지를 선택해 주세요.",
      options: ["통인시장", "남대문시장", "망원시장"],
    },
    {
      name: "companion",
      title: "전통시장을 누구와 방문하실 예정인가요?",
      sub: "한 가지를 선택해 주세요.",
      options: ["혼자 방문해요.", "친구, 연인과 방문해요.", "가족과 방문해요."],
    },
    {
      name: "spicy",
      title: "당신의 매운 음식 선호도를 알려주세요!",
      sub: "한 가지를 선택해 주세요.",
      options: [
        "매운 음식 좋아해요.",
        "조금 먹을 수 있어요.",
        "매운 음식 못 먹어요.",
      ],
    },
    {
      name: "hunger",
      title: "마지막으로, 배고픈 정도를 알려주세요!",
      sub: "한 가지를 선택해 주세요.",
      options: [
        "많이 배고파요!",
        "살짝 출출하네요.",
        "음, 배는 그렇게 안 고파요.",
      ],
    },
  ];

  // 한글 → enum 매핑(백으로 보낼 값)
  const MARKET_MAP = {
    통인시장: "TONGIN",
    망원시장: "MANGWON",
    남대문시장: "NAMDAEMUN",
  };
  const HUMAN_MAP = {
    "혼자 방문해요.": "SOLO",
    "친구, 연인과 방문해요.": "COUPLE",
    "가족과 방문해요.": "FAMILY",
  };
  const SPICY_MAP = {
    "매운 음식 좋아해요.": "HOT",
    "조금 먹을 수 있어요.": "MILD",
    "매운 음식 못 먹어요.": "NONE",
  };
  const FULL_MAP = {
    "많이 배고파요!": "LIGHT",
    "살짝 출출하네요.": "NORMAL",
    "음, 배는 그렇게 안 고파요.": "FULL",
  };

  let current = 0;
  const answers = {};

  function renderStep() {
    const s = steps[current];

    stepEl.textContent = String(current + 1);
    titleEl.textContent = s.title;
    subEl.textContent = s.sub;

    optionLabels.forEach((label, idx) => {
      const input = label.querySelector('input[type="radio"]');
      const icon = label.querySelector(".option-icon");
      const text = label.querySelector("span");
      if (s.options[idx]) {
        label.style.display = "flex";
        input.name = s.name;
        input.value = s.options[idx];
        input.checked = false;
        text.textContent = s.options[idx];
        if (icon && icon.dataset.default) icon.src = icon.dataset.default;
        label.classList.remove("selected");
      } else {
        label.style.display = "none";
      }
    });

    if (answers[s.name]) {
      const prev = form.querySelector(
        `input[name="${s.name}"][value="${answers[s.name]}"]`
      );
      if (prev) {
        prev.checked = true;
        updateLineOptions();
      }
    }

    nextBtn.disabled = !form.querySelector(`input[name="${s.name}"]:checked`);
    nextBtn.textContent =
      current === steps.length - 1 ? "Result →" : "Next Question →";
    backBtn.style.visibility = current === 0 ? "hidden" : "visible";

    document.body.classList.toggle("step-1", current === 0);
    document.body.classList.toggle("step-others", current !== 0);

    updateProgressVisual();
    ensureRandomLinkBound();
  }

  function updateLineOptions() {
    const s = steps[current];
    optionLabels.forEach((label) => {
      const input = label.querySelector(`input[name="${s.name}"]`);
      const icon = label.querySelector(".option-icon");
      if (!input || !icon) return;
      icon.src = input.checked
        ? icon.dataset.selected || icon.src
        : icon.dataset.default || icon.src;
      label.classList.toggle("selected", input.checked);
    });
  }

  function updateProgressVisual() {
    progressItems.forEach((item, idx) => {
      const img = progressImgs[idx];
      item.classList.remove("active", "is-done");

      if (idx < current) {
        if (img.getAttribute("src") !== CHECK_ICON_SRC)
          img.setAttribute("src", CHECK_ICON_SRC);
        item.classList.add("is-done");
      } else if (idx === current) {
        if (img.getAttribute("src") !== originalSrcs[idx])
          img.setAttribute("src", originalSrcs[idx]);
        item.classList.add("active");
      } else {
        if (img.getAttribute("src") !== originalSrcs[idx])
          img.setAttribute("src", originalSrcs[idx]);
      }
    });

    progressDividers.forEach((div, idx) =>
      div.classList.toggle("done", idx < current)
    );
  }

  // 선택 변경
  form.addEventListener("change", (e) => {
    if (!e.target.matches('input[type="radio"]')) return;
    const s = steps[current];
    answers[s.name] = e.target.value;
    nextBtn.disabled = false;
    updateLineOptions();
  });

  // 다음(이동)
  nextBtn.addEventListener("click", () => {
    const s = steps[current];
    const checked = form.querySelector(`input[name="${s.name}"]:checked`);
    if (!checked) {
      alert("하나를 선택해 주세요!");
      return;
    }
    answers[s.name] = checked.value;

    if (current === steps.length - 1) {
      const params = new URLSearchParams({
        market: MARKET_MAP[answers.market] ?? "TONGIN",
        humanLevel: HUMAN_MAP[answers.companion] ?? "SOLO",
        spicyLevel: SPICY_MAP[answers.spicy] ?? "NONE",
        fullLevel: FULL_MAP[answers.hunger] ?? "LIGHT",
      });

      // ✅ 사용자가 선택한 시장명을 localStorage에 저장
      localStorage.setItem("selectedMarketName", answers.market);

      const target = new URL("../course-page/course-page.html", location.href);
      target.search = params.toString();

      // ✅ 선택한 시장을 localStorage에 확실히 저장
      const marketName = answers.market; // (예: "통인시장", "남대문시장", "망원시장")
      localStorage.setItem("selectedMarketName", marketName);

      // 로딩 오버레이 없이 즉시 이동

      nextBtn.disabled = true;
      location.href = target.href;
      return;
    }
    current += 1;
    renderStep();
  });

  // 이전(스텝 n → n-1로 이동)
  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (current === 0) return; // 1번 스텝이면 아무 것도 안 함(숨김)
    current -= 1;
    renderStep();
  });

  // 하단 '랜덤 코스 보기' 링크 보정 + 안전 클릭 바인딩
  function ensureRandomLinkBound() {
    const rndLink = document.querySelector(".random-course a");
    if (!rndLink) return;

    // 항상 절대경로 갱신(스텝 전환 시에도 유지)

    const rndTarget = new URL(
      "../course-page/course-random.html",
      location.href
    );
    rndLink.setAttribute("href", rndTarget.href);

    // 중복 바인딩 방지
    if (rndLink.dataset.bound === "true") return;
    rndLink.dataset.bound = "true";

    // 어떤 오버레이/폼 이벤트에 가려져도 반드시 이동하게 캡처 단계에서 처리
    rndLink.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 일부 환경에서 다른 핸들러보다 먼저 처리하도록 캡처 사용
        window.location.href = rndTarget.href;
      },
      true // capture 단계
    );
  }

  renderStep();

  // 문서 레벨 캡처 위임: 어떤 스텝에서도 a 클릭을 확실히 잡아준다
  (function bindRandomLinkOnce() {
    if (window.__bindRandomOnce) return;
    window.__bindRandomOnce = true;

    document.addEventListener(
      "click",
      (e) => {
        const a = e.target.closest(".random-course a");
        if (!a) return;

        e.preventDefault();
        e.stopPropagation(); // 혹시 모를 상위 핸들러 차단
        const rndTarget = new URL(
          "../course-page/course-random.html",
          location.href
        );
        window.location.href = rndTarget.href;
      },
      true
    );
  })();
});
