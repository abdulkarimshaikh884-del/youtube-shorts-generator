'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const initialize = require('../public/mobile-home-rows');
class Element {
  constructor(className='') { this.className=className; this.children=[]; this.parentElement=null; this.hidden=false; this.attributes={}; }
  get classList() { return {contains:name=>this.className.split(/\s+/).includes(name),add:name=>{if(!this.classList.contains(name))this.className+=' '+name;},remove:name=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(' ');}}; }
  appendChild(node) { return this.insertBefore(node,null); }
  insertBefore(node,before) { if(node.parentElement)node.remove(); const at=before?this.children.indexOf(before):this.children.length; this.children.splice(at,0,node);node.parentElement=this;return node; }
  remove() { if(this.parentElement){const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;} }
  setAttribute(name,value) { this.attributes[name]=value; }
  querySelectorAll(selector) { return this.children.flatMap(node=>[...(node.classList.contains(selector.slice(1))?[node]:[]),...node.querySelectorAll(selector)]); }
}
function fixture() {
  const configs=[['gallery','sh-tile',10],['homeDesignsGrid','ds-card',12],['homeTutList','sh-tut-card',8]];
  const boxes={}, originals={};
  for(const [id,cls,count] of configs){const box=boxes[id]=new Element();originals[id]=[];for(let n=0;n<count;n++){let card=new Element(cls);card.identity=id+n;card.existingHandler=()=>n;originals[id].push(card);box.appendChild(card);}}
  const media={matches:true,addEventListener(_,fn){this.listener=fn;},removeEventListener(){this.listener=null;}};
  const doc={body:new Element('page-home'),getElementById:id=>boxes[id],createElement:()=>new Element()};
  const win={matchMedia:()=>media,MutationObserver:class {observe(){} disconnect(){}}};
  return {boxes,originals,media,doc,win};
}
test('Home uses original live cards in three/two/two independently named rows',()=>{
  const f=fixture(), api=initialize(f.doc,f.win);
  for(const [id,lengths] of [['gallery',[4,3,3]],['homeDesignsGrid',[6,6]],['homeTutList',[4,4]]]){
    const rows=f.boxes[id].querySelectorAll('.mc-card-row');
    assert.deepEqual(rows.map(r=>r.children.length),lengths);
    assert.equal(new Set(rows.map(r=>r.attributes['aria-label'])).size,lengths.length);
    assert.ok(rows.every(r=>r.tabIndex===0 && r.attributes.role==='region'));
    assert.deepEqual(rows.flatMap(r=>r.children),f.originals[id]);
    assert.ok(rows[0].children[0].existingHandler);
  }
  api.refresh(); assert.equal(f.boxes.gallery.querySelectorAll('.mc-card-row').length,3);
});
test('desktop restores exact nodes/order, and returning to phone never duplicates cards',()=>{
  const f=fixture(),api=initialize(f.doc,f.win);
  f.media.matches=false;f.media.listener();
  for(const id of Object.keys(f.boxes)){assert.deepEqual(f.boxes[id].children,f.originals[id]);assert.ok(!f.boxes[id].classList.contains('mc-independent-rows'));}
  f.media.matches=true;f.media.listener();api.refresh();
  assert.deepEqual(f.boxes.gallery.querySelectorAll('.sh-tile'),f.originals.gallery);
  api.destroy();assert.deepEqual(f.boxes.gallery.children,f.originals.gallery);assert.equal(f.media.listener,null);
});
test('hidden results and complete async renderer repaint retain no stale/duplicate cards',()=>{
  const f=fixture(),api=initialize(f.doc,f.win);
  f.originals.gallery.forEach(c=>c.hidden=true);api.refresh();
  assert.ok(f.boxes.gallery.querySelectorAll('.mc-card-row').every(r=>r.hidden));
  f.originals.gallery.forEach(c=>c.hidden=false);api.refresh();
  assert.deepEqual(f.boxes.gallery.querySelectorAll('.sh-tile'),f.originals.gallery);
  [...f.boxes.gallery.children].forEach(c=>c.remove());
  const replacement=new Element('sh-tile');f.boxes.gallery.appendChild(replacement);api.refresh();
  assert.deepEqual(f.boxes.gallery.querySelectorAll('.sh-tile'),[replacement]);
  assert.equal(f.boxes.gallery.querySelectorAll('.mc-card-row').filter(r=>!r.hidden).length,1);
});
test('other routes are untouched',()=>{const f=fixture();f.doc.body.className='sh-library';assert.equal(initialize(f.doc,f.win),null);assert.deepEqual(f.boxes.gallery.children,f.originals.gallery);});
