/* Multi-exam runner — supports timed exam mode and answer-checked practice mode */

const state = {
  examId: null,
  mode: "exam", // "exam" | "practice"
  examMeta: null,
  basePath: "",
  questions: [],
  answers: {},
  userAnswers: {},
  checkedAnswers: new Set(),
  marked: new Set(),
  visited: new Set(),
  current: 0,
  reviewMode: false,
  timerSeconds: 3 * 60 * 60,
  timerId: null,
};

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id"),
    mode: params.get("mode") === "practice" ? "practice" : "exam",
  };
}

async function init() {
  const { id: examId, mode } = getParams();
  if (!examId) {
    window.location.href = "index.html";
    return;
  }
  state.examId = examId;
  state.mode = mode;

  const catalog = await (await fetch("exams/catalog.json")).json();
  const meta = catalog.exams.find((e) => e.id === examId);
  if (!meta) {
    alert("Exam not found in catalog.");
    window.location.href = "index.html";
    return;
  }
  state.examMeta = meta;
  state.basePath = `exams/${meta.folder}/`;
  state.timerSeconds = (meta.duration_minutes || 180) * 60;

  document.getElementById("exam-title").textContent = meta.title;
  document.title = `${meta.title} · ${mode === "practice" ? "Practice" : "Exam"}`;

  const badge = document.getElementById("mode-badge");
  if (badge) {
    badge.textContent = mode === "practice" ? "Practice" : "Exam";
    badge.classList.add(mode);
  }

  // Timer only in exam mode
  if (mode === "practice") {
    document.getElementById("timer").style.display = "none";
  }

  const [qRes, aRes] = await Promise.all([
    fetch(state.basePath + "questions.json"),
    fetch(state.basePath + "answers.json"),
  ]);
  state.questions = (await qRes.json()).questions;
  state.answers = (await aRes.json()).answers;

  const key = storageKey();
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      state.userAnswers = p.userAnswers || {};
      state.checkedAnswers = new Set(p.checkedAnswers || []);
      state.marked = new Set(p.marked || []);
      state.visited = new Set(p.visited || []);
      state.current = p.current || 0;
      if (mode === "exam") {
        state.timerSeconds = p.timerSeconds ?? state.timerSeconds;
      }
    } catch (_) {}
  }

  buildPalette();
  renderQuestion();
  if (mode === "exam") startTimer();
  bindEvents();
}

function storageKey() {
  return `gate_progress_${state.examId}_${state.mode}`;
}

function hasUserAnswer(qid) {
  const answer = state.userAnswers[qid];
  return (
    answer !== undefined &&
    answer !== "" &&
    !(Array.isArray(answer) && answer.length === 0)
  );
}

function persist() {
  localStorage.setItem(
    storageKey(),
    JSON.stringify({
      userAnswers: state.userAnswers,
      checkedAnswers: [...state.checkedAnswers],
      marked: [...state.marked],
      visited: [...state.visited],
      current: state.current,
      timerSeconds: state.timerSeconds,
    })
  );
}

function startTimer() {
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    if (state.reviewMode) return;
    state.timerSeconds--;
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerId);
      submitExam();
    }
    updateTimerDisplay();
    persist();
  }, 1000);
}

function updateTimerDisplay() {
  const s = Math.max(0, state.timerSeconds);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  document.getElementById("timer").textContent = `${h}:${m}:${sec}`;
}

function buildPalette() {
  const grid = document.getElementById("palette");
  grid.innerHTML = "";
  state.questions.forEach((q, i) => {
    const btn = document.createElement("button");
    btn.className = "p-btn";
    btn.textContent = q.id;
    btn.addEventListener("click", () => goTo(i));
    grid.appendChild(btn);
  });
  updatePalette();
}

function updatePalette() {
  const buttons = document.querySelectorAll(".p-btn");
  let answered = 0, marked = 0, notVisited = 0;

  buttons.forEach((btn, i) => {
    const qid = String(state.questions[i].id);
    btn.classList.remove("answered", "marked", "current", "not-visited");
    if (i === state.current) btn.classList.add("current");

    const hasAns =
      state.userAnswers[qid] !== undefined &&
      (Array.isArray(state.userAnswers[qid])
        ? state.userAnswers[qid].length > 0
        : state.userAnswers[qid] !== "");

    if (state.marked.has(qid)) {
      btn.classList.add("marked");
      marked++;
    } else if (hasAns) {
      btn.classList.add("answered");
      answered++;
    } else {
      btn.classList.add("not-visited");
      notVisited++;
    }
  });

  document.getElementById("sum-answered").textContent = answered;
  document.getElementById("sum-marked").textContent = marked;
  document.getElementById("sum-not").textContent = notVisited;
  document.getElementById("progress-text").textContent =
    `${answered} / ${state.questions.length}`;
}

