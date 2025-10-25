/* ==========================================================
   Google Sheets (GViz JSON)
========================================================== */

async function fetchGviz(sheetName) {
  const SHEET_ID = window.GSHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table;
}

function gvizToObjects(table) {
  const headers = table.cols.map(c => (c?.label || "").trim());
  const rows = table.rows
    .map(r => (r.c || []).map(cell => (cell && cell.v != null ? String(cell.v) : "")))
    .filter(row => row.some(v => v !== ""));
  const maybeHeader = rows[0] || [];
  const sameHeader = maybeHeader.every((v, i) =>
    headers[i] ? v.trim().toLowerCase() === headers[i].trim().toLowerCase() : false
  );
  const data = sameHeader ? rows.slice(1) : rows;

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => (obj[h || `col_${i}`] = row[i] || ""));
    return obj;
  });
}

let professionsCache = null;
let groupsCache = null;

async function getProfessions() {
  if (professionsCache) return professionsCache;
  const table = await fetchGviz(window.SHEET_PROFESSIONS || "Профессии");
  professionsCache = gvizToObjects(table);
  return professionsCache;
}
async function getGroups() {
  if (groupsCache) return groupsCache;
  const table = await fetchGviz(window.SHEET_GROUPS || "Группы");
  groupsCache = gvizToObjects(table).map(g => ({
    id: String(g["ID группы"] || g["ID"] || "").trim(),
    name: (g["Название группы"] || g["Название"] || "").trim(),
    desc: (g["Описание"] || "").trim()
  }));
  return groupsCache;
}

function safe(t) {
  return String(t || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ==========================================================
   Главная: рендер групп
========================================================== */
async function renderGroups() {
  const wrap = document.querySelector(".groups");
  if (!wrap) return;

  wrap.innerHTML = `<div class="groups-loader">Загружаем группы…</div>`;

  try {
    const table = await fetchGviz(window.SHEET_GROUPS || "Группы");
    const groups = gvizToObjects(table);
    wrap.innerHTML = "";

    groups.forEach(g => {
      const id = g["ID группы"] || g["ID"] || "";
      const title = g["Название группы"] || g["Название"] || "Без названия";
      const desc = g["Описание"] || "";

      const card = document.createElement("div");
      card.className = "group-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-expanded", "false");
      card.dataset.groupId = id;

      card.innerHTML = `
        <h3>${safe(title)}</h3>
        ${desc ? `<p>${safe(desc)}</p>` : ""}
      `;

      const toggle = async () => {
        const expanded = card.classList.toggle("expanded");
        card.setAttribute("aria-expanded", expanded ? "true" : "false");

        const exists = card.querySelector(".prof-list");
        if (!expanded && exists) { exists.remove(); return; }

        if (expanded && !exists) {
          const list = document.createElement("div");
          list.className = "prof-list";
          list.innerHTML = `<div class="groups-loader">Загружаем профессии…</div>`;
          card.appendChild(list);

          const all = await getProfessions();
          const items = all.filter(p => String(p["Группа (ID)"]) === String(id));

          const clip = (t, n = 140) => (t || "").length > n ? (t || "").slice(0, n).trim() + "…" : (t || "");

          list.innerHTML = "";
          items.forEach((p, i) => {
            const pid = p["ID"] || "";
            const name = p["Название профессии"] || "Профессия";
            const short = clip(p["Описание"] || p["Краткое описание"] || "");
            const link = `profession.html?id=${encodeURIComponent(pid)}`;

            const item = document.createElement("div");
            item.className = "prof-card";
            item.style.animation = `fadeIn 0.4s ease ${i * 0.05}s both`;
            item.innerHTML = `
              <h4>${safe(name)}</h4>
              ${short ? `<p>${safe(short)}</p>` : `<p>Описание будет добавлено.</p>`}
              <a class="btn" href="${link}">Подробнее</a>
            `;
            list.appendChild(item);
          });

          if (!items.length) {
            list.innerHTML = `<div class="groups-loader" style="opacity:.8">
              Пока нет данных по профессиям этой группы.
            </div>`;
          }

          // Центрируем раскрытую карточку
          setTimeout(() => {
            const rect = card.getBoundingClientRect();
            const scrollY = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
            window.scrollTo({ top: scrollY, behavior: "smooth" });
          }, 300);
        }
      };

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });

      wrap.appendChild(card);
    });
  } catch (e) {
    console.error("Ошибка загрузки групп:", e);
    wrap.innerHTML = `<div class="groups-loader" style="color:#b00020">
      Не удалось загрузить группы. Проверьте доступ к таблице (режим: «читатель»).
    </div>`;
  }
}

