/* ============================================================
   public/design-editor.js — ShortsCraft Interactive Design Studio
   Canvas Engine, Layer Management, Typography, Shapes & Export
   ============================================================ */
(function () {
  "use strict";

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  var canvas = document.getElementById("designCanvas");
  var ctx = canvas.getContext("2d");
  var stageWrap = document.getElementById("stageWrap");
  var canvasContainer = document.getElementById("canvasContainer");

  var project = {
    id: "dp_" + Math.random().toString(36).slice(2, 10),
    name: "Untitled Thumbnail",
    designType: "youtube-thumbnail",
    canvas: { width: 1280, height: 720 },
    backgroundColor: "#090d16",
    elements: []
  };
  window.SC_STUDIO_PROJECT = project;

  var selectedElement = null;
  var isDragging = false;
  var isTransforming = false;
  var activeHandle = null;
  var dragStart = { x: 0, y: 0 };
  var initialElemState = null;
  var imageCache = {};
  var undoStack = [];
  var redoStack = [];
  var zoomLevel = 1.0;
  var autoSaveTimer = null;

  function init() {
    loadProjectFromUrlOrStorage();
    setupCanvasEvents();
    setupToolbar();
    setupInspector();
    setupKeyboardShortcuts();
    setupWindowResize();
    updateZoom();
    render();
  }

  // ── 1. Load Project ──────────────────────────────────────────
  function loadProjectFromUrlOrStorage() {
    var params = new URLSearchParams(window.location.search);
    var projId = params.get("id");
    var tplId = params.get("tpl");
    var isSession = params.get("session") === "1";

    if (isSession) {
      try {
        var raw = sessionStorage.getItem("sc_pending_design");
        if (raw) {
          var parsed = JSON.parse(raw);
          applyProjectData(parsed);
          sessionStorage.removeItem("sc_pending_design");
          return;
        }
      } catch (e) {}
    }

    if (projId) {
      fetch("/api/designs/projects/" + encodeURIComponent(projId))
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.success && res.project) {
            applyProjectData(res.project);
          }
        })
        .catch(function () {});
      return;
    }

    if (tplId) {
      fetch("/api/designs/templates/" + encodeURIComponent(tplId))
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.success && res.template) {
            applyProjectData(res.template);
          }
        })
        .catch(function () {});
      return;
    }

    // Default starter template if empty
    if (!project.elements.length) {
      project.elements = [
        { id: "bg", name: "Dark Backdrop", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1280, height: 720, fill: "#090d16", zIndex: 0, locked: true },
        { id: "txt_1", name: "Main Headline", type: "text", text: "VIRAL THUMBNAIL", x: 100, y: 220, fontSize: 96, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", stroke: "#000000", strokeWidth: 4, zIndex: 1 },
        { id: "txt_2", name: "Sub-Hook", type: "text", text: "IN UNDER 60 SECONDS", x: 104, y: 340, fontSize: 44, fontWeight: 800, fontFamily: "Space Grotesk", fill: "#38bdf8", zIndex: 2 }
      ];
      recordState();
    }
  }

  function applyProjectData(data) {
    if (data.id) project.id = data.id;
    if (data.name || data.title) {
      project.name = data.name || data.title;
      var titleInp = $("#projTitleInput");
      if (titleInp) titleInp.value = project.name;
    }
    if (data.canvas) {
      project.canvas = data.canvas;
      canvas.width = project.canvas.width;
      canvas.height = project.canvas.height;
    }
    if (Array.isArray(data.elements)) {
      project.elements = data.elements;
      // Preload images
      project.elements.forEach(function (el) {
        if (el.type === "image" && el.src) preloadImage(el.src);
      });
    }
    recordState();
    updateLayersList();
    render();
    updateZoom();
  }

  function preloadImage(src) {
    if (imageCache[src]) return;
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      imageCache[src] = img;
      render();
    };
    img.src = src;
  }

  // ── 2. Canvas Rendering Engine ───────────────────────────────
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Canvas Background
    ctx.fillStyle = project.backgroundColor || "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Sort elements by zIndex
    var sorted = project.elements.slice().sort(function (a, b) {
      return (a.zIndex || 0) - (b.zIndex || 0);
    });

    // 3. Render each element
    sorted.forEach(function (el) {
      if (el.hidden) return;
      ctx.save();

      // Apply opacity
      var opacity = typeof el.opacity === "number" ? el.opacity : 1.0;
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

      // Apply rotation around element center
      var cx = el.x + el.width / 2;
      var cy = el.y + el.height / 2;
      if (el.rotation) {
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }

      if (el.type === "shape") {
        renderShape(el);
      } else if (el.type === "image") {
        renderImage(el);
      } else if (el.type === "text") {
        renderText(el);
      }

      ctx.restore();
    });

    // 4. Render Selection & Transform Handles
    if (selectedElement && !selectedElement.locked && !selectedElement.hidden) {
      renderSelection(selectedElement);
    }
  }

  function renderShape(el) {
    ctx.fillStyle = el.fill || "#f59e0b";
    ctx.strokeStyle = el.stroke || "transparent";
    ctx.lineWidth = el.strokeWidth || 0;

    var r = el.radius || 0;
    if (el.shape === "circle") {
      ctx.beginPath();
      ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (el.strokeWidth) ctx.stroke();
    } else if (el.shape === "roundedRectangle" || el.shape === "pill") {
      var radius = el.shape === "pill" ? el.height / 2 : r;
      drawRoundedRect(ctx, el.x, el.y, el.width, el.height, radius);
      ctx.fill();
      if (el.strokeWidth) ctx.stroke();
    } else if (el.shape === "curvedArrow") {
      drawCurvedArrow(ctx, el.x, el.y, el.width, el.height, el.fill || "#f59e0b");
    } else {
      ctx.fillRect(el.x, el.y, el.width, el.height);
      if (el.strokeWidth) ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
  }

  function drawRoundedRect(c, x, y, w, h, radius) {
    var rad = Math.min(radius, Math.min(w, h) / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }

  function drawCurvedArrow(c, x, y, w, h, color) {
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = Math.max(6, Math.round(w * 0.08));
    c.lineCap = "round";

    c.beginPath();
    c.moveTo(x, y + h);
    c.quadraticCurveTo(x + w * 0.1, y + h * 0.1, x + w * 0.8, y + h * 0.2);
    c.stroke();

    // Arrowhead
    var headLen = Math.max(16, Math.round(w * 0.2));
    var endX = x + w * 0.8;
    var endY = y + h * 0.2;
    var angle = Math.atan2(h * 0.1, w * 0.7);

    c.beginPath();
    c.moveTo(endX, endY);
    c.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
    c.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
    c.closePath();
    c.fill();
    c.restore();
  }

  function renderImage(el) {
    var img = imageCache[el.src];
    if (img && img.complete) {
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    } else {
      preloadImage(el.src);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }
  }

  function renderText(el) {
    var fontSize = el.fontSize || 48;
    var fontWeight = el.fontWeight || 800;
    var fontFamily = el.fontFamily || "Anton";

    ctx.font = fontWeight + " " + fontSize + "px '" + fontFamily + "', -apple-system, sans-serif";
    ctx.textBaseline = "top";

    if (el.shadow) {
      ctx.shadowColor = el.shadow.color || "rgba(0,0,0,0.8)";
      ctx.shadowBlur = el.shadow.blur || 8;
      ctx.shadowOffsetX = el.shadow.offsetX || 2;
      ctx.shadowOffsetY = el.shadow.offsetY || 4;
    }

    // Support multiline text
    var lines = String(el.text || "").split("\n");
    var lineHeight = fontSize * 1.15;

    lines.forEach(function (line, idx) {
      var lineY = el.y + (idx * lineHeight);
      if (el.stroke && el.strokeWidth) {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeText(line, el.x, lineY);
      }
      ctx.fillStyle = el.fill || "#ffffff";
      ctx.fillText(line, el.x, lineY);
    });

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  function renderSelection(el) {
    ctx.save();
    var cx = el.x + el.width / 2;
    var cy = el.y + el.height / 2;
    if (el.rotation) {
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(el.x - 2, el.y - 2, el.width + 4, el.height + 4);
    ctx.setLineDash([]);

    // Draw 8 Resize Handles
    var handles = getHandles(el);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;

    for (var k in handles) {
      var h = handles[k];
      ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
      ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
    }

    ctx.restore();
  }

  function getHandles(el) {
    return {
      nw: { x: el.x, y: el.y },
      n:  { x: el.x + el.width / 2, y: el.y },
      ne: { x: el.x + el.width, y: el.y },
      e:  { x: el.x + el.width, y: el.y + el.height / 2 },
      se: { x: el.x + el.width, y: el.y + el.height },
      s:  { x: el.x + el.width / 2, y: el.y + el.height },
      sw: { x: el.x, y: el.y + el.height },
      w:  { x: el.x, y: el.y + el.height / 2 }
    };
  }

  // ── 3. Canvas Interaction (Drag, Scale, Rotate) ──────────────
  function getCanvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    var clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function setupCanvasEvents() {
    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("touchstart", onPointerDown, { passive: false });

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("touchmove", onPointerMove, { passive: false });

    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchend", onPointerUp);

    // Double click to quick edit text
    canvas.addEventListener("dblclick", function (e) {
      var pos = getCanvasCoords(e);
      var hit = hitTest(pos.x, pos.y);
      if (hit && hit.type === "text") {
        var newText = prompt("Edit text:", hit.text);
        if (newText !== null) {
          hit.text = newText;
          recordState();
          updateInspector();
          render();
        }
      }
    });
  }

  function onPointerDown(e) {
    var pos = getCanvasCoords(e);

    // Check if clicked a handle on the selected element
    if (selectedElement && !selectedElement.locked) {
      var handles = getHandles(selectedElement);
      for (var hName in handles) {
        var h = handles[hName];
        if (Math.abs(pos.x - h.x) <= 8 && Math.abs(pos.y - h.y) <= 8) {
          isTransforming = true;
          activeHandle = hName;
          dragStart = pos;
          initialElemState = Object.assign({}, selectedElement);
          if (e.preventDefault) e.preventDefault();
          return;
        }
      }
    }

    // Hit test elements (top to bottom)
    var hit = hitTest(pos.x, pos.y);
    if (hit) {
      selectedElement = hit;
      isDragging = true;
      dragStart = pos;
      initialElemState = Object.assign({}, hit);
    } else {
      selectedElement = null;
    }

    updateInspector();
    updateLayersList();
    render();
    if (e.preventDefault && hit) e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging && !isTransforming) return;
    var pos = getCanvasCoords(e);
    var dx = pos.x - dragStart.x;
    var dy = pos.y - dragStart.y;

    if (isDragging && selectedElement && !selectedElement.locked) {
      selectedElement.x = Math.round(initialElemState.x + dx);
      selectedElement.y = Math.round(initialElemState.y + dy);
      render();
    } else if (isTransforming && selectedElement && activeHandle) {
      var init = initialElemState;
      if (activeHandle === "se") {
        selectedElement.width = Math.max(20, Math.round(init.width + dx));
        selectedElement.height = Math.max(20, Math.round(init.height + dy));
      } else if (activeHandle === "e") {
        selectedElement.width = Math.max(20, Math.round(init.width + dx));
      } else if (activeHandle === "s") {
        selectedElement.height = Math.max(20, Math.round(init.height + dy));
      } else if (activeHandle === "nw") {
        selectedElement.x = Math.round(init.x + dx);
        selectedElement.y = Math.round(init.y + dy);
        selectedElement.width = Math.max(20, Math.round(init.width - dx));
        selectedElement.height = Math.max(20, Math.round(init.height - dy));
      }
      render();
    }
  }

  function onPointerUp() {
    if (isDragging || isTransforming) {
      recordState();
      triggerAutosave();
    }
    isDragging = false;
    isTransforming = false;
    activeHandle = null;
  }

  function hitTest(x, y) {
    var sorted = project.elements.slice().sort(function (a, b) {
      return (b.zIndex || 0) - (a.zIndex || 0);
    });

    for (var i = 0; i < sorted.length; i++) {
      var el = sorted[i];
      if (el.hidden) continue;
      // Background role is hit only if nothing else hits
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        return el;
      }
    }
    return null;
  }

  // ── 4. Toolbar & Flyout ───────────────────────────────────────
  function setupToolbar() {
    var toolBtns = $$(".de-tool-btn, .de-mob-btn");
    var flyout = $("#deFlyout");

    toolBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.dataset.tab;
        toolBtns.forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tab); });

        $$(".de-flyout-content").forEach(function (fc) { fc.setAttribute("hidden", ""); });
        var target = $("#flyout" + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (target) {
          target.removeAttribute("hidden");
          if (flyout) flyout.removeAttribute("hidden");
        }
      });
    });

    // Add Text actions
    $("#btnAddHeading").onclick = function () { addTextLayer("BOLD HEADLINE", "Anton", 88, 900, "#ffffff"); };
    $("#btnAddSubheading").onclick = function () { addTextLayer("High Retention Hook", "Space Grotesk", 48, 700, "#38bdf8"); };
    $("#btnAddBody").onclick = function () { addTextLayer("Custom editable text line", "Inter", 28, 500, "#cbd5e1"); };

    // Add Shapes actions
    $$("[data-add-shape]").forEach(function (btn) {
      btn.onclick = function () {
        addShapeLayer(btn.dataset.addShape);
      };
    });

    // Canvas Background Color
    var bgCol = $("#canvasBgColor");
    if (bgCol) {
      bgCol.addEventListener("input", function () {
        project.backgroundColor = bgCol.value;
        render();
        triggerAutosave();
      });
    }

    // Add Custom Image Layer
    var imgInput = $("#imageLayerFileInput");
    var uploadLayerBtn = $("#btnUploadImageLayer");
    if (imgInput && uploadLayerBtn) {
      uploadLayerBtn.onclick = function () { imgInput.click(); };
      imgInput.onchange = function () {
        if (imgInput.files && imgInput.files[0]) {
          var file = imgInput.files[0];
          var reader = new FileReader();
          reader.onload = function (e) {
            addImageLayer(e.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // Zoom Selector
    var zoomSel = $("#zoomSelect");
    if (zoomSel) {
      zoomSel.addEventListener("change", function () {
        zoomLevel = zoomSel.value === "fit" ? 1.0 : parseFloat(zoomSel.value);
        updateZoom();
      });
    }
  }

  function updateZoom() {
    var zoomSel = $("#zoomSelect");
    if (zoomSel && zoomSel.value === "fit") {
      var availW = stageWrap.clientWidth - 48;
      var availH = stageWrap.clientHeight - 48;
      var scaleX = availW / project.canvas.width;
      var scaleY = availH / project.canvas.height;
      zoomLevel = Math.min(scaleX, scaleY, 1.0);
    }
    canvasContainer.style.transform = "scale(" + zoomLevel.toFixed(3) + ")";
  }

  function setupWindowResize() {
    window.addEventListener("resize", function () {
      updateZoom();
    });
  }

  function addTextLayer(text, font, size, weight, color) {
    var newZ = project.elements.length ? Math.max.apply(null, project.elements.map(function (e) { return e.zIndex || 0; })) + 1 : 1;
    var el = {
      id: "text_" + Math.random().toString(36).slice(2, 8),
      name: text,
      type: "text",
      text: text,
      x: 120,
      y: 160 + (project.elements.length * 20),
      fontSize: size,
      fontWeight: weight,
      fontFamily: font,
      fill: color,
      stroke: "#000000",
      strokeWidth: 0,
      zIndex: newZ
    };
    project.elements.push(el);
    selectedElement = el;
    recordState();
    updateLayersList();
    updateInspector();
    render();
    triggerAutosave();
  }

  function addShapeLayer(shape) {
    var newZ = project.elements.length ? Math.max.apply(null, project.elements.map(function (e) { return e.zIndex || 0; })) + 1 : 1;
    var el = {
      id: "shape_" + Math.random().toString(36).slice(2, 8),
      name: shape,
      type: "shape",
      shape: shape,
      x: 200,
      y: 200,
      width: shape === "pill" ? 240 : (shape === "circle" ? 200 : 280),
      height: shape === "pill" ? 56 : (shape === "circle" ? 200 : 180),
      fill: "#f59e0b",
      radius: 16,
      zIndex: newZ
    };
    project.elements.push(el);
    selectedElement = el;
    recordState();
    updateLayersList();
    updateInspector();
    render();
    triggerAutosave();
  }

  function addImageLayer(dataUri, name) {
    var newZ = project.elements.length ? Math.max.apply(null, project.elements.map(function (e) { return e.zIndex || 0; })) + 1 : 1;
    var el = {
      id: "img_" + Math.random().toString(36).slice(2, 8),
      name: name || "Sticker",
      type: "image",
      src: dataUri,
      x: 300,
      y: 200,
      width: 320,
      height: 320,
      zIndex: newZ
    };
    project.elements.push(el);
    selectedElement = el;
    preloadImage(dataUri);
    recordState();
    updateLayersList();
    updateInspector();
    render();
    triggerAutosave();
  }

  // ── 5. Inspector & Layer Properties ──────────────────────────
  function setupInspector() {
    var propText = $("#propTextContent");
    var propFont = $("#propFontFamily");
    var propSize = $("#propFontSize");
    var propColor = $("#propTextColor");
    var propStroke = $("#propStrokeColor");
    var propStrokeW = $("#propStrokeWidth");
    var propFill = $("#propShapeFill");
    var propRadius = $("#propShapeRadius");
    var propOpacity = $("#propImageOpacity");

    if (propText) propText.addEventListener("input", function () { if (selectedElement) { selectedElement.text = propText.value; render(); } });
    if (propFont) propFont.addEventListener("change", function () { if (selectedElement) { selectedElement.fontFamily = propFont.value; render(); } });
    if (propSize) propSize.addEventListener("input", function () { if (selectedElement) { selectedElement.fontSize = parseInt(propSize.value, 10); $("#valFontSize").textContent = propSize.value + "px"; render(); } });
    if (propColor) propColor.addEventListener("input", function () { if (selectedElement) { selectedElement.fill = propColor.value; render(); } });
    if (propStroke) propStroke.addEventListener("input", function () { if (selectedElement) { selectedElement.stroke = propStroke.value; render(); } });
    if (propStrokeW) propStrokeW.addEventListener("input", function () { if (selectedElement) { selectedElement.strokeWidth = parseInt(propStrokeW.value, 10); render(); } });
    if (propFill) propFill.addEventListener("input", function () { if (selectedElement) { selectedElement.fill = propFill.value; render(); } });
    if (propRadius) propRadius.addEventListener("input", function () { if (selectedElement) { selectedElement.radius = parseInt(propRadius.value, 10); $("#valShapeRadius").textContent = propRadius.value + "px"; render(); } });
    if (propOpacity) propOpacity.addEventListener("input", function () { if (selectedElement) { selectedElement.opacity = parseInt(propOpacity.value, 10) / 100; $("#valImageOpacity").textContent = propOpacity.value + "%"; render(); } });

    // Layer Arrange Actions
    $("#btnLayerUp").onclick = function () { changeLayerOrder(1); };
    $("#btnLayerDown").onclick = function () { changeLayerOrder(-1); };
    $("#btnDuplicateLayer").onclick = function () { duplicateSelected(); };
    $("#btnDeleteLayer").onclick = function () { deleteSelected(); };

    // Export Action
    $("#btnExport").onclick = function () { exportDesign(); };
    $("#btnPublish").onclick = function () { publishDesignTemplate(); };

    // Project title change
    var titleInp = $("#projTitleInput");
    if (titleInp) {
      titleInp.addEventListener("change", function () {
        project.name = titleInp.value.trim() || "Untitled Design";
        triggerAutosave();
      });
    }

    // Undo & Redo buttons
    $("#btnUndo").onclick = undo;
    $("#btnRedo").onclick = redo;
  }

  function updateInspector() {
    var inspector = $("#deInspector");
    var titleEl = $("#selectedLayerType");
    var secText = $("#secTextProps");
    var secShape = $("#secShapeProps");
    var secImage = $("#secImageProps");
    var secCommon = $("#secCommonProps");

    if (!selectedElement) {
      if (titleEl) titleEl.textContent = "No layer selected";
      secText.setAttribute("hidden", "");
      secShape.setAttribute("hidden", "");
      secImage.setAttribute("hidden", "");
      secCommon.setAttribute("hidden", "");
      return;
    }

    secCommon.removeAttribute("hidden");
    if (titleEl) titleEl.textContent = selectedElement.type.toUpperCase() + ": " + (selectedElement.name || selectedElement.id);

    if (selectedElement.type === "text") {
      secText.removeAttribute("hidden");
      secShape.setAttribute("hidden", "");
      secImage.setAttribute("hidden", "");
      $("#propTextContent").value = selectedElement.text || "";
      $("#propFontFamily").value = selectedElement.fontFamily || "Anton";
      $("#propFontSize").value = selectedElement.fontSize || 72;
      $("#valFontSize").textContent = (selectedElement.fontSize || 72) + "px";
      $("#propTextColor").value = selectedElement.fill || "#ffffff";
    } else if (selectedElement.type === "shape") {
      secText.setAttribute("hidden", "");
      secShape.removeAttribute("hidden");
      secImage.setAttribute("hidden", "");
      $("#propShapeFill").value = selectedElement.fill || "#f59e0b";
      $("#propShapeRadius").value = selectedElement.radius || 12;
      $("#valShapeRadius").textContent = (selectedElement.radius || 12) + "px";
    } else if (selectedElement.type === "image") {
      secText.setAttribute("hidden", "");
      secShape.setAttribute("hidden", "");
      secImage.removeAttribute("hidden");
      var op = typeof selectedElement.opacity === "number" ? Math.round(selectedElement.opacity * 100) : 100;
      $("#propImageOpacity").value = op;
      $("#valImageOpacity").textContent = op + "%";
    }
  }

  function changeLayerOrder(delta) {
    if (!selectedElement) return;
    selectedElement.zIndex = (selectedElement.zIndex || 0) + delta;
    recordState();
    updateLayersList();
    render();
    triggerAutosave();
  }

  function duplicateSelected() {
    if (!selectedElement) return;
    var clone = JSON.parse(JSON.stringify(selectedElement));
    clone.id = clone.type + "_" + Math.random().toString(36).slice(2, 8);
    clone.name = (clone.name || clone.id) + " (Copy)";
    clone.x += 24;
    clone.y += 24;
    clone.zIndex = (clone.zIndex || 0) + 1;
    project.elements.push(clone);
    selectedElement = clone;
    recordState();
    updateLayersList();
    updateInspector();
    render();
    triggerAutosave();
  }

  function deleteSelected() {
    if (!selectedElement || selectedElement.locked) return;
    var idx = project.elements.indexOf(selectedElement);
    if (idx !== -1) {
      project.elements.splice(idx, 1);
      selectedElement = null;
      recordState();
      updateLayersList();
      updateInspector();
      render();
      triggerAutosave();
    }
  }

  // ── 6. Layers List ───────────────────────────────────────────
  function updateLayersList() {
    var list = $("#layersList");
    if (!list) return;
    list.innerHTML = "";

    var countEl = $("#layerCountTag");
    if (countEl) countEl.textContent = project.elements.length + " layers";

    var sorted = project.elements.slice().sort(function (a, b) {
      return (b.zIndex || 0) - (a.zIndex || 0);
    });

    sorted.forEach(function (el) {
      var item = document.createElement("div");
      item.className = "de-layer-item" + (selectedElement === el ? " active" : "");

      var typeIcon = "📄";
      if (el.type === "text") typeIcon = "T";
      else if (el.type === "image") typeIcon = "🖼";
      else if (el.type === "shape") typeIcon = "⬡";

      item.innerHTML = [
        '<span style="font-weight:700;font-size:11px;color:var(--de-ink3);">' + typeIcon + '</span>',
        '<span class="de-layer-name">' + escapeHtml(el.name || el.text || el.id) + '</span>',
        '<div class="de-layer-actions">',
        '  <button type="button" class="de-layer-ico-btn btn-vis" title="Toggle visibility">' + (el.hidden ? '🙈' : '👁') + '</button>',
        '  <button type="button" class="de-layer-ico-btn btn-lock" title="Lock layer">' + (el.locked ? '🔒' : '🔓') + '</button>',
        '</div>'
      ].join("");

      item.addEventListener("click", function () {
        selectedElement = el;
        updateInspector();
        updateLayersList();
        render();
      });

      var visBtn = item.querySelector(".btn-vis");
      if (visBtn) {
        visBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          el.hidden = !el.hidden;
          render();
          updateLayersList();
        });
      }

      var lockBtn = item.querySelector(".btn-lock");
      if (lockBtn) {
        lockBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          el.locked = !el.locked;
          render();
          updateLayersList();
        });
      }

      list.appendChild(item);
    });
  }

  // ── 7. History (Undo / Redo) ─────────────────────────────────
  function recordState() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > 30) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (undoStack.length <= 1) return;
    redoStack.push(undoStack.pop());
    var prev = JSON.parse(undoStack[undoStack.length - 1]);
    project = prev;
    selectedElement = null;
    updateLayersList();
    updateInspector();
    render();
    updateUndoRedoButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    var next = JSON.parse(redoStack.pop());
    undoStack.push(JSON.stringify(next));
    project = next;
    selectedElement = null;
    updateLayersList();
    updateInspector();
    render();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    var uBtn = $("#btnUndo");
    var rBtn = $("#btnRedo");
    if (uBtn) uBtn.disabled = undoStack.length <= 1;
    if (rBtn) rBtn.disabled = !redoStack.length;
  }

  function setupKeyboardShortcuts() {
    window.addEventListener("keydown", function (e) {
      if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    });
  }

  // ── 8. Autosave & Cloud Sync ─────────────────────────────────
  function triggerAutosave() {
    clearTimeout(autoSaveTimer);
    var statusEl = $("#saveStatus");
    if (statusEl) statusEl.textContent = "Saving...";

    autoSaveTimer = setTimeout(function () {
      fetch("/api/designs/projects/" + encodeURIComponent(project.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project)
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (statusEl) statusEl.textContent = "Saved to cloud";
        })
        .catch(function () {
          if (statusEl) statusEl.textContent = "Saved locally";
        });
    }, 1200);
  }

  // ── 9. Export & Publishing ───────────────────────────────────
  function exportDesign() {
    selectedElement = null;
    render();

    var link = document.createElement("a");
    link.download = (project.name || "design").replace(/[^a-z0-9_-]/gi, "_").toLowerCase() + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function publishDesignTemplate() {
    var title = prompt("Publish template name:", project.name);
    if (!title) return;

    var previewData = canvas.toDataURL("image/webp", 0.85);

    fetch("/api/designs/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        description: "Community design template on ShortsCraft",
        designType: project.designType || "youtube-thumbnail",
        canvas: project.canvas,
        elements: project.elements,
        previewUrl: previewData,
        isAiConverted: (project.source && project.source.type === "ai-converted")
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success) {
          alert("🎉 Design template published successfully to the community gallery!");
        } else {
          alert((res && res.error) || "Could not publish template.");
        }
      })
      .catch(function (err) {
        alert("Failed to publish: " + err.message);
      });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
