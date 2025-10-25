/* ==========================================================
   Подключение данных из Google Sheets (GViz JSON)
   ВАЖНО: в листах должны быть заголовки столбцов:
   ─ "Группы":      ID группы | Название группы | Описание
   ─ "Профессии":   ID | Группа (ID) | Название профессии | Описание | Рекомендации
   Все названия — без лишних пробелов, как здесь.
========================================================== */

/* ---------- Вспомогательное: загрузка листа через GViz ---------- */
async function fetchGviz(sheetName) {
  const SHEET_ID = window.GSHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2)); // убираем "оболочку"
  return json.table; // { cols:[], rows:[] }
}

/* ---------- Преобразование GViz-таблицы в объекты по заголовкам ---------- */
function gvizToObjects(table) {
  const headers = table.cols.map(c => (c?.label || "").trim());
  const rows = table.rows
    .map(r => (r.c || []).map(cell => (cell && cell.v != null ? String(cell.v) : "")))
    .filter(row => row.some(v => v !== "")); // убираем пустые строки

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

/* ---------- Основная функция: отрисовка групп ---------- */
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
      card.dataset.groupId = id;
      card.setAttribute("aria-expanded", "false");

      card.innerHTML = `
        <h3>${title}</h3>
        ${desc ? `<p>${desc}</p>` : ""}
      `;

      /* ---------- Обработчик клика ---------- */
      card.addEventListener("click", async () => {
        const isExpanded = card.classList.contains("expanded");

        // Закрываем все открытые группы
        document.querySelectorAll(".group-card.expanded").forEach((el) => {
          el.classList.remove("expanded");
          const profList = el.querySelector(".prof-list");
          if (profList) profList.remove();
        });

        // Снимаем эффект активности
        wrap.classList.remove("has-active");

        // Если кликаем по новой группе — открываем её
        if (!isExpanded) {
          wrap.classList.add("has-active");
          card.classList.add("expanded");

          const list = document.createElement("div");
          list.className = "prof-list";
          list.innerHTML = `<div class="groups-loader">Загружаем профессии…</div>`;
          card.appendChild(list);

          const all = await getProfessions();
          const items = all.filter(
            (p) => String(p["Группа (ID)"]) === String(card.dataset.groupId)
          );

          const clip = (t, n = 140) =>
            (t || "").length > n ? (t || "").slice(0, n).trim() + "…" : (t || "");

          list.innerHTML = "";
          items.forEach((p, i) => {
            const pid = p["ID"] || "";
            const name = p["Название профессии"] || "Профессия";
            const short = clip(p["Описание"] || "");
            const link = `profession.html?id=${encodeURIComponent(pid)}`;

            const item = document.createElement("div");
            item.className = "prof-card";
            item.style.animation = `fadeInUp 0.4s ease ${i * 0.05}s both`;
            item.innerHTML = `
              <h4>${name}</h4>
              <p>${short}</p>
              <a class="btn" href="${link}">Подробнее</a>
            `;
            list.appendChild(item);
          });

          if (!items.length) {
            list.innerHTML = `<div class="groups-loader" style="opacity:.8">
              Пока нет данных по профессиям этой группы.
            </div>`;
          }

          // Прокручиваем к раскрытой карточке, если она ниже экрана
          const rect = card.getBoundingClientRect();
          if (rect.top < 80 || rect.bottom > window.innerHeight) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      });

      wrap.appendChild(card);
    });
  } catch (e) {
    console.error("Ошибка загрузки групп:", e);
    wrap.innerHTML = `<div class="groups-loader" style="color:#b00020">
      Не удалось загрузить группы. Проверь доступ к таблице и названия листов.
    </div>`;
  }
}

/* ---------- Плавная прокрутка ---------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const t = document.querySelector(this.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- Инициализация ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderGroups();
});

/* ---------- Анимации для карточек профессий ---------- */
const style = document.createElement("style");
style.textContent = `
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);
