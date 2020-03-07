// @flow

import { type Secp256k1 } from "../types/utils.js";
import { formatFunction } from "./formatter.js";
import { lazify } from "./require.js";

export const secp256k1: Secp256k1<Uint8Array> = (lazify(() =>
  require("secp256k1")
): any);

const encoder = {
  input: a => Buffer.from(a, "hex"),
  output: a => a.toString("hex")
};

export const publicKeyCreate = formatFunction(secp256k1.publicKeyCreate, {
  encoder
});
export const signatureNormalize = formatFunction(secp256k1.signatureNormalize, {
  encoder
});
export const signatureExport = formatFunction(secp256k1.signatureExport, {
  encoder
});
export const privateKeyTweakAdd = formatFunction(secp256k1.privateKeyTweakAdd, {
  encoder,
  numParams: 2
});
export const publicKeyTweakAdd = formatFunction(secp256k1.publicKeyTweakAdd, {
  encoder,
  numParams: 2
});
export const verify = formatFunction(secp256k1.verify, {
  encoder,
  numParams: 3,
  results: null
});
export const signature = formatFunction(secp256k1.sign, {
  encoder,
  numParams: 2,
  results: ["signature"]
});

export const sign = (message: string, privateKey: string) =>
  signature(message, privateKey)
    .then(({ signature }) => signature)
    .then(signatureNormalize)
    .then(signatureExport);
