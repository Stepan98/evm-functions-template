const orderId = args[0];
const sender = args[1];

const val = crypto.randomBytes(32);
const bn = BigInt(`0x${val.toString("hex")}`);

const blockedAddresses = [
  "0x0",
]

// this will resolve the order without producing a value for the user
if (blockedAddresses.includes(sender)) {
  throw new Error("Sender is blocked");
}

// check if orderId is valid
if (parseInt(orderId) < 0) {
  throw new Error("Invalid orderId");
}

// Supply a random value to resolve this user/contract (sender's) number request
Functions.encodeUint256(bn);
