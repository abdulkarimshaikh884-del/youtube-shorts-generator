'use strict';
// Compact *numeric geometry*, not raster bytes, SVG markup or executable code.
// Signed XY deltas use bounded base64 varints on a fixed half-pixel grid.
function invalid() {const error=new Error('Invalid reference motion: unsafe vector path encoding');error.code='SC_REFERENCE_SCHEMA';throw error;}
function decodePath(value,width,height) {
  if(typeof value!=='string'||!value.length||value.length>32768||value.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))invalid();
  let bytes;try{bytes=atob(value);if(btoa(bytes)!==value)invalid();}catch{invalid();}
  const result=[];let position=0,x=0,y=0;
  while(position<bytes.length){
    let encoded=0,shift=0,byte;
    do{if(position>=bytes.length||shift>14)invalid();byte=bytes.charCodeAt(position++);encoded|=(byte&127)<<shift;shift+=7;}while(byte&128);
    const delta=encoded%2?-(encoded+1)/2:encoded/2;
    const next=(result.length%2?y:x)+delta,limit=(result.length%2?height:width)*2;
    if(!Number.isSafeInteger(next)||next<0||next>limit)invalid();
    if(result.length%2)y=next;else x=next;
    result.push(next/2);if(result.length>8192)invalid();
  }
  if(result.length<6||result.length%2)invalid();
  return result;
}
module.exports={decodePath};