function assetUrl(src) {
  if (!src) return src;
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return state.basePath + src.replace(/^\.\//, "");
}

function renderQuestion() {
  const q = state.questions[state.current];
  const qid = String(q.id);
  state.visited.add(qid);

  document.getElementById("q-number").textContent = `Q.${q.id}`;
  document.getElementById("q-type").textContent = q.type;
  document.getElementById("q-marks").textContent = `${q.marks} Mark${q.marks > 1 ? "s" : ""}`;
  document.getElementById("q-section").textContent = q.section_code || "";

  document.getElementById("q-text").innerHTML = formatText(q.text);

  const tablesEl = document.getElementById("q-tables");
  tablesEl.innerHTML = "";
  (q.tables || []).forEach((t) => {
    const wrap = document.createElement("div");
    wrap.className = "q-table-wrap";
    let html = `<table><caption>${escapeHtml(t.caption || "")}</caption><thead><tr>`;
    (t.headers || []).forEach((h) => (html += `<th>${h}</th>`));
    html += `</tr></thead><tbody>`;
    (t.rows || []).forEach((row) => {
      html += "<tr>";
      row.forEach((cell) => (html += `<td>${cell}</td>`));
      html += "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
    tablesEl.appendChild(wrap);
  });

  const assetsEl = document.getElementById("q-assets");
  assetsEl.innerHTML = "";
  (q.assets || []).forEach((src) => {
    const img = document.createElement("img");
    img.src = assetUrl(src);
    img.alt = q.figure_description || `Figure for Q${q.id}`;
    assetsEl.appendChild(img);
  });

  const optsEl = document.getElementById("q-options");
  optsEl.innerHTML = "";
  optsEl.classList.remove("image-grid");
  const ansMeta = state.answers[qid] || {};
  const answerAssets = ansMeta.assets || [];
  const optionCount = Object.keys(q.options || {}).length;
  const assetsMatchOptions =
    q.type !== "NAT" &&
    ansMeta.assets_for_options === true &&
    answerAssets.length === optionCount;

  const showFeedback =
    state.reviewMode ||
    (state.mode === "practice" && state.checkedAnswers.has(qid));

  if (q.type === "NAT") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "nat-input";
    input.placeholder = "Enter numerical answer";
    input.value = state.userAnswers[qid] ?? "";
    input.disabled = state.reviewMode;
    input.addEventListener("input", (e) => {
      state.userAnswers[qid] = e.target.value.trim();
      state.checkedAnswers.delete(qid);
      optsEl.querySelector(".practice-feedback")?.remove();
      document.getElementById("btn-check-answer").disabled =
        !hasUserAnswer(qid);
      updatePalette();
      persist();
    });
    optsEl.appendChild(input);
  } else {
    const isMSQ = q.type === "MSQ";
    const userAns = state.userAnswers[qid] || (isMSQ ? [] : null);
    const entries = Object.entries(q.options || {});
    const hasImageOpts = entries.some(
      ([, v]) => v && typeof v === "object" && v.type === "image"
    );
    if (hasImageOpts || assetsMatchOptions) {
      optsEl.classList.add("image-grid");
    }

    entries.forEach(([key, val], index) => {
      const div = document.createElement("label");
      div.className = "option";
      const checked = isMSQ ? userAns.includes(key) : userAns === key;
      if (checked) div.classList.add("selected");

      if (showFeedback) {
        const correct = state.answers[qid]?.correct || [];

        if (state.reviewMode || hasUserAnswer(qid)) {
          if (correct.includes(key)) div.classList.add("correct");
          else if (checked) div.classList.add("wrong");
        }
      }

      const input = document.createElement("input");
      input.type = isMSQ ? "checkbox" : "radio";
      input.name = `q${q.id}`;
      input.value = key;
      input.checked = checked;
      input.disabled = state.reviewMode;
      input.addEventListener("change", () => {
        if (isMSQ) {
          let arr = state.userAnswers[qid] ? [...state.userAnswers[qid]] : [];
          if (input.checked) {
            if (!arr.includes(key)) arr.push(key);
          } else {
            arr = arr.filter((x) => x !== key);
          }
          arr.sort();
          state.userAnswers[qid] = arr;
        } else {
          state.userAnswers[qid] = key;
        }
        state.checkedAnswers.delete(qid);
        renderQuestion();
        updatePalette();
        persist();
      });

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = key;

      const content = document.createElement("span");
      content.className = "content";

      if (val && typeof val === "object" && val.type === "image") {
        div.classList.add("has-image");
        const img = document.createElement("img");
        img.src = assetUrl(val.src);
        img.alt = val.alt || `Option ${key}`;
        img.className = "option-image";
        img.loading = "lazy";
        content.appendChild(img);
      } else {
        const textVal =
          typeof val === "object" ? val.text || JSON.stringify(val) : String(val);
        content.innerHTML = formatText(textVal.replace(/\\n/g, "\n"));
      }

      if (assetsMatchOptions) {
        div.classList.add("has-image");
        const img = document.createElement("img");
        img.src = assetUrl(answerAssets[index]);
        img.alt = `Option ${key} for Q${q.id}`;
        img.className = "option-image";
        img.loading = "lazy";
        content.appendChild(img);
      }

      div.append(input, label, content);
      optsEl.appendChild(div);
    });
  }

  const checkAnswerButton = document.getElementById("btn-check-answer");
  checkAnswerButton.hidden = state.mode !== "practice" || state.reviewMode;
  checkAnswerButton.disabled = !hasUserAnswer(qid);

  if (showFeedback) {
    const result = evaluateOne(qid);

    if (state.reviewMode || hasUserAnswer(qid)) {
      const fb = document.createElement("div");
      fb.className =
        (state.mode === "practice" && !state.reviewMode
          ? "practice-feedback "
          : "review-feedback ") + result.status;
      fb.innerHTML = result.message;
      optsEl.appendChild(fb);
    }

    if (state.reviewMode && ansMeta.explanation) {
      const exp = document.createElement("div");
      exp.className = "review-explanation";
      exp.innerHTML =
        "<strong>Explanation:</strong> " + formatText(ansMeta.explanation);
      optsEl.appendChild(exp);
    }
    if (ansMeta.assets && ansMeta.assets.length && !assetsMatchOptions) {
      const box = document.createElement("div");
      box.className = "q-assets";
      ansMeta.assets.forEach((src) => {
        const img = document.createElement("img");
        img.src = assetUrl(src);
        img.alt = `Solution for Q${q.id}`;
        box.appendChild(img);
      });
      optsEl.appendChild(box);
    }
  }

  document.getElementById("btn-prev").disabled = state.current === 0;
  document.getElementById("btn-next").textContent = state.reviewMode
    ? "Next →"
    : "Save & Next →";

  // In practice mode, submit is optional ("Finish")
  const submitBtn = document.getElementById("btn-submit");
  if (state.mode === "practice" && !state.reviewMode) {
    submitBtn.textContent = "Finish";
  } else if (!state.reviewMode) {
    submitBtn.textContent = "Submit";
  }

  updatePalette();
  persist();
  renderMath();
}

function renderMath() {
  if (!window.renderMathInElement) return;
  const opts = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  };
  ["q-text", "q-options", "q-tables"].forEach((id) => {
    renderMathInElement(document.getElementById(id), opts);
  });
}

function formatText(str) {
  if (!str) return "";
  const preserved = [];
  const preserve = (html) => {
    const marker = `\u0000${preserved.length}\u0000`;
    preserved.push(html);
    return marker;
  };
  let s = escapeHtml(str).replace(
    /```([\w+-]*)[ \t]*\r?\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const className = lang ? ` class="language-${lang}"` : "";
      const source = code.replace(/\r?\n$/, "");
      return preserve(`<pre><code${className}>${source}</code></pre>`);
    }
  );
  s = s.replace(/(\$\$|\$)[\s\S]*?\1/g, (math) => preserve(math));
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\r?\n/g, "<br>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, index) => preserved[index]);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function goTo(idx) {
  if (idx < 0 || idx >= state.questions.length) return;
  state.current = idx;
  renderQuestion();
  document.getElementById("palette-panel").classList.remove("open");
}

function next() {
  if (state.current < state.questions.length - 1) goTo(state.current + 1);
}
function prev() {
  if (state.current > 0) goTo(state.current - 1);
}

function evaluateOne(qid) {
  const key = state.answers[qid];
  if (!key) return { status: "partial", message: "No answer key.", marks: 0 };
  const q = state.questions.find((x) => String(x.id) === qid);
  const user = state.userAnswers[qid];
  const marks = q.marks;
  const neg = key.negative_marks || 0;

  if (
    user === undefined ||
    user === "" ||
    (Array.isArray(user) && user.length === 0)
  ) {
    return { status: "partial", message: "Not attempted.", marks: 0 };
  }

  if (q.type === "MCQ") {
    if (key.correct.includes(user))
      return { status: "correct", message: `Correct. +${marks}`, marks };
    return {
      status: "wrong",
      message: `Incorrect. Correct option${
        key.correct.length > 1 ? "s" : ""
      }: <strong>${key.correct.join(", ")}</strong>${
        state.mode === "exam" || state.reviewMode
          ? ` · −${neg.toFixed(2)}`
          : ""
      }`,
      marks: -neg,
    };
  }

  if (q.type === "MSQ") {
    const correctSet = new Set(key.correct);
    const userSet = new Set(Array.isArray(user) ? user : [user]);
    const match =
      correctSet.size === userSet.size &&
      [...correctSet].every((c) => userSet.has(c));
    if (match)
      return { status: "correct", message: `Correct. +${marks}`, marks };
    return {
      status: "wrong",
      message: `Incorrect. Correct: <strong>${key.correct.join(", ")}</strong>`,
      marks: 0,
    };
  }

  const num = parseFloat(user);
  const range = key.range;
  const ranges = key.ranges || (range ? [range] : []);
  if (
    !isNaN(num) &&
    ranges.some((accepted) => num >= accepted.min && num <= accepted.max)
  ) {
    return { status: "correct", message: `Correct. +${marks}`, marks };
  }
  if (String(user) === String(key.correct)) {
    return { status: "correct", message: `Correct. +${marks}`, marks };
  }
  const acceptedRanges = ranges
    .map((accepted) => `${accepted.min} – ${accepted.max}`)
    .join(" or ");
  return {
    status: "wrong",
    message: `Incorrect. Accepted range: ${acceptedRanges}`,
    marks: 0,
  };
}

function submitExam() {
  if (state.timerId) clearInterval(state.timerId);
  let total = 0, max = 0, correct = 0, wrong = 0, unattempted = 0;
  state.questions.forEach((q) => {
    max += q.marks;
    const r = evaluateOne(String(q.id));
    total += r.marks;
    if (r.status === "correct") correct++;
    else if (r.status === "wrong") wrong++;
    else unattempted++;
  });
  const displayScore = Math.round(total * 100) / 100;
  document.getElementById("results-body").innerHTML = `
    <div class="score">${displayScore} <small style="font-size:1rem;color:var(--muted)">/ ${max}</small></div>
    <p style="margin-top:1rem">
      Correct: <strong style="color:var(--success)">${correct}</strong><br>
      Incorrect: <strong style="color:var(--danger)">${wrong}</strong><br>
      Unattempted: <strong>${unattempted}</strong>
    </p>
    <p style="margin-top:0.5rem;color:var(--muted);font-size:0.85rem">
      Mode: ${state.mode === "practice" ? "Practice" : "Exam"}
    </p>`;
  document.getElementById("results-modal").classList.remove("hidden");
  state.reviewMode = true;
  renderQuestion();
}

function bindEvents() {
  document.getElementById("btn-prev").addEventListener("click", prev);
  document.getElementById("btn-next").addEventListener("click", next);
  document.getElementById("btn-clear").addEventListener("click", () => {
    const qid = String(state.questions[state.current].id);
    delete state.userAnswers[qid];
    state.checkedAnswers.delete(qid);
    renderQuestion();
    updatePalette();
    persist();
  });
  document.getElementById("btn-mark").addEventListener("click", () => {
    const qid = String(state.questions[state.current].id);
    if (state.marked.has(qid)) state.marked.delete(qid);
    else state.marked.add(qid);
    updatePalette();
    persist();
  });
  document.getElementById("btn-submit").addEventListener("click", () => {
    const msg =
      state.mode === "practice"
        ? "Finish practice and see summary?"
        : "Submit the exam? You will not be able to change answers.";
    if (confirm(msg)) submitExam();
  });
  document.getElementById("btn-check-answer").addEventListener("click", () => {
    const qid = String(state.questions[state.current].id);
    if (!hasUserAnswer(qid)) return;
    state.checkedAnswers.add(qid);
    renderQuestion();
  });
  document.getElementById("btn-review").addEventListener("click", () => {
    document.getElementById("results-modal").classList.add("hidden");
    state.current = 0;
    renderQuestion();
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    localStorage.removeItem(storageKey());
    location.reload();
  });
  document.getElementById("btn-palette").addEventListener("click", () => {
    const palette = document.getElementById("palette-panel");
    if (window.matchMedia("(max-width: 900px)").matches) {
      palette.classList.toggle("open");
    } else {
      document.querySelector(".layout").classList.toggle("palette-closed");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });
}

init();
