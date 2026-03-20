// js/map/layers_ui.js
export function initLayersUI({
  map,
  baseLayers = {},
  overlays = {},
  onMyLocation = null,
  legendHTML = ""
} = {}) {
  if (!map) return null;

  const lc = L.control.layers(baseLayers, overlays, { collapsed: true }).addTo(map);

  const MyLoc = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const btn = L.DomUtil.create("button", "tm-map-btn");
      btn.type = "button";
      btn.innerHTML = `📍`;
      btn.title = "Mostrar mi ubicación";
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, "click", (e) => {
        L.DomEvent.stop(e);
        if (typeof onMyLocation === "function") onMyLocation();
      });
      return btn;
    }
  });

  const myLocCtrl = new MyLoc();
  myLocCtrl.addTo(map);

  function updateOverlays(newOverlays = {}) {
    Object.keys(overlays).forEach(name => {
      try { lc.removeLayer(overlays[name]); } catch {}
    });

    overlays = { ...newOverlays };

    Object.keys(overlays).forEach(name => {
      try { lc.addOverlay(overlays[name], name); } catch {}
    });
  }

  return { layersControl: lc, updateOverlays };
}