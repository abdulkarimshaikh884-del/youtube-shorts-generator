/* ============================================================
   public/designs.js — ShortsCraft Designs Hub & Convert to Editable UI
   ============================================================ */
(function () {
  "use strict";

  var currentCategory = "all";
  var uploadModal = null;
  var currentJob = null;
  var currentProject = null;
  var originalDataUri = null;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function init() {
    loadTemplates(currentCategory);
    setupFilters();
    setupUploadModal();
  }

  // ── 1. Load & Render Templates ──────────────────────────────
  function loadTemplates(category) {
    var grid = $("#designsGrid");
    if (!grid) return;
    grid.innerHTML = '<div class="ds-loading"><div class="ds-spinner"></div><p>Loading design templates...</p></div>';

    fetch("/api/designs/templates" + (category && category !== "all" ? "?category=" + encodeURIComponent(category) : ""))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.success || !res.templates || !res.templates.length) {
          grid.innerHTML = '<div class="ds-empty"><h3>No design templates found</h3><p>Upload a design or thumbnail to create the first editable template!</p></div>';
          return;
        }
        renderTemplates(res.templates);
      })
      .catch(function (err) {
        grid.innerHTML = '<div class="ds-empty"><h3>Could not load templates</h3><p>Please refresh the page to try again.</p></div>';
      });
  }

  function renderTemplates(templates) {
    var grid = $("#designsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    templates.forEach(function (tpl) {
      var card = document.createElement("article");
      card.className = "ds-card";

      // Badge label
      var badgeClass = "badge-editable";
      var badgeLabel = "✏ Fully Editable";
      if (tpl.sourceType === "creator_ai_converted") {
        badgeClass = "badge-ai";
        badgeLabel = "✨ AI Editable";
      } else if (tpl.sourceType === "image") {
        badgeClass = "badge-image";
        badgeLabel = "🖼 Image";
      }

      var aspectLabel = "16:9 Thumbnail";
      if (tpl.designType === "logo") aspectLabel = "1:1 Logo";
      else if (tpl.designType === "poster") aspectLabel = "9:16 Poster";
      else if (tpl.designType === "social-post") aspectLabel = "1:1 Post";

      // Build simulated canvas preview
      var previewHtml = buildCardPreview(tpl);

      card.innerHTML = [
        '<div class="ds-card-thumb">',
        previewHtml,
        '  <span class="ds-badge ' + badgeClass + '">' + badgeLabel + '</span>',
        '  <button type="button" class="ds-card-like" data-id="' + tpl.id + '" title="Like design">',
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        '    <span>' + (tpl.likes > 0 ? tpl.likes : "") + '</span>',
        '  </button>',
        '</div>',
        '<div class="ds-card-body">',
        '  <div class="ds-card-meta">',
        '    <span class="ds-card-cat">' + aspectLabel + '</span>',
        '    <span class="ds-card-author">by ' + escapeHtml(tpl.authorName) + '</span>',
        '  </div>',
        '  <h3 class="ds-card-title">' + escapeHtml(tpl.title) + '</h3>',
        '  <p class="ds-card-desc">' + escapeHtml(tpl.description || "Custom editable design template") + '</p>',
        '  <div class="ds-card-actions">',
        '    <button type="button" class="ds-btn-edit" data-tpl-id="' + tpl.id + '">✦ Edit Template →</button>',
        '  </div>',
        '</div>'
      ].join("");

      // Wire edit button (clones template and launches studio)
      var editBtn = card.querySelector(".ds-btn-edit");
      if (editBtn) {
        editBtn.addEventListener("click", function () {
          useTemplate(tpl.id, editBtn);
        });
      }

      // Wire like toggle
      var likeBtn = card.querySelector(".ds-card-like");
      if (likeBtn) {
        likeBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          likeBtn.classList.toggle("liked");
          var sp = likeBtn.querySelector("span");
          var count = parseInt(sp.textContent || "0", 10);
          if (likeBtn.classList.contains("liked")) {
            sp.textContent = String(count + 1);
          } else {
            sp.textContent = count > 1 ? String(count - 1) : "";
          }
        });
      }

      grid.appendChild(card);
    });
  }

  function buildCardPreview(tpl) {
    var cWidth = tpl.canvas ? tpl.canvas.width : 1280;
    var cHeight = tpl.canvas ? tpl.canvas.height : 720;
    var aspectPct = ((cHeight / cWidth) * 100).toFixed(2);

    var elementsHtml = "";
    (tpl.elements || []).slice(0, 8).forEach(function (el) {
      var leftPct = ((el.x / cWidth) * 100).toFixed(1);
      var topPct = ((el.y / cHeight) * 100).toFixed(1);
      var wPct = ((el.width / cWidth) * 100).toFixed(1);
      var hPct = ((el.height / cHeight) * 100).toFixed(1);

      if (el.type === "image") {
        elementsHtml += '<img class="ds-pv-img" src="' + escapeHtml(el.src) + '" style="left:' + leftPct + '%;top:' + topPct + '%;width:' + wPct + '%;height:' + hPct + '%;z-index:' + (el.zIndex || 0) + ';" alt="" loading="lazy"/>';
      } else if (el.type === "shape") {
        var radius = el.radius ? 'border-radius:' + Math.round(el.radius * 0.3) + 'px;' : '';
        if (el.shape === "circle") radius = 'border-radius:50%;';
        if (el.shape === "pill") radius = 'border-radius:999px;';
        elementsHtml += '<div class="ds-pv-shape" style="left:' + leftPct + '%;top:' + topPct + '%;width:' + wPct + '%;height:' + hPct + '%;background:' + (el.fill || '#f59e0b') + ';' + radius + 'z-index:' + (el.zIndex || 0) + ';"></div>';
      } else if (el.type === "text") {
        var fontSizeScaled = Math.max(10, Math.round((el.fontSize || 36) * 0.32));
        elementsHtml += '<div class="ds-pv-txt" style="left:' + leftPct + '%;top:' + topPct + '%;color:' + (el.fill || '#fff') + ';font-family:' + (el.fontFamily || 'Anton') + ';font-size:' + fontSizeScaled + 'px;font-weight:' + (el.fontWeight || 800) + ';z-index:' + (el.zIndex || 0) + ';">' + escapeHtml(el.text) + '</div>';
      }
    });

    return '<div class="ds-pv-stage" style="padding-top:' + aspectPct + '%;">' + elementsHtml + '</div>';
  }

  function useTemplate(templateId, btn) {
    btn.disabled = true;
    btn.textContent = "Opening...";

    fetch("/api/designs/templates/" + encodeURIComponent(templateId) + "/clone", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success && res.project) {
          window.location.href = "/design-editor?id=" + encodeURIComponent(res.project.id);
        } else if (res && res.error) {
          if (res.error.toLowerCase().indexOf("log in") !== -1) {
            window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
            return;
          }
          alert(res.error);
          btn.disabled = false;
          btn.textContent = "✦ Edit Template →";
        }
      })
      .catch(function () {
        // Fallback: open template directly in editor
        window.location.href = "/design-editor?tpl=" + encodeURIComponent(templateId);
      });
  }

  // ── 2. Filter Bar ────────────────────────────────────────────
  function setupFilters() {
    var bar = $("#designsFilterBar");
    if (!bar) return;

    bar.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest(".sh-chip, .ds-filter-btn");
      if (!btn) return;

      bar.querySelectorAll(".sh-chip, .ds-filter-btn").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
        b.classList.toggle("active", b === btn);
      });

      currentCategory = btn.dataset.cat || "all";
      loadTemplates(currentCategory);
    });
  }

  // ── 3. Upload & Convert to Editable Modal ────────────────────
  function setupUploadModal() {
    var triggerBtns = $$(".js-open-design-upload");
    var modal = $("#designUploadModal");
    if (!modal) return;

    triggerBtns.forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        openModal();
      });
    });

    var closeBtn = $("#closeDesignModal");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", function (ev) {
      if (ev.target === modal) closeModal();
    });

    // File Dropzone
    var dropzone = $("#designDropzone");
    var fileInput = $("#designFileInput");
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) handlePickedFile(fileInput.files[0]);
    });

    dropzone.addEventListener("dragover", function (e) {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", function () {
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handlePickedFile(e.dataTransfer.files[0]);
      }
    });

    // Action buttons in modal
    var btnConvert = $("#btnConvertEditable");
    var btnFlat = $("#btnUseAsImage");

    if (btnConvert) {
      btnConvert.addEventListener("click", function () {
        startConversion(false);
      });
    }
    if (btnFlat) {
      btnFlat.addEventListener("click", function () {
        startConversion(true);
      });
    }

    // Review Layers actions
    var btnOpenEditor = $("#btnOpenEditor");
    var btnConvertAgain = $("#btnConvertAgain");
    var btnCancelReview = $("#btnCancelReview");

    if (btnOpenEditor) {
      btnOpenEditor.addEventListener("click", function () {
        saveAndOpenEditor();
      });
    }
    if (btnConvertAgain) {
      btnConvertAgain.addEventListener("click", function () {
        showStep(1);
      });
    }
    if (btnCancelReview) {
      btnCancelReview.addEventListener("click", closeModal);
    }
  }

  function openModal() {
    fetch("/api/auth/me", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.user) {
          window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
          return;
        }
        var modal = $("#designUploadModal");
        if (!modal) return;
        modal.classList.add("open");
        modal.removeAttribute("hidden");
        document.body.style.overflow = "hidden";
        showStep(1);
      })
      .catch(function () {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
      });
  }

  function closeModal() {
    var modal = $("#designUploadModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    currentJob = null;
    currentProject = null;
    originalDataUri = null;
  }

  function showStep(stepNum) {
    $$(".ds-modal-step").forEach(function (step) {
      step.setAttribute("hidden", "");
    });
    var target = $("#modalStep" + stepNum);
    if (target) target.removeAttribute("hidden");
  }

  function handlePickedFile(file) {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      alert("Please choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("Image must be smaller than 15 MB.");
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      originalDataUri = e.target.result;
      var preview = $("#pickedImagePreview");
      if (preview) preview.src = originalDataUri;
      var nameEl = $("#pickedFileName");
      if (nameEl) nameEl.textContent = file.name;
      var sizeEl = $("#pickedFileSize");
      if (sizeEl) sizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";

      showStep(2); // Step 2: Choose Mode (Convert to Editable vs Use as Image)
    };
    reader.readAsDataURL(file);
  }

  function startConversion(useAsImage) {
    if (!originalDataUri) return;
    showStep(3); // Step 3: Progress screen

    var stages = [
      { pct: 15, msg: "1. Uploading image..." },
      { pct: 35, msg: "2. Analyzing visual layout with AI..." },
      { pct: 55, msg: "3. Detecting text & typography..." },
      { pct: 70, msg: "4. Finding foreground subjects & cutouts..." },
      { pct: 85, msg: "5. Rebuilding clean background (inpainting)..." },
      { pct: 95, msg: "6. Creating editable layers..." },
      { pct: 100, msg: "7. Preparing Design Studio..." }
    ];

    var bar = $("#conversionProgressBar");
    var txt = $("#conversionProgressText");

    var curIdx = 0;
    var interval = setInterval(function () {
      if (curIdx < stages.length - 1) {
        curIdx++;
        if (bar) bar.style.width = stages[curIdx].pct + "%";
        if (txt) txt.textContent = stages[curIdx].msg;
      }
    }, 1200);

    fetch("/api/designs/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: originalDataUri,
        useAsImage: useAsImage,
        designType: "youtube-thumbnail"
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        clearInterval(interval);
        if (bar) bar.style.width = "100%";
        if (txt) txt.textContent = "Conversion complete!";

        if (!res || !res.success || !res.project) {
          throw new Error((res && res.error) || "Could not convert this design.");
        }

        currentJob = res;
        currentProject = res.project;

        setTimeout(function () {
          if (useAsImage) {
            saveAndOpenEditor();
          } else {
            renderReviewLayers(res);
            showStep(4); // Step 4: Review Layers
          }
        }, 500);
      })
      .catch(function (err) {
        clearInterval(interval);
        alert(err.message || "Conversion failed. You can still use this image as a flat canvas layer.");
        showStep(2);
      });
  }

  // ── 4. Render Review Layers Screen ───────────────────────────
  function renderReviewLayers(jobData) {
    var origImg = $("#reviewOrigImg");
    if (origImg) origImg.src = jobData.originalUrl || originalDataUri;

    var previewStage = $("#reviewReconstructedStage");
    if (previewStage) {
      previewStage.innerHTML = buildCardPreview(jobData.project);
    }

    var list = $("#reviewLayersList");
    if (!list) return;
    list.innerHTML = "";

    var elements = jobData.project.elements || [];
    var countEl = $("#reviewLayersCount");
    if (countEl) countEl.textContent = elements.length + " editable layers";

    elements.forEach(function (el, index) {
      var item = document.createElement("div");
      item.className = "ds-review-item";

      var typeIcon = "📄";
      var detail = "";
      if (el.type === "text") {
        typeIcon = "T";
        detail = '"' + escapeHtml(el.text) + '" (' + el.fontFamily + ', ' + el.fontSize + 'px)';
      } else if (el.type === "image" && el.role === "background") {
        typeIcon = "🖼";
        detail = "Reconstructed clean background (text removed)";
      } else if (el.type === "image") {
        typeIcon = "✂";
        detail = "Foreground cutout (" + (el.width + 'x' + el.height) + "px)";
      } else if (el.type === "shape") {
        typeIcon = "⬡";
        detail = "Vector " + el.shape + " (" + el.fill + ")";
      }

      var confPct = el.confidence ? Math.round(el.confidence * 100) + "%" : "90%";

      item.innerHTML = [
        '<div class="ds-review-item-main">',
        '  <span class="ds-review-ico">' + typeIcon + '</span>',
        '  <div class="ds-review-info">',
        '    <strong class="ds-review-name">' + escapeHtml(el.name || el.id) + '</strong>',
        '    <span class="ds-review-detail">' + detail + '</span>',
        '  </div>',
        '</div>',
        '<div class="ds-review-item-meta">',
        '  <span class="ds-conf-pill">' + confPct + ' confidence</span>',
        '  <button type="button" class="ds-review-del" title="Remove layer" data-idx="' + index + '">×</button>',
        '</div>'
      ].join("");

      var delBtn = item.querySelector(".ds-review-del");
      if (delBtn) {
        delBtn.addEventListener("click", function () {
          elements.splice(index, 1);
          renderReviewLayers(jobData);
        });
      }

      list.appendChild(item);
    });

    // Toggle between Original and Editable view
    var btnOrig = $("#toggleViewOrig");
    var btnEdit = $("#toggleViewEdit");
    var wrapOrig = $("#reviewOrigWrap");
    var wrapEdit = $("#reviewEditWrap");

    if (btnOrig && btnEdit && wrapOrig && wrapEdit) {
      btnOrig.onclick = function () {
        btnOrig.classList.add("active");
        btnEdit.classList.remove("active");
        wrapOrig.style.display = "block";
        wrapEdit.style.display = "none";
      };
      btnEdit.onclick = function () {
        btnEdit.classList.add("active");
        btnOrig.classList.remove("active");
        wrapOrig.style.display = "none";
        wrapEdit.style.display = "block";
      };
    }
  }

  function saveAndOpenEditor() {
    if (!currentProject) return;
    var openBtn = $("#btnOpenEditor");
    if (openBtn) {
      openBtn.disabled = true;
      openBtn.textContent = "Opening Studio...";
    }

    fetch("/api/designs/projects/" + encodeURIComponent(currentProject.id || "new"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentProject)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success && res.project) {
          window.location.href = "/design-editor?id=" + encodeURIComponent(res.project.id);
        } else {
          // Store in sessionStorage as fallback
          sessionStorage.setItem("sc_pending_design", JSON.stringify(currentProject));
          window.location.href = "/design-editor?session=1";
        }
      })
      .catch(function () {
        sessionStorage.setItem("sc_pending_design", JSON.stringify(currentProject));
        window.location.href = "/design-editor?session=1";
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
