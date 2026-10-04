/* Shared validation for AI composer attachments. Server checks independently. */
(function () {
  "use strict";
  window.SC_IMAGE_INPUT = { read: function (file) {
    if (!file || !/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) return Promise.reject(new Error("Choose a PNG, JPEG, WebP or GIF image."));
    if (!file.size || file.size > 900 * 1024) return Promise.reject(new Error("Choose an image smaller than 900 KB."));
    return new Promise(function (resolve, reject) {
      var reader = new FileReader(), image = new Image(), finished = false;
      var timer = setTimeout(function () { finish(new Error("The image took too long to read. Please try another file.")); }, 10000);
      function finish(error, result) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        reader.onload = reader.onerror = image.onload = image.onerror = null;
        if (reader.readyState === 1) reader.abort();
        image.src = "";
        if (error) reject(error); else resolve(result);
      }
      reader.onerror = function () { finish(new Error("Could not read that image. Please choose it again.")); };
      reader.onload = function () {
        var dataUrl = String(reader.result || "");
        image.onload = function () {
          var width = image.naturalWidth, height = image.naturalHeight;
          if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216) {
            finish(new Error("That image is too large in dimensions. Use at most 8192px per side and 16 megapixels.")); return;
          }
          finish(null, {name:file.name, dataUrl:dataUrl});
        };
        image.onerror = function () { finish(new Error("That file is not a readable image. Choose a valid PNG, JPEG, WebP or GIF.")); };
        image.src = dataUrl;
      };
      try { reader.readAsDataURL(file); }
      catch (error) { finish(new Error("Could not read that image. Please choose it again.")); }
    });
  } };
})();
