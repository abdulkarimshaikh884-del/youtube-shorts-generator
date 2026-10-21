'use strict';

// Reference media uses the existing design_assets schema, without publishing
// it or requiring an image-engine schema migration. Older private source.webp
// references remain readable; new writes use the already-supported path.
const crypto = require('node:crypto'), sharp = require('sharp');
const db = require('../db');
function validRef(ref) {
  return !!ref && typeof ref === 'object' && !Array.isArray(ref) &&
    Object.keys(ref).length === 2 && /^job_[a-f0-9]{32}$/.test(ref.jobId) &&
    ['original.webp', 'source.webp'].includes(ref.assetPath);
}
function unavailable() { const error = Error('Private reference media is unavailable to this account.'); error.status = 403; return error; }
async function upload(user, data) {
  if (!user?.id) throw unavailable();
  if (typeof data !== 'string' || data.length > 5500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) throw Error('Invalid bounded raster image.');
  const raw = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
  if (!raw.length || raw.length > 4000000) throw Error('Reference image exceeds its byte budget.');
  const image = sharp(raw, {limitInputPixels: 16000000}), meta = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) !== 1) throw Error('Unsupported raster image.');
  const bytes = await image.rotate().resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true}).webp({quality: 95, alphaQuality: 100}).toBuffer();
  if (!bytes.length || bytes.length > 4000000) throw Error('Encoded reference image exceeds its byte budget.');
  const ref = {jobId: 'job_' + crypto.randomBytes(16).toString('hex'), assetPath: 'original.webp'};
  await db.tx(async client => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', ['design-assets:' + user.id]);
    const quota = await client.query('select coalesce(sum(byte_size),0) as bytes from public.design_assets where user_id=$1', [user.id]);
    if (Number(quota.rows[0]?.bytes || 0) + bytes.length > 128 * 1024 * 1024) throw Error('Private image storage quota reached.');
    await client.query('insert into public.design_assets (job_id,asset_path,user_id,content,byte_size,is_public) values ($1,$2,$3,$4,$5,false)', [ref.jobId, ref.assetPath, user.id, bytes, bytes.length]);
  });
  return {ref, mediaData: 'data:image/webp;base64,' + bytes.toString('base64')};
}
async function resolve(user, ref) {
  if (!user?.id || !validRef(ref)) throw unavailable();
  const {rows} = await db.query('select content from public.design_assets where job_id=$1 and asset_path=$2 and user_id=$3', [ref.jobId, ref.assetPath, user.id]);
  if (!rows[0]) throw unavailable();
  return 'data:image/webp;base64,' + Buffer.from(rows[0].content).toString('base64');
}

function createDiscard(database) {
  return async function discard(userId, refs) {
    if (typeof userId !== 'string' || !userId || userId.length > 128 || !Array.isArray(refs) || refs.length > 12 || refs.some(ref => !validRef(ref))) {
      throw new Error('Invalid private reference-asset cleanup.');
    }
    const unique = [...new Map(refs.map(ref => [ref.jobId, ref])).values()];
    if (!unique.length) return { removed: 0 };
    return database.tx(async client => {
      // Share the existing upload quota lock. Never remove published assets,
      // another account's bytes, arbitrary paths, or a whole user's asset set.
      await client.query('select pg_advisory_xact_lock(hashtext($1))', ['design-assets:' + userId]);
      let removed = 0;
      for (const ref of unique) {
        const result = await client.query(
          'delete from public.design_assets where job_id = $1 and asset_path = $2 and user_id = $3 and is_public = false',
          [ref.jobId, ref.assetPath, userId]);
        removed += result.rowCount || 0;
      }
      return { removed };
    });
  };
}

module.exports = {upload, resolve, validRef, discard: createDiscard(db), createDiscard};
