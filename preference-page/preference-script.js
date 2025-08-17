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

  let current = 0;
  const answers = {};

  function renderStep() {
    const s = steps[current];

    stepEl.textContent = String(current + 1);
    titleEl.textContent = s.title;
    subEl.textContent = s.sub;

    // 옵션 세팅/리셋
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

    // 이전 응답 복원
    if (answers[s.name]) {
      const prev = form.querySelector(
        `input[name="${s.name}"][value="${answers[s.name]}"]`
      );
      if (prev) {
        prev.checked = true;
        updateLineOptions();
      }
    }

    // 버튼/Back
    nextBtn.disabled = !form.querySelector(`input[name="${s.name}"]:checked`);
    nextBtn.textContent =
      current === steps.length - 1 ? "Result →" : "Next Question →";
    backBtn.style.visibility = current === 0 ? "hidden" : "visible";

    // 스텝별 마진 클래스(body에 부여)
    document.body.classList.toggle("step-1", current === 0);
    document.body.classList.toggle("step-others", current !== 0);

    updateProgressVisual();
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

  // 진행바: 현재 스텝=즉시 틴트, 이전 스텝=체크(아이콘 교체)
  function updateProgressVisual() {
    progressItems.forEach((item, idx) => {
      const img = progressImgs[idx];
      item.classList.remove("active", "is-done");

      if (idx < current) {
        if (img.getAttribute("src") !== CHECK_ICON_SRC) {
          img.setAttribute("src", CHECK_ICON_SRC);
        }
        item.classList.add("is-done"); // 26x26 강제
      } else if (idx === current) {
        if (img.getAttribute("src") !== originalSrcs[idx]) {
          img.setAttribute("src", originalSrcs[idx]);
        }
        item.classList.add("active"); // 필터로 #d64550 톤
      } else {
        if (img.getAttribute("src") !== originalSrcs[idx]) {
          img.setAttribute("src", originalSrcs[idx]);
        }
      }
    });

    // 디바이더: 색만 클래스 토글로 제어
    progressDividers.forEach((div, idx) => {
      div.classList.toggle("done", idx < current);
    });
  }

  // 라디오 변경
  form.addEventListener("change", (e) => {
    if (!e.target.matches('input[type="radio"]')) return;
    const s = steps[current];
    answers[s.name] = e.target.value;
    nextBtn.disabled = false;
    updateLineOptions();
  });

  // Next: 마지막 스텝이면 다음 페이지로 이동(알림 X)
  nextBtn.addEventListener("click", () => {
    const s = steps[current];
    const checked = form.querySelector(`input[name="${s.name}"]:checked`);
    if (!checked) {
      alert("하나를 선택해 주세요!");
      return;
    }
    answers[s.name] = checked.value;

    if (current === steps.length - 1) {
      // 여기에 결과 페이지 경로 넣기
      // course-page.html
      window.location.href = "result.html";
      return;
    }

    current += 1;
    renderStep();
  });

  // Back
  backBtn.addEventListener("click", () => {
    if (current === 0) return;
    current -= 1;
    renderStep();
  });

  renderStep();
});
