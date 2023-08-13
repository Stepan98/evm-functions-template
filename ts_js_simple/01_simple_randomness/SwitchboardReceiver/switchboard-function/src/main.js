const val = crypto.randomBytes(32);
const bn = BigInt(`0x${val.toString("hex")}`);

// Supply a random value
Functions.encodeUint256(bn);
