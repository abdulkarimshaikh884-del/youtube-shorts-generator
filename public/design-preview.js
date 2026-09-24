/* Canvas-proportional preview; no arbitrary eight-layer truncation or fixed text scale. */
(function () {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); };
  var num = function (n, fallback) { return Number.isFinite(Number(n)) ? Number(n) : fallback; };
  var color = function (s, fallback) { return /^#[0-9a-f]{3,8}$/i.test(s || "") ? s : fallback; };
  var src = function (s) { return /^(\/[^/]|https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(s || "") ? esc(s) : ""; };
  window.SCDesignPreview = function (tpl) {
    var w = Math.max(1, num(tpl.canvas && tpl.canvas.width,1280)), h = Math.max(1,num(tpl.canvas && tpl.canvas.height,720));
    var preview = tpl.previewUrl || tpl.preview_url;
    if (preview) return '<img class="ds-template-preview" src="' + src(preview) + '" alt="' + esc(tpl.title) + '" loading="lazy">';
    var layers = (tpl.elements || []).slice().sort(function(a,b) { return num(a.zIndex,0)-num(b.zIndex,0); }).filter(function(e) {return !e.hidden;}).map(function(e) {
      var x=num(e.x,0),y=num(e.y,0),ew=Math.max(1,num(e.width,100)),eh=Math.max(1,num(e.height,100));
      var content="", box='x="'+x+'" y="'+y+'" width="'+ew+'" height="'+eh+'"';
      if(e.type === "image") content='<image '+box+' href="'+src(e.src)+'" preserveAspectRatio="none"/>';
      else if(e.type === "shape") {
        var paint='fill="'+color(e.fill,"#222")+'" stroke="'+color(e.stroke,"none")+'"';
        if(e.shape === "circle") content='<ellipse cx="'+(x+ew/2)+'" cy="'+(y+eh/2)+'" rx="'+ew/2+'" ry="'+eh/2+'" '+paint+'/>';
        else content='<rect '+box+' rx="'+num(e.radius,0)+'" '+paint+'/>';
      } else if(e.type === "text") {
        var font=/^[a-zA-Z0-9 ,_-]+$/.test(e.fontFamily || "") ? e.fontFamily : "Arial";
        var align=["left","right","center"].includes(e.alignment)?e.alignment:"left";
        content='<foreignObject '+box+'><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;white-space:pre-wrap;overflow-wrap:break-word;line-height:1.1;color:'+color(e.fill,"#fff")+';font-family:'+esc(font)+';font-size:'+num(e.fontSize,36)+'px;font-weight:'+num(e.fontWeight,700)+';text-align:'+align+'">'+esc(e.text)+'</div></foreignObject>';
      }
      return '<g transform="rotate('+num(e.rotation,0)+' '+(x+ew/2)+' '+(y+eh/2)+')" opacity="'+Math.max(0,Math.min(1,num(e.opacity,1)))+'">'+content+'</g>';
    }).join("");
    return '<svg class="ds-template-preview" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Design layer preview">'+layers+'</svg>';
  };
})();