/* Плавная прокрутка по якорям */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const t = document.querySelector(this.getAttribute("href"));
    if (t) t.scrollIntoView({ behavior: "smooth" });
  });
});

/* Кнопка «наверх» */
function initToTop() {
  const btn = document.getElementById("toTop");
  if (!btn) return;

  const toggle = () => {
    if (window.scrollY > 300) btn.classList.add("to-top--visible");
    else btn.classList.remove("to-top--visible");
  };
  toggle();

  window.addEventListener("scroll", toggle, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* Инициализация главной */
document.addEventListener("DOMContentLoaded", () => {
  renderGroups();
  initToTop();
});

/* Анимация появления */
const style = document.createElement("style");
style.textContent = `
@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}`;
document.head.appendChild(style);

/* ==========================================================
   Страница профессии (#profession)
========================================================== */
async function loadProfessionPage() {
  const root = document.getElementById("profession");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const profId = params.get("id");
  if (!profId) { root.innerHTML = `<p class="error">Не указана профессия.</p>`; return; }

  try {
    const [allProf, allGroups] = await Promise.all([getProfessions(), getGroups()]);
    const prof = allProf.find(p => String(p["ID"]) === String(profId));
    if (!prof) { root.innerHTML = `<p class="error">Профессия не найдена.</p>`; return; }

    const groupId = String(prof["Группа (ID)"] || "").trim();
    const group = allGroups.find(g => g.id === groupId);
    const groupName = group ? group.name : "Группа не найдена";

    const title = safe(prof["Название профессии"]);
    const short = safe(prof["Описание"]);
    const about = safe(prof["Общее описание"]);
    const roles = safe(prof["Примеры ролей и трудовых функций"]);
    const skills = safe(prof["Ключевые компетенции / навыки"]);
    const recs  = safe(prof["Рекомендации"]);

    root.innerHTML = `
      <main class="profession-page">
        <article class="profession-card glass" id="prof-card">
          <header class="prof-header">
            <h1 class="prof-title">${title}</h1>
            <div class="prof-group">
              <span class="group-chip">Группа:</span>
              <span class="group-name">${safe(groupName)}</span>
            </div>
            ${short ? `<p class="prof-short">${short}</p>` : ``}
          </header>

          <section class="prof-section">
            <h2>Общее описание</h2>
            <p>${about || "—"}</p>
          </section>

          <section class="prof-section">
            <h2>Примеры ролей и трудовых функций</h2>
            <p>${roles || "—"}</p>
          </section>

          <section class="prof-section">
            <h2>Ключевые компетенции / навыки</h2>
            <p>${skills || "—"}</p>
          </section>

          ${recs ? `
          <aside class="prof-recommend">
            <div class="rec-title">Рекомендации</div>
            <div class="rec-body">${recs}</div>
          </aside>` : ``}

          <div class="prof-nav">
            <a class="btn" href="index.html#groups">← К списку групп</a>
          </div>
        </article>
      </main>
    `;

    const card = document.getElementById("prof-card");
    card.classList.add("appear");
    setTimeout(() => card.classList.remove("appear"), 600);
    setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "start" }), 120);

  } catch (err) {
    console.error(err);
    root.innerHTML = `<p class="error">Ошибка загрузки данных. Проверьте доступ к таблице.</p>`;
  }
}
