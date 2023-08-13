const fs = require("fs");
const path = require("path");

const Location = {
  Inline: 0,
  Remote: 1,
};

const CodeLanguage = {
  JavaScript: 0,
  Typescript: 1,
};

const ReturnType = {
  uint: "uint256",
  uint256: "uint256",
  int: "int256",
  int256: "int256",
  string: "string",
  bytes: "Buffer",
  Buffer: "Buffer",
};

// Configure the request by setting the fields below
const requestConfig = {
  codeLocation: Location.Inline,
  codeLanguage: CodeLanguage.Typescript,
  walletPrivateKey: process.env.PRIVATE_KEY,
  secretsURLs: [],
  source: fs.readFileSync(path.join(__dirname, "./main.js")).toString(),
  args: [],
  expectedReturnType: ReturnType.uint256,
  secrets: {},
  perNodeSecrets: [],
};

module.exports = requestConfig;
