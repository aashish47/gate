async function loadCatalog() {
  const res = await fetch("exams/catalog.json");
  const data = await res.json();
  const list = document.getElementById("exam-list");
  const statsBar = document.getElementById("stats-bar");
  list.innerHTML = "";

  const exams = data.exams || [];

  if (exams.length === 0) {
    list.innerHTML = `<p class="muted">No exams found. Add a folder under <code>exams/</code> and register it in <code>catalog.json</code>.</p>`;
    statsBar.innerHTML = "";
    return;
  }

  const totalQ = exams.reduce((s, e) => s + (e.total_questions || 0), 0);
  const totalM = exams.reduce((s, e) => s + (e.total_marks || 0), 0);
  statsBar.innerHTML = `
    <div class="stat-pill"><strong>${exams.length}</strong> exam${exams.length > 1 ? "s" : ""}</div>
    <div class="stat-pill"><strong>${totalQ}</strong> questions</div>
    <div class="stat-pill"><strong>${totalM}</strong> total marks</div>
  `;

  exams.forEach((exam) => {
    const card = document.createElement("article");
    card.className = "exam-card";

    const year = exam.year ? `<span class="exam-year">${exam.year}</span>` : "";

    card.innerHTML = `
      <div class="exam-card-header">
        <h2>${escapeHtml(exam.title)}</h2>
        ${year}
      </div>
      <p class="sub">${escapeHtml(exam.subtitle || "")}</p>
      <div class="meta">
        <span>${exam.total_questions} questions</span>
        <span>${exam.total_marks} marks</span>
        <span>${exam.duration_minutes} min</span>
        ${exam.organizer ? `<span>${escapeHtml(exam.organizer)}</span>` : ""}
      </div>
      <div class="mode-actions">
        <button class="btn mode-btn exam-mode" data-mode="exam" type="button">
          <span class="mode-title">Exam mode</span>
          <span class="mode-desc">Timed · no instant feedback</span>
        </button>
        <button class="btn mode-btn practice-mode" data-mode="practice" type="button">
          <span class="mode-title">Practice mode</span>
          <span class="mode-desc">No timer · instant feedback</span>
        </button>
      </div>
    `;

    card.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        window.location.href = `exam.html?id=${encodeURIComponent(exam.id)}&mode=${mode}`;
      });
    });

    list.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

loadCatalog();
