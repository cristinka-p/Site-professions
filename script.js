/* ==========================================================
   Подключение данных из Google Sheets (GViz JSON)
   ВАЖНО: в листах должны быть заголовки столбцов:
   ─ "Группы":      ID группы | Название группы | Описание
   ─ "Профессии":   ID | Группа (ID) | Название профессии | Описание | Рекомендации
   ========================================================= */

/* ---------- Вспомогательное: загрузка листа через GViz ---------- */
async function fetchGviz(sheetName) {
  const SHEET_ID = window.GSHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2)); // убираем "оболочку"
  return json.table;
}

/* ---------- Преобразование GViz-таблицы в объекты ---------- */
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

/* ---------- Кэш для профессий ---------- */
let professionsCache = null;
async function getProfessions() {
  if (professionsCache) return professionsCache;
  const table = await fetchGviz(window.SHEET_PROFESSIONS || "Профессии");
  professionsCache = gvizToObjects(table);
  return professionsCache;
}

/* ---------- Отрисовка групп ---------- */
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
        <h3>${title}</h3>
        ${desc ? `<p>${desc}</p>` : ""}
      `;

      /* ---------- Обработчик клика ---------- */
      const toggle = async () => {
        const expanded = card.classList.toggle("expanded");
        card.setAttribute("aria-expanded", expanded ? "true" : "false");

        // если свернули — удалить блок профессий
        const exists = card.querySelector(".prof-list");
        if (!expanded && exists) {
          exists.remove();
          return;
        }

        // если раскрыли — подгрузить профессии
        if (expanded && !exists) {
          const list = document.createElement("div");
          list.className = "prof-list";
          list.innerHTML = `<div class="groups-loader">Загружаем профессии…</div>`;
          card.appendChild(list);

          const all = await getProfessions();
          const items = all.filter(p => String(p["Группа (ID)"]) === String(id));

          const clip = (t, n = 140) =>
            (t || "").length > n ? (t || "").slice(0, n).trim() + "…" : (t || "");

          list.innerHTML = "";
          items.forEach((p, i) => {
            const pid = p["ID"] || "";
            const name = p["Название профессии"] || "Профессия";
            const short = clip(p["Описание"] || p["Краткое описание"] || "");
            const link = `profession.html?id=${encodeURIComponent(pid)}`;

            const item = document.createElement("div");
            item.className = "prof-card";
            item.style.animation = `fadeIn 0.4s ease ${i * 0.05}s both`; // 👈 плавное появление
            item.innerHTML = `
              <h4>${name}</h4>
              ${short ? `<p>${short}</p>` : `<p>Описание будет добавлено.</p>`}
              <a class="btn" href="${link}">Подробнее</a>
            `;
            list.appendChild(item);
          });

          if (!items.length) {
            list.innerHTML = `<div class="groups-loader" style="opacity:.8">
              Пока нет данных по профессиям этой группы.
            </div>`;
          }

          // 👇 Плавно прокручиваем к раскрытой карточке
          setTimeout(() => {
            const rect = card.getBoundingClientRect();
            const scrollY =
              window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
            window.scrollTo({
              top: scrollY,
              behavior: "smooth",
            });
          }, 300);
        }
      };

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
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

/* ---------- Плавная прокрутка по якорям ---------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const t = document.querySelector(this.getAttribute("href"));
    if (t) t.scrollIntoView({ behavior: "smooth" });
  });
});

/* ---------- Инициализация ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderGroups();
});

/* ---------- CSS-анимация (fade-in) ---------- */
const style = document.createElement("style");
style.textContent = `
@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}`;
document.head.appendChild(style);

/* ---------- Страница профессии ---------- */
async function loadProfessionPage() {
  const container = document.getElementById("profession-content");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const profId = urlParams.get("id");

  if (!profId) {
    container.innerHTML = `<p class="error">Не указана профессия.</p>`;
    return;
  }

  try {
    const all = await getProfessions();
    const prof = all.find(p => String(p["ID"]) === String(profId));

    if (!prof) {
      container.innerHTML = `<p class="error">Профессия не найдена.</p>`;
      return;
    }

    // Контент страницы
    container.innerHTML = `
      <h1>${prof["Название профессии"]}</h1>
      <p class="short-desc">${prof["Описание"] || "Описание отсутствует."}</p>
      ${prof["О профессии"] ? `<div class="about"><h2>О профессии</h2><p>${prof["О профессии"]}</p></div>` : ""}
      ${prof["Рекомендации"] ? `<div class="recommend"><h2>Рекомендации</h2><p>${prof["Рекомендации"]}</p></div>` : ""}
      <a href="index.html" class="btn back-btn">← Назад к списку</a>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error">Ошибка загрузки данных.</p>`;
  }
}
