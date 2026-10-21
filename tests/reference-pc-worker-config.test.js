'use strict';

const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const {safeDirectory, configDirectory} = require('../reference-motion/pc-worker-config');

function aliasFixture({sameIdentity = true, zeroIdentity = false, linkedAncestor = false} = {}) {
  const logical = path.resolve(os.tmpdir(),'sc-alias-unit','logical','worker');
  const canonical = path.resolve(os.tmpdir(),'sc-alias-unit','msix-cache','worker');
  let creates = 0;
  const directory = {isDirectory:()=>true,isSymbolicLink:()=>false};
  const filesystem = {
    async lstat(filename) {return linkedAncestor && filename === path.dirname(logical) ? {...directory,isSymbolicLink:()=>true} : directory;},
    async mkdir() {creates++;}, async realpath() {return canonical;},
    async stat(filename) {return {dev:1n,ino:zeroIdentity?0n:filename===logical||sameIdentity?9001n:9002n};}
  };
  return {logical,canonical,filesystem,creates:()=>creates};
}
test('Windows non-reparse canonical aliases require matching real volume/file IDs',async()=>{
  const fixture=aliasFixture(), nativeCalls=[];
  assert.equal(await safeDirectory(fixture.logical,{filesystem:fixture.filesystem,platform:'win32',nativeReparseCheck:async paths=>nativeCalls.push(paths)}),fixture.canonical);
  assert.equal(fixture.creates(),1);
  assert(nativeCalls.flat().includes(fixture.logical));assert(nativeCalls.flat().includes(fixture.canonical));
  assert(nativeCalls.flat().includes(path.dirname(fixture.logical)));
});
test('different real identities and unavailable zero file IDs reject aliases',async()=>{
  for(const options of [{sameIdentity:false},{zeroIdentity:true}]){
    const fixture=aliasFixture(options);
    await assert.rejects(()=>safeDirectory(fixture.logical,{filesystem:fixture.filesystem,platform:'win32',nativeReparseCheck:async()=>{}}),/Aliased/);
  }
});
test('a symlink/junction anywhere in ancestry fails before recursive mkdir',async()=>{
  const fixture=aliasFixture({linkedAncestor:true});
  await assert.rejects(()=>safeDirectory(fixture.logical,{filesystem:fixture.filesystem,platform:'win32',nativeReparseCheck:async()=>{}}),/Aliased/);
  assert.equal(fixture.creates(),0);
});
test('native Windows reparse attributes fail even if Node does not call it a symlink',async()=>{
  const fixture=aliasFixture();
  await assert.rejects(()=>safeDirectory(fixture.logical,{filesystem:fixture.filesystem,platform:'win32',nativeReparseCheck:async()=>{throw Error('Reparse point refused');}}),/Reparse/);
  assert.equal(fixture.creates(),0);
});
test('non-Windows spelling changes remain fail-closed instead of accepting Windows aliases',async()=>{
  const fixture=aliasFixture();
  await assert.rejects(()=>safeDirectory(fixture.logical,{filesystem:fixture.filesystem,platform:'linux',nativeReparseCheck:async()=>assert.fail('Windows-only')}),/Aliased/);
});
test('read-only directory checks never create a directory',async()=>{
  const fixture=aliasFixture();
  await safeDirectory(fixture.logical,{create:false,filesystem:fixture.filesystem,platform:'win32',nativeReparseCheck:async()=>{}});
  assert.equal(fixture.creates(),0);
});
test('real junction/symlink ancestor is rejected without creating its requested child',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sc-pc-config-link-test-'));
  try {
    const target=path.join(root,'target'),link=path.join(root,'link');await fs.mkdir(target);
    await fs.symlink(target,link,process.platform==='win32'?'junction':'dir');
    await assert.rejects(()=>safeDirectory(path.join(link,'new-child')),/Aliased/);
    await assert.rejects(()=>fs.stat(path.join(target,'new-child')),error=>error.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('actual MSIX default directory may canonicalize without being a reparse point',{skip:process.platform!=='win32'},async(t)=>{
  const directory=configDirectory();
  try{await fs.stat(directory);}catch(error){if(error.code==='ENOENT'){t.skip('No default PC worker directory has been provisioned.');return;}throw error;}
  const canonical=await safeDirectory(directory,{create:false});
  const [a,b]=await Promise.all([fs.stat(directory,{bigint:true}),fs.stat(canonical,{bigint:true})]);
  assert.equal(a.dev,b.dev);assert.equal(a.ino,b.ino);assert.notEqual(a.ino,0n);
});
