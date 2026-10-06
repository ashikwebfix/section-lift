const crypto = require('crypto');

let aCount = 0;
let bCount = 0;
const testId = '0aed3435-8e58-4789-be93-21e4024b7ffd';

for (let i = 0; i < 1000; i++) {
  const visitorId = 'v_' + Math.random().toString(36).substr(2, 9);
  const hash = crypto.createHash("md5").update(`${visitorId}-${testId}`).digest("hex");
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const randomPercentage = hashInt % 100;
  
  if (randomPercentage < 50) {
    bCount++;
  } else {
    aCount++;
  }
}
console.log(`A: ${aCount}, B: ${bCount}`);
