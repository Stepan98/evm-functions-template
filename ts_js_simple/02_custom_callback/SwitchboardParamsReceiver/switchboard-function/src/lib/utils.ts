import * as ethCrypto from "eth-crypto";

export enum Location_ {
  Inline,
  // Add other location options if needed
}

export enum CodeLanguage {
  JavaScript,
  Typescript,
  // Add other code language options if needed
}

export interface Config {
  codeLocation: Location_;
  codeLanguage: CodeLanguage;
  source: string;
  numAllowedQueries?: number;
  secrets?: Record<string, string>;
  secretsURLs?: string[];
  walletPrivateKey?: string;
  DONPublicKey?: string;
  args?: string[];
  maxResponseBytes?: number;
  expectedReturnType?: string;
}

export function getRequestConfig(unvalidatedConfig: Config): Config {
  const config: Config = { ...unvalidatedConfig };

  if (typeof config.source !== "string") {
    throw new Error(`source is not correctly specified in config`);
  }

  if (
    (config.secrets && config.secrets.length) ||
    (config.secretsURLs && config.secretsURLs.length)
  ) {
    throw new Error("SecretsURLs is not supported yet");
  }

  if (config.args) {
    if (!Array.isArray(config.args)) {
      throw new Error(`args array is not correctly specified in config`);
    }
    for (const arg of config.args) {
      if (typeof arg !== "string") {
        throw new Error(
          `an element of the args array is not a string in config`
        );
      }
    }
  }

  if (config.maxResponseBytes !== undefined) {
    if (
      typeof config.maxResponseBytes !== "number" ||
      !Number.isInteger(config.maxResponseBytes)
    ) {
      throw new Error(`maxResponseBytes is not correctly specified in config`);
    }
  }

  if (config.expectedReturnType) {
    switch (config.expectedReturnType) {
      case "uint256":
      case "int256":
      case "string":
      case "Buffer":
        break;
      default:
        throw new Error(
          `expectedReturnType is not correctly specified in config`
        );
    }
  }

  return config;
}

export async function encryptWithSignature(
  signerPrivateKey: string,
  readerPublicKey: string,
  message: string
): Promise<string> {
  const signature = ethCrypto.sign(
    signerPrivateKey,
    ethCrypto.hash.keccak256(message)
  );

  const payload = {
    message,
    signature,
  };

  return await encrypt(readerPublicKey, JSON.stringify(payload));
}

export async function encrypt(
  readerPublicKey: string,
  message: string
): Promise<string> {
  const encrypted = await ethCrypto.encryptWithPublicKey(
    readerPublicKey,
    message
  );

  return ethCrypto.cipher.stringify(encrypted);
}
