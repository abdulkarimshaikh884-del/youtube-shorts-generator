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
  var loadedTemplates = [];
  var loadVersion = 0;
  var converting = false;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function init() {
    loadTemplates(currentCategory);
    setupFilters();
    setupUploadModal();
    var search = $("#designSearch");
    if (search) search.addEventListener("input", function () { renderTemplates(loadedTemplates); });
  }

  // ── 1. Load & Render Templates ──────────────────────────────
  function loadTemplates(category) {
    var version = ++loadVersion;
    var grid = $("#designsGrid");
    if (!grid) return;
    grid.innerHTML = '<div class="ds-loading"><div class="ds-spinner"></div><p>Loading design templates...</p></div>';

    fetch("/api/designs/templates" + (category && category !== "all" ? "?category=" + encodeURIComponent(category) : ""))
      .then(function (r) { if (!r.ok) throw new Error("load"); return r.json(); })
      .then(function (res) {
        if (version !== loadVersion) return;
        if (!res || !res.success) throw new Error("load");
        loadedTemplates = res.templates || [];
        if (!res || !res.success || !res.templates || !res.templates.length) {
          grid.innerHTML = '<div class="ds-empty"><h3>No design templates found</h3><p>Upload a design or thumbnail to create the first editable template!</p></div>';
          return;
        }
        renderTemplates(res.templates);
      })
      .catch(function (err) {
        if (version !== loadVersion) return;
        grid.innerHTML = '<div class="ds-empty"><h3>Could not load templates</h3><p>Please refresh the page to try again.</p></div>';
      });
  }

  function renderTemplates(templates) {
    var grid = $("#designsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    var query = ($("#designSearch").value || "").trim().toLowerCase();
    templates = templates.filter(function (tpl) { return (tpl.title + " " + (tpl.description || "")).toLowerCase().includes(query); });
    if (!templates.length) { grid.innerHTML = '<div class="ds-empty"><h3>No matching designs</h3><p>Try another search or category.</p></div>'; return; }

    templates.forEach(function (tpl) {
      var card = document.createElement("article");
      card.className = "ds-card";
      if (tpl.isPremium) card.dataset.premium = "1";

      var previewHtml = window.SCDesignPreview(tpl);
      var badgeHtml = "";
      if (tpl.isPremium) {
        var stars = tpl.starPrice || 1;
        badgeHtml = '<span class="ds-card-prem-badge">★ ' + stars + ' Star' + (stars > 1 ? 's' : '') + '</span>';
      }

      var authorName = tpl.authorName || "Creator";
      var authorHandle = tpl.authorHandle || "@creator";
      var creatorSlug = encodeURIComponent(authorHandle.replace(/^@/, ""));
      var creatorUrl = "/creator?handle=" + creatorSlug;
      var initials = String(authorName).slice(0, 2).toUpperCase();
      var tickSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var isVerified = tpl.authorVerified === true || String(authorHandle).replace(/^@/, "").toLowerCase() === "shortscraft";
      var verifiedHtml = isVerified ? '<span class="sh-verified" aria-label="Verified creator" title="Verified creator">' + tickSvg + '</span>' : '';
      var avStyle = tpl.authorAvatarUrl ? 'background-image:url(\'' + escapeHtml(tpl.authorAvatarUrl) + '\');background-size:cover;background-position:center;' : '';

      card.innerHTML = [
        '<div class="ds-card-thumb">',
        previewHtml,
        badgeHtml,
        '</div>',
        '<div class="ds-card-body">',
        '  <h3 class="ds-card-title">' + escapeHtml(tpl.title) + '</h3>',
        '  <a href="' + creatorUrl + '" class="ds-card-author" title="View profile of ' + escapeHtml(authorName) + '">',
        '    <div class="sh-tcreator-avatar"' + (avStyle ? ' style="' + avStyle + '"' : '') + '>' + (tpl.authorAvatarUrl ? '' : escapeHtml(initials)) + '</div>',
        '    <div class="sh-tcreator-info">',
        '      <span class="sh-tcreator-name"><span class="sc-name-text">' + escapeHtml(authorName) + '</span>' + verifiedHtml + '</span>',
        '      <span class="sh-tcreator-handle">' + escapeHtml(authorHandle) + '</span>',
        '    </div>',
        '  </a>',
        '</div>',
        '  <button type="button" class="ds-card-open" aria-label="Edit ' + escapeHtml(tpl.title) + ' by ' + escapeHtml(authorName) + '"></button>'
      ].join("");

      // The entire card opens the existing editor flow.
      var editBtn = card.querySelector(".ds-card-open");
      if (editBtn) {
        editBtn.addEventListener("click", function () {
          useTemplate(tpl.id, editBtn);
        });
      }

      grid.appendChild(card);
    });
  }

  function buildCardPreview(tpl) {
    var cWidth = tpl.canvas ? tpl.canvas.width : 1280;
    var cHeight = tpl.canvas ? tpl.canvas.height : 720;
    var aspectPct = ((cHeight / cWidth) * 100).toFixed(2);

    var previewSrc = tpl.previewUrl || tpl.preview_url;
    if (previewSrc) {
      return '<div class="ds-pv-stage" style="padding-top:' + aspectPct + '%;"><img class="ds-pv-img ds-pv-hero" src="' + escapeHtml(previewSrc) + '" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;" alt="' + escapeHtml(tpl.title) + '" loading="lazy"/></div>';
    }

    var elementsHtml = "";
    (tpl.elements || []).forEach(function (el) {
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
    var origText = btn.textContent || "✦ Edit Template →";
    btn.textContent = "Opening...";

    fetch("/api/designs/templates/" + encodeURIComponent(templateId) + "/clone", { method: "POST" })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
          return null;
        }
        if (r.status === 402) {
          return r.json().then(function (res) {
            btn.disabled = false;
            btn.textContent = origText;
            var price = res.starPrice || 1;
            var confirmMsg = "★ This is a Premium Design Template (" + price + " Star" + (price > 1 ? "s" : "") + ").\n\nWould you like to unlock it now to remix, customize, and export?";
            if (!confirm(confirmMsg)) return null;

            btn.disabled = true;
            btn.textContent = "Unlocking...";
            fetch("/api/designs/" + encodeURIComponent(templateId) + "/unlock", { method: "POST" })
              .then(function (ur) { return ur.json(); })
              .then(function (ures) {
                if (ures && ures.success) {
                  if (window.SC_UI && SC_UI.toast) SC_UI.toast("Design unlocked! Opening editor...");
                  useTemplate(templateId, btn);
                } else if (ures && ures.needStars) {
                  btn.disabled = false;
                  btn.textContent = origText;
                  if (window.SC_AUTH && typeof window.SC_AUTH.openStarPacks === "function") {
                    window.SC_AUTH.openStarPacks();
                  } else if (confirm("You need " + price + " Star(s) to unlock this template. Go to Star Packs to top up?")) {
                    location.href = "/pricing#stars";
                  }
                } else {
                  btn.disabled = false;
                  btn.textContent = origText;
                  alert((ures && ures.error) || "Could not unlock design template.");
                }
              })
              .catch(function (err) {
                btn.disabled = false;
                btn.textContent = origText;
                alert("Unlock failed: " + err.message);
              });
            return null;
          });
        }
        return r.json();
      })
      .then(function (res) {
        if (!res) return;
        if (res && res.success && res.project) {
          window.location.href = "/design-editor?id=" + encodeURIComponent(res.project.id);
        } else if (res && res.error) {
          if (res.error.toLowerCase().indexOf("log in") !== -1) {
            window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
            return;
          }
          alert(res.error);
          btn.disabled = false;
          btn.textContent = origText;
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = origText;
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
  var STAGES = [
    { id: "upload", label: "Uploading image...", pct: 15 },
    { id: "vision", label: "Analyzing design...", pct: 32 },
    { id: "text", label: "Detecting editable text...", pct: 50 },
    { id: "objects", label: "Separating major objects...", pct: 68 },
    { id: "background", label: "Rebuilding background...", pct: 82 },
    { id: "layers", label: "Creating editable layers...", pct: 93 },
    { id: "studio", label: "Preparing Design Studio...", pct: 100 }
  ];

  function updateStageUI(stageIndex) {
    var bar = $("#conversionProgressBar");
    var txt = $("#conversionProgressText");
    var s = STAGES[stageIndex] || STAGES[STAGES.length - 1];
    if (bar) bar.style.width = s.pct + "%";
    if (txt) txt.textContent = s.label;

    var steps = $$(".ds-stage-step");
    steps.forEach(function (stepEl, idx) {
      if (idx < stageIndex) {
        stepEl.classList.remove("active");
        stepEl.classList.add("done");
      } else if (idx === stageIndex) {
        stepEl.classList.add("active");
        stepEl.classList.remove("done");
      } else {
        stepEl.classList.remove("active", "done");
      }
    });
  }

  function setupUploadModal() {
    var triggerBtns = $$(".js-open-design-upload, .js-open-upload, #topbarUploadBtn, #openUploadDesignBtn");
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
      if (ev.target.closest(".ds-modal-close")) closeModal();
      if (ev.target === modal) closeModal();
    });
    modal.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeModal();
      if (ev.key === "Tab") {
        var focusable = Array.from(modal.querySelectorAll('button:not([disabled]),[tabindex="0"],input')).filter(function (el) { return el.getClientRects().length; });
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    });

    // File Dropzone
    var dropzone = $("#designDropzone");
    var fileInput = $("#designFileInput");
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", function () { fileInput.click(); });
    dropzone.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fileInput.click(); } });
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
        $("#closeDesignModal").focus();
      });
    }
    if (btnCancelReview) {
      btnCancelReview.addEventListener("click", closeModal);
    }

    // Error / Fallback actions
    var btnErrorTryAgain = $("#btnErrorTryAgain");
    var btnErrorUseAsImage = $("#btnErrorUseAsImage");
    var btnErrorOpenPartial = $("#btnErrorOpenPartial");
    var btnErrorClose = $("#btnErrorClose");

    if (btnErrorTryAgain) {
      btnErrorTryAgain.addEventListener("click", function () {
        startConversion(false);
      });
    }
    if (btnErrorUseAsImage) {
      btnErrorUseAsImage.addEventListener("click", function () {
        startConversion(true);
      });
    }
    if (btnErrorOpenPartial) {
      btnErrorOpenPartial.addEventListener("click", function () {
        if (currentProject) saveAndOpenEditor();
      });
    }
    if (btnErrorClose) {
      btnErrorClose.addEventListener("click", closeModal);
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
        $("#closeDesignModal").focus();
      })
      .catch(function () {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
      });
  }

  function closeModal() {
    if (converting) return;
    var modal = $("#designUploadModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    currentJob = null;
    currentProject = null;
    originalDataUri = null;
    $("#designFileInput").value = "";
    var trigger = $(".js-open-design-upload");
    if (trigger) trigger.focus();
  }

  function showStep(stepKey) {
    $$(".ds-modal-step").forEach(function (step) {
      step.setAttribute("hidden", "");
    });
    var target = $("#modalStep" + stepKey);
    if (target) target.removeAttribute("hidden");
  }

  function handlePickedFile(file) {
    if (!file) return;
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
      var dataUri = e.target.result;
      var testImg = new Image();
      testImg.onload = function () {
        if (testImg.naturalWidth < 32 || testImg.naturalHeight < 32) {
          alert("Image dimensions are too small (minimum 32x32 pixels).");
          return;
        }
        if (testImg.naturalWidth > 8000 || testImg.naturalHeight > 8000) {
          alert("Image dimensions exceed 8000x8000 pixels. Please use a standard image.");
          return;
        }
        originalDataUri = dataUri;
        var preview = $("#pickedImagePreview");
        if (preview) preview.src = originalDataUri;
        var nameEl = $("#pickedFileName");
        if (nameEl) nameEl.textContent = file.name;
        var sizeEl = $("#pickedFileSize");
        if (sizeEl) sizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";

        showStep(2); // Step 2: Choose Mode (Convert to Editable vs Use as Image)
      };
      testImg.onerror = function () {
        alert("The selected image file is corrupted or could not be decoded. Please choose another image.");
      };
      testImg.src = dataUri;
    };
    reader.onerror = function () {
      alert("Failed to read the selected file. Please try again.");
    };
    reader.readAsDataURL(file);
  }

  var stageTimer = null;

  function showErrorFallback(msg, partialProject) {
    showStep("Error");
    var preview = $("#errorImagePreview");
    if (preview && originalDataUri) preview.src = originalDataUri;
    var reason = $("#errorReasonText");
    if (reason) reason.textContent = msg || "Editable conversion couldn't fully complete. You can try again or use the full image directly on your canvas.";

    var btnPartial = $("#btnErrorOpenPartial");
    if (btnPartial) {
      if (partialProject && Array.isArray(partialProject.elements) && partialProject.elements.length > 0) {
        currentProject = partialProject;
        btnPartial.style.display = "block";
      } else {
        btnPartial.style.display = "none";
      }
    }
  }

  function startConversion(useAsImage) {
    if (!originalDataUri || converting) return;
    converting = true;
    showStep(3); // Step 3: Progress screen

    if (stageTimer) clearTimeout(stageTimer);

    if (useAsImage) {
      var bar = $("#conversionProgressBar");
      var txt = $("#conversionProgressText");
      if (bar) bar.style.width = "100%";
      if (txt) txt.textContent = "Preparing your image…";
      $$(".ds-stage-step").forEach(function (s) { s.classList.remove("active"); s.classList.add("done"); });
    } else {
      updateStageUI(0);
      var currentStage = 0;
      var stageDelays = [1800, 3000, 3500, 4000, 4000];
      var delayIdx = 0;
      function scheduleNext() {
        if (delayIdx < stageDelays.length) {
          stageTimer = setTimeout(function () {
            currentStage++;
            updateStageUI(currentStage);
            delayIdx++;
            scheduleNext();
          }, stageDelays[delayIdx]);
        }
      }
      scheduleNext();
    }

    fetch("/api/designs/convert", {
      method: "POST",
      signal: AbortSignal.timeout(240000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: originalDataUri,
        useAsImage: useAsImage,
        designType: "youtube-thumbnail"
      })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        converting = false;
        if (stageTimer) clearTimeout(stageTimer);
        var res = result.data;
        if (!result.ok || !res || !res.success || !res.project) {
          var err = new Error((res && res.error) || "Could not convert this design.");
          if (res && res.project) err.partialProject = res.project;
          throw err;
        }

        updateStageUI(STAGES.length - 1);
        $$(".ds-stage-step").forEach(function (s) { s.classList.remove("active"); s.classList.add("done"); });

        currentJob = res;
        currentProject = res.project;

        setTimeout(function () {
          if (useAsImage) {
            saveAndOpenEditor();
          } else {
            renderReviewLayers(res);
            showStep(4); // Step 4: Review Layers
          }
        }, 400);
      })
      .catch(function (err) {
        converting = false;
        if (stageTimer) clearTimeout(stageTimer);
        showErrorFallback(err.message, err.partialProject);
      });
  }

  // ── 4. Render Review Layers Screen ───────────────────────────
  function renderReviewLayers(jobData) {
    var warning = $("#designReviewWarning");
    if (warning) warning.textContent = jobData.warning || "Check text, positions and image layers before opening the editor.";
    var origImg = $("#reviewOrigImg");
    if (origImg) origImg.src = jobData.originalUrl || originalDataUri;

    var previewStage = $("#reviewReconstructedStage");
    if (previewStage) {
      previewStage.innerHTML = window.SCDesignPreview(jobData.project);
    }

    var list = $("#reviewLayersList");
    if (!list) return;
    list.innerHTML = "";

    var elements = jobData.project.elements || [];
    var countEl = $("#reviewLayersCount");
    if (countEl) countEl.textContent = elements.length + " layers";

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
        detail = "Background image — inspect text repair";
      } else if (el.type === "image") {
        typeIcon = "✂";
        detail = "Image crop (" + (el.width + 'x' + el.height) + "px)";
      } else if (el.type === "shape") {
        typeIcon = "⬡";
        detail = "Vector " + el.shape + " (" + el.fill + ")";
      }

      var confPct = "Needs review";

      item.innerHTML = [
        '<div class="ds-review-item-main">',
        '  <span class="ds-review-ico">' + typeIcon + '</span>',
        '  <div class="ds-review-info">',
        '    <strong class="ds-review-name">' + escapeHtml(el.name || el.id) + '</strong>',
        '    <span class="ds-review-detail">' + detail + '</span>',
        '  </div>',
        '</div>',
        '<div class="ds-review-item-meta">',
        '  <span class="ds-conf-pill">' + confPct + '</span>',
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
        } else { throw new Error(res && res.error || "Your design could not be saved. Please retry."); }
      })
      .catch(function (err) {
        alert(err.message || "Your design could not be saved. Please retry.");
        if (openBtn) { openBtn.disabled = false; openBtn.textContent = "Open in Design Studio →"; }
        renderReviewLayers(currentJob);
        showStep(4);
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
