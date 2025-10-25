/* -------------------------------
   Загрузка данных из Google Sheets
   Автор: вы :) Комментарии — чтобы было легко редактировать
----------------------------------*/

/**
 * Сервисная функция: забрать данные GViz JSON с заданного листа
 * @param {string} sheetName - название листа (например, "Группы")
 * @returns {Promise<{cols:[], rows:[]}>}
 */
async function fetchGviz(sheetName) {
  // Берём ID и имена листов из window (см. конфиг в index.html)
  const SHEET_ID = window.GSHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
    sheetName
  )}`;

  const res = await fetch(url, { cache: "no-store" }); // no-store, чтобы не цеплялся кэш
  const text = await res.text();

  // GViz возвращает "обёртку": нужно отрезать префикс/суффикс
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table; // у таблицы поля: cols, rows
}

/**
 * Преобразование GViz-таблицы в массив объектов по заголовкам
 * Ожидаем, что первая строка — заголовки: "ID группы", "Название группы", "Описание"
 */
function gvizToObjects(table) {
  // заголовки столбцов
  const headers = table.cols.map((c) => (c && c.label ? c.label.trim() : ""));

  // строки данных
  const data = table.rows
    .map((r) =>
      (r.c || []).map((cell) =>
        cell && cell.v !== undefined && cell.v !== null ? String(cell.v) : ""
      )
    )
    .filter((row) => row.some((v) => v !== "")); // отбрасываем полностью пустые строки

  // если первая строка — заголовки, уберём её
  const looksLikeHeader =
    data.length &&
    data[0].every((v, i) => v.toLowerCase().includes(headers[i].toLowerCase().slice(0, 3)));
  const rows = looksLikeHeader ? data.slice(1) : data;

  // собираем объекты по именам столбцов
  return rows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h || `col_${i}`] = row[i] || "";
    });
    return obj;
  });
}

/**
 * Отрисовка карточек групп на главной странице
 * Требуемые столбцы на листе "Группы":
 * - "ID группы"
 * - "Название группы"
 * - "Описание"
 */
async function renderGroups() {
  const wrap = document.querySelector(".groups");
  if (!wrap) return;

  try {
    // показываем лоадер (если был удалён)
    if (!wrap.querySelector(".groups-loader")) {
      const loader = document.createElement("div");
      loader.className = "groups-loader";
      loader.textContent = "Загружаем группы…";
      wrap.appendChild(loader);
    }

    const table = await fetchGviz(window.SHEET_GROUPS || "Группы");
    const items = gvizToObjects(table);

    // очищаем контейнер
    wrap.innerHTML = "";

    // формируем карточки
    items.forEach((row) => {
      const id = row["ID группы"] || row["ID"] || "";
      const title = row["Название группы"] || row["Название"] || "Без названия";
      const desc = row["Описание"] || "";

      const card = document.createElement("div");
      card.className = "group-card";
      // сохраняем ID в data-атрибут — пригодится для переходов
      card.dataset.groupId = id;

      card.innerHTML = `
        <h3>${title}</h3>
        ${desc ? `<p>${desc}</p>` : ""}
      `;

      // клик по карточке — дальше можно:
      // 1) переходить на group.html?group=ID
      // 2) или открывать модалку (сделаем позже)
      card.addEventListener("click", () => {
        // Вариант с отдельной страницей групп:
        // location.href = \`group.html?group=${encodeURIComponent(id)}\`;

        // Пока просто подсветим клик — чтобы понять, что работает
        card.style.outline = "2px solid rgba(0,76,153,.4)";
        setTimeout(() => (card.style.outline = "none"), 300);
      });

      wrap.appendChild(card);
    });
  } catch (e) {
    console.error("Ошибка загрузки групп:", e);
    const err = document.createElement("div");
    err.className = "groups-loader";
    err.style.color = "#b00020";
    err.textContent =
      "Не удалось загрузить группы. Проверьте доступ к таблице (Доступ по ссылке: Читатель) и названия листов.";
    wrap.appendChild(err);
  }
}

/* --- Плавная прокрутка по якорям (как было ранее) --- */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});

/* --- Инициализация при загрузке страницы --- */
document.addEventListener("DOMContentLoaded", () => {
  // грузим группы из Google Sheets
  renderGroups();
});

/* ===================================================================
   ЗАГОТОВКА на будущее: как грузить профессии с листа "Профессии"
   Ожидаемые столбцы:
   - "ID"              — уникальный id профессии
   - "Группа (ID)"     — номер группы 1..10 (связь с листом "Группы")
   - "Название профессии"
   - "Описание"
   - "Рекомендации"
======================================================================
async function loadProfessionsByGroup(groupId) {
  const table = await fetchGviz(window.SHEET_PROFESSIONS || "Профессии");
  const all = gvizToObjects(table);
  return all.filter(row => String(row["Группа (ID)"]) === String(groupId));
}
====================================================================== */
