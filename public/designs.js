/* ============================================================
   public/designs.js — ShortsCraft Designs Hub & Convert to Editable UI
   ============================================================ */
(function () {
  "use strict";

  var uploadModal = null;
  var currentJob = null;
  var currentProject = null;
  var originalDataUri = null;
  var loadedTemplates = [];
  var loadVersion = 0;
  var converting = false;
  var openingModal = false;
  var returnFocus = null;
  var previousOverflow = "";
  var readVersion = 0;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function init() {
    loadTemplates();
    setupUploadModal();
    var search = $("#designSearch");
    if (search) search.addEventListener("input", function () { renderTemplates(loadedTemplates); });
  }

  // ── 1. Load & Render Templates ──────────────────────────────
  function loadTemplates(category) {
    var version = ++loadVersion;
    var grid = $("#designsGrid");
    if (!grid) return;
    grid.setAttribute("aria-busy", "true");
    grid.innerHTML = '<div class="ds-loading" role="status"><div class="ds-spinner" aria-hidden="true"></div><p>Loading design templates...</p></div>';

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
      }).finally(function () { if (version === loadVersion) grid.removeAttribute("aria-busy"); });
  }

  function renderTemplates(templates) {
    var grid = $("#designsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    var query = ($("#designSearch").value || "").trim().toLowerCase();
    var seen = new Set();
    templates = templates.filter(function (tpl) {
      if (!tpl || !tpl.id || seen.has(String(tpl.id))) return false;
      seen.add(String(tpl.id));
      return [tpl.title, tpl.description, tpl.authorName, tpl.authorHandle].join(" ").toLowerCase().includes(query);
    });
    if (!templates.length) { grid.innerHTML = '<div class="ds-empty"><h3>No matching designs</h3><p>Try another search.</p></div>'; return; }

    templates.forEach(function (tpl) {
      var card = document.createElement("article");
      card.className = "ds-card";
      if (tpl.isPremium) card.dataset.premium = "1";

      var previewHtml = window.SCDesignPreview(tpl);
      var badgeHtml = "";
      if (tpl.isPremium) {
        var stars = Math.max(1, Math.floor(Number(tpl.starPrice) || 1));
        badgeHtml = '<span class="ds-card-prem-badge">★ ' + stars + ' Star' + (stars > 1 ? 's' : '') + '</span>';
      }

      var authorName = String(tpl.authorName || "Publisher unavailable");
      var authorHandle = String(tpl.authorHandle || "");
      var creatorSlug = encodeURIComponent(authorHandle.replace(/^@/, ""));
      var creatorUrl = "/creator?handle=" + creatorSlug;
      var initials = String(authorName).slice(0, 2).toUpperCase();
      var tickSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var isVerified = tpl.authorVerified === true || String(authorHandle).replace(/^@/, "").toLowerCase() === "shortscraft";
      var verifiedHtml = isVerified ? '<span class="sh-verified" aria-label="Verified creator" title="Verified creator">' + tickSvg + '</span>' : '';
      var avatar = /^(\/[^/]|https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(tpl.authorAvatarUrl || "") ? tpl.authorAvatarUrl : "";

      card.innerHTML = [
        '<div class="ds-card-thumb">',
        previewHtml,
        badgeHtml,
        '</div>',
        '<div class="ds-card-body">',
        '  <h3 class="ds-card-title">' + escapeHtml(tpl.title) + '</h3>',
        '  <a href="' + creatorUrl + '" class="ds-card-author" title="View profile of ' + escapeHtml(authorName) + '">',
        '    <div class="sh-tcreator-avatar">' + (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" loading="lazy">' : escapeHtml(initials)) + '</div>',
        '    <div class="sh-tcreator-info">',
        '      <span class="sh-tcreator-name"><span class="sc-name-text">' + escapeHtml(authorName) + '</span>' + verifiedHtml + '</span>',
        (authorHandle ? '      <span class="sh-tcreator-handle">' + escapeHtml(authorHandle) + '</span>' : ''),
        '    </div>',
        '  </a>',
        '</div>',
        '  <button type="button" class="ds-card-open" aria-label="Edit ' + escapeHtml(tpl.title) + ' by ' + escapeHtml(authorName) + '"></button>'
      ].join("");
      if (!authorHandle) card.querySelector(".ds-card-author").removeAttribute("href");
      var avatarImage = card.querySelector(".sh-tcreator-avatar img");
      if (avatarImage) avatarImage.addEventListener("error", function () { this.parentElement.textContent = initials; }, {once:true});
      var previewImage = card.querySelector(".ds-template-preview");
      if (previewImage && previewImage.tagName === "IMG") previewImage.addEventListener("error", function () {
        this.outerHTML = window.SCDesignPreview(Object.assign({}, tpl, {previewUrl:null,preview_url:null}));
      }, {once:true});

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


  function setCardBusy(btn, label) {
    btn.disabled = !!label;
    if (label) { btn.setAttribute("aria-busy", "true"); btn.closest(".ds-card").dataset.opening = label; }
    else { btn.removeAttribute("aria-busy"); delete btn.closest(".ds-card").dataset.opening; }
  }

  async function useTemplate(templateId, btn) {
    if (btn.disabled) return;
    setCardBusy(btn, "Opening…");
    try {
      var response = await fetch("/api/designs/templates/" + encodeURIComponent(templateId) + "/clone", {method:"POST"});
      if (response.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname); return; }
      var res = await response.json();
      if (response.status === 402) {
        if (!window.SC_RELEASE || !SC_RELEASE.monetizationEnabled) throw new Error("Paid template unlocks are Coming Soon.");
        var price = res.starPrice || 1;
        if (!confirm("Unlock this template for " + price + " Star(s)?")) return;
        setCardBusy(btn, "Unlocking…");
        var unlock = await fetch("/api/designs/" + encodeURIComponent(templateId) + "/unlock", {method:"POST"});
        var unlocked = await unlock.json();
        if (!unlock.ok || !unlocked.success) {
          if (unlocked.needStars && window.SC_AUTH && SC_AUTH.openStarPacks) SC_AUTH.openStarPacks();
          throw new Error(unlocked.error || "Could not unlock this template.");
        }
        response = await fetch("/api/designs/templates/" + encodeURIComponent(templateId) + "/clone", {method:"POST"});
        res = await response.json();
      }
      if (!response.ok || !res.success || !res.project || !res.project.id) throw new Error(res.error || "The design could not be opened. Please retry.");
      location.href = "/design-editor?id=" + encodeURIComponent(res.project.id);
    } catch (err) {
      if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message || "Could not open this design.");
      else alert(err.message || "Could not open this design.");
    } finally { setCardBusy(btn, ""); }
  }


  // ── 3. Upload & Convert to Editable Modal ────────────────────

  function setupUploadModal() {
    var triggerBtns = $$(".js-open-design-upload, .js-open-upload, #topbarUploadBtn, #openUploadDesignBtn");
    var modal = $("#designUploadModal");
    if (!modal) return;

    triggerBtns.forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        openModal(btn);
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
        startConversion(false);
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

  function openModal(trigger) {
    if (openingModal) return;
    openingModal = true;
    fetch("/api/auth/me", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("Account unavailable"); return r.json(); })
      .then(function (j) {
        if (!j || !j.user) {
          window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
          return;
        }
        var modal = $("#designUploadModal");
        if (!modal) return;
        returnFocus = trigger || document.activeElement;
        previousOverflow = document.body.style.overflow;
        modal.classList.add("open");
        modal.removeAttribute("hidden");
        document.body.style.overflow = "hidden";
        showStep(1);
        $("#closeDesignModal").focus();
      })
      .catch(function () {
        if (window.SC_UI) SC_UI.toast("Could not check your account. Please try Upload again.", true);
      }).finally(function () { openingModal = false; });
  }

  function closeModal() {
    if (converting) return;
    var modal = $("#designUploadModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("hidden", "");
    document.body.style.overflow = previousOverflow;
    readVersion++;
    currentJob = null;
    currentProject = null;
    originalDataUri = null;
    $("#designFileInput").value = "";
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  }

  function showStep(stepKey) {
    $$(".ds-modal-step").forEach(function (step) {
      step.setAttribute("hidden", "");
    });
    var target = $("#modalStep" + stepKey);
    if (target) target.removeAttribute("hidden");
    if (target) {
      var focusTarget = target.querySelector('button:not([disabled]),[tabindex="0"]') || target.querySelector("h3");
      if (focusTarget) { if (!focusTarget.hasAttribute("tabindex") && focusTarget.tagName === "H3") focusTarget.tabIndex = -1; focusTarget.focus(); }
    }
    var dialog = $("#designUploadModal [role=dialog]");
    if (dialog && target) {
      dialog.removeAttribute("aria-labelledby");
      dialog.setAttribute("aria-label", target.querySelector("h3").textContent);
    }
  }

  function handlePickedFile(file) {
    if (!file || converting) return;
    var version = ++readVersion;
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
      if (version !== readVersion) return;
      var dataUri = e.target.result;
      var testImg = new Image();
      testImg.onload = function () {
        if (version !== readVersion) return;
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

        startConversion(false); // An uploaded image is analysed automatically.
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
    currentJob = null;
    currentProject = null;
    showStep(3);
    var status = $("#conversionProgressText");
    if (status) status.textContent = useAsImage ? "Preparing one image layer…" : "Uploading and analysing your image…";
    fetch("/api/designs/convert", {
      method: "POST", signal: AbortSignal.timeout(240000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({image:originalDataUri,useAsImage:useAsImage,designType:"youtube-thumbnail"})
    }).then(function (r) {
      return r.json().then(function (data) { return {ok:r.ok,status:r.status,data:data}; });
    }).then(function (result) {
      converting = false;
      var res = result.data;
      if (!result.ok || !res || !res.success || !res.project) {
        throw new Error((res && res.error) || "Your image could not be analysed. Please retry.");
      }
      currentJob = res;
      currentProject = res.project;
      if (useAsImage) saveAndOpenEditor();
      else { renderReviewLayers(res); showStep(4); }
    }).catch(function (err) {
      converting = false;
      showErrorFallback(err.message);
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
        detail = '"' + el.text + '" (' + el.fontFamily + ', ' + el.fontSize + 'px)';
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
        '    <span class="ds-review-detail">' + escapeHtml(detail) + '</span>',
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
      btnEdit.classList.add("active"); btnOrig.classList.remove("active");
      wrapOrig.style.display = "none"; wrapEdit.style.display = "block";
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
    if (!currentProject || converting) return;
    converting = true;
    var openBtn = $("#btnOpenEditor");
    if (openBtn) {
      openBtn.disabled = true;
      openBtn.setAttribute("aria-busy", "true");
      openBtn.textContent = "Opening Studio...";
    }

    fetch("/api/designs/projects/" + encodeURIComponent(currentProject.id || "new"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentProject)
    })
      .then(function (r) { return r.json().then(function (res) { if (!r.ok) throw new Error(res.error || "Your design could not be saved."); return res; }); })
      .then(function (res) {
        if (res && res.success && res.project && res.project.id) {
          window.location.href = "/design-editor?id=" + encodeURIComponent(res.project.id);
        } else { throw new Error(res && res.error || "Your design could not be saved. Please retry."); }
      })
      .catch(function (err) {
        converting = false;
        alert(err.message || "Your design could not be saved. Please retry.");
        if (openBtn) { openBtn.disabled = false; openBtn.removeAttribute("aria-busy"); openBtn.textContent = "Open in Design Studio →"; }
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
