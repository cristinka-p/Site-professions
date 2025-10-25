/* ==========================================================
   Подключение данных из Google Sheets (GViz JSON)
   ВАЖНО: в листах должны быть заголовки столбцов:
   ─ "Группы":      ID группы | Название группы | Описание
   ─ "Профессии":   ID | Группа (ID) | Название профессии | Описание | Рекомендации
   Все названия — без лишних пробелов, как здесь.
   Комментарии подробные, чтобы тебе было легко править код.
========================================================== */

/* ---------- Вспомогательное: загрузка листа через GViz ---------- */
async function fetchGviz(sheetName) {
  const SHEET_ID = window.GSHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2)); // “снимаем оболочку” GViz
  return json.table; // { cols:[], rows:[] }
}

/* ---------- Преобразование GViz-таблицы в объекты по заголовкам ---------- */
function gvizToObjects(table) {
  const headers = table.cols.map(c => (c?.label || "").trim());
  const rows = table.rows
    .map(r => (r.c || []).map(cell => (cell && cell.v != null ? String(cell.v) : "")))
    .filter(row => row.some(v => v !== "")); // убрать пустые строки

  // если первая строка совпадает с заголовками — считаем её хедером и убираем
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

/* ---------- Кэш для профессий, чтобы не грузить каждый клик ---------- */
let professionsCache = null;
async function getProfessions() {
  if (professionsCache) return professionsCache;
  const table = await fetchGviz(window.SHEET_PROFESSIONS || "Профессии");
  professionsCache = gvizToObjects(table);
  return professionsCache;
}

/* ---------- Рендер групп на главной ---------- */
async function renderGroups() {
  const wrap = document.querySelector(".groups");
  if (!wrap) return;

  // показать лоадер
  wrap.innerHTML = `<div class="groups-loader">Загружаем группы…</div>`;

  try {
    const table = await fetchGviz(window.SHEET_GROUPS || "Группы");
    const groups = gvizToObjects(table);
    wrap.innerHTML = ""; // очистить

    groups.forEach(g => {
      const id = g["ID группы"] || g["ID"] || "";
      const title = g["Название группы"] || g["Название"] || "Без названия";
      const desc = g["Описание"] || "";

      // Карточка группы
      const card = document.createElement("div");
      card.className = "group-card";
      card.tabIndex = 0; // доступность с клавиатуры
      card.setAttribute("role", "button");
      card.setAttribute("aria-expanded", "false");
      card.dataset.groupId = id;

      card.innerHTML = `
        <h3>${title}</h3>
        ${desc ? `<p>${desc}</p>` : ""}
      `;

      // Обработчик клика/Enter — раскрыть/свернуть
      const toggle = async () => {
        const expanded = card.classList.toggle("expanded");
        card.setAttribute("aria-expanded", expanded ? "true" : "false");

        // если свернули — убрать список профессий
        const exists = card.querySelector(".prof-list");
        if (!expanded && exists) {
          exists.remove();
          return;
        }

        // если раскрыли — подгрузить профессии по группе
        if (expanded && !exists) {
          const list = document.createElement("div");
          list.className = "prof-list";
          list.innerHTML = `<div class="groups-loader">Загружаем профессии…</div>`;
          card.appendChild(list);

          const all = await getProfessions();
          const items = all.filter(p => String(p["Группа (ID)"]) === String(id));

          // Превью: ограничим текст до ~140 символов
          const clip = (t, n = 140) =>
            (t || "").length > n ? (t || "").slice(0, n).trim() + "…" : (t || "");

          list.innerHTML = "";
          items.forEach(p => {
            const pid = p["ID"] || "";
            const name = p["Название профессии"] || "Профессия";
            const short = clip(p["Описание"] || p["Краткое описание"] || "");
            const link = `profession.html?id=${encodeURIComponent(pid)}`; // на будущее: отдельная страница

            const item = document.createElement("div");
            item.className = "prof-card";
            item.innerHTML = `
              <h4>${name}</h4>
              ${short ? `<p>${short}</p>` : `<p>Описание будет добавлено.</p>`}
              <a class="btn" href="${link}">Подробнее</a>
            `;
            list.appendChild(item);
          });

          // Если в таблице пока нет строк для этой группы
          if (!items.length) {
            list.innerHTML = `<div class="groups-loader" style="opacity:.8">Пока нет данных по профессиям этой группы.</div>`;
          }
        }
      };

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });

      wrap.appendChild(card);
    });
  } catch (e) {
    console.error("Ошибка загрузки групп:", e);
    wrap.innerHTML = `<div class="groups-loader" style="color:#b00020">
      Не удалось загрузить группы. Проверьте доступ к таблице (Доступ по ссылке: Читатель) и названия листов.
    </div>`;
  }
}

/* ---------- Плавная прокрутка по якорям (как было) ---------- */
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
