'use strict';

// This fixed worker accepts bounded data only. It cannot choose a component,
// executable, module, provider, URL or user/model-supplied source code.
const {validateJob,checkOutputLocation,MAX_INPUT_BYTES} = require('./render-process');
async function main() {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {size += chunk.length; if (size > MAX_INPUT_BYTES) throw Error('Render input limit'); chunks.push(chunk);}
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!input || Object.keys(input).some(key => !['document','options'].includes(key))) throw Error('Invalid render envelope');
  const {job} = validateJob(input.document,input.options);
  await checkOutputLocation(job.options.output);
  const metrics = await require('./render').renderReferenceCore(job.document,job.options);
  if (process.send) await new Promise((resolve,reject) => process.send({success:true,metrics},error => error ? reject(error) : resolve()));
}
main().catch(() => {process.exitCode = 1;}).finally(() => {if (process.connected) process.disconnect();});
