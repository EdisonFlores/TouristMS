// js/ui/ui.js
export function renderUI(list, onSelect, onNearest, onMode) {
  const extra = document.getElementById("extra-controls");

  extra.innerHTML = `
    <select id="place-select" class="form-select mb-2">
      <option value="">📍 Lugar</option>
      ${list.map((p, i) => `<option value="${i}">${p.nombre}</option>`).join("")}
    </select>

    <button class="btn btn-sm btn-primary mb-2" id="btn-near">📌 Más cercano</button>

    <div class="d-flex gap-2">
      <button data-mode="walking">🚶</button>
      <button data-mode="bicycle">🚲</button>
      <button data-mode="motorcycle">🏍️</button>
      <button data-mode="driving">🚗</button>
    </div>
  `;

  document.getElementById("place-select").onchange = e => {
    if (e.target.value !== "") onSelect(list[e.target.value]);
  };

  document.getElementById("btn-near").onclick = onNearest;

  document.querySelectorAll("[data-mode]").forEach(b =>
    b.onclick = () => onMode(b.dataset.mode)
  );
}