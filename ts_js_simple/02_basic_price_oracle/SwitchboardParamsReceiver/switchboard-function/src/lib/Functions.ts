import * as axios from "axios";
import { BigNumber } from "ethers";

interface HttpRequestOptions {
  url: string;
  method?: string;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  responseType?: "arraybuffer" | "document" | "json" | "text" | "stream";
}

export class Functions {
  static maxUint256 = BigInt(
    "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  );
  static maxPosInt256 = BigInt(
    "57896044618658097711785492504343953926634992332820282019728792003956564819967"
  );
  static maxNegInt256 = BigInt(
    "-57896044618658097711785492504343953926634992332820282019728792003956564819968"
  );
  readonly maxHttpRequests = 100;

  // The number of HTTP requests made by the user's code
  private totalHttpRequests = 0;
  public userHttpQueries = [];

  async makeHttpRequest({
    url,
    method = "GET",
    params,
    headers,
    data,
    timeout = 5000,
    responseType = "json",
  }: HttpRequestOptions) {
    if (this.totalHttpRequests < this.maxHttpRequests) {
      this.totalHttpRequests++;
      if (timeout > 9000) {
        throw new Error("HTTP request timeout >9000");
      }
      if (url.length > 2048) {
        throw new Error("HTTP request URL length >2048");
      }

      if (this.userHttpQueries.length > this.maxHttpRequests) {
        throw new Error("exceeded numAllowedQueries");
      }

      try {
        let result = await axios.default({
          method: method.toLowerCase(),
          url,
          params,
          headers,
          data,
          timeout,
          responseType,
        });

        // Delete the request to avoid exposing system information to the user's code
        delete result.request;
        delete result.config;
        return result;
      } catch (e) {
        return e;
      }
    }
    throw Error("exceeded numAllowedQueries");
  }

  static encodeUint256(result: number | bigint): BigNumber {
    if (typeof result === "number") {
      if (!Number.isInteger(result)) {
        throw Error("encodeUint256 invalid input");
      }
      if (result < 0) {
        throw Error("encodeUint256 invalid input");
      }
      return this.encodeUint256(BigInt(result));
    }
    if (typeof result === "bigint") {
      if (result > this.maxUint256) {
        throw Error("encodeUint256 invalid input");
      }
      if (result < BigInt(0)) {
        throw Error("encodeUint256 invalid input");
      }
      if (result === BigInt(0)) {
        return BigNumber.from(0);
      }
      return BigNumber.from(result);
    }
    throw Error("encodeUint256 invalid input");
  }

  static encodeInt256(result: number | bigint): BigNumber {
    if (typeof result === "number") {
      if (!Number.isInteger(result)) {
        throw Error("encodeInt256 invalid input");
      }
      return this.encodeInt256(BigInt(result));
    }
    if (typeof result !== "bigint") {
      throw Error("encodeInt256 invalid input");
    }
    if (result < this.maxNegInt256) {
      throw Error("encodeInt256 invalid input");
    }
    if (result > this.maxPosInt256) {
      throw Error("encodeInt256 invalid input");
    }
    if (result < BigInt(0)) {
      return this.encodeNegSignedInt(result);
    }
    return this.encodePosSignedInt(result);
  }

  static encodeString(result: string): string {
    return result;
  }

  static encodePosSignedInt(int: number | bigint): BigNumber {
    return BigNumber.from(int);
  }

  static encodeNegSignedInt(int: number | bigint): BigNumber {
    return BigNumber.from(int);
  }
}
