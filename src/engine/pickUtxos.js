/**
 * Created by Paul Puey 2017/11/09.
 * @flow
 */

import coinselect from "coinselect";

import {
  type AddressInfo,
  type AddressInfos,
  type UtxoInfo
} from "../../types/engine.js";

interface BjsUtxo {
  txId: string;
  vout: number;
  value: number;
}

export function pickUtxos(
  addressInfos: AddressInfos,
  // headerCache: HeaderCache,
  amountSatoshi: number,
  useOnlyConfirmed: boolean = true
) {
  // Build single list of utxos into an array
  const utxosConfirmed: Array<BjsUtxo> = [];
  const utxosAll: Array<BjsUtxo> = [];
  // Loop over all addresses
  for (const scriptHash in addressInfos) {
    if (addressInfos.hasOwnProperty(scriptHash)) {
      // Loop over all utxos in an address
      const addressObj: AddressInfo = addressInfos[scriptHash];
      for (const utxo: UtxoInfo of addressObj.utxos) {
        // TODO: Need to actually find out if this is confirmed
        const confirmed: boolean = true;
        const bjsUtxo: BjsUtxo = utxoEdgeToBjs(utxo);
        utxosAll.push(bjsUtxo);
        if (confirmed) {
          utxosConfirmed.push(bjsUtxo);
        }
      }
    }
  }

  const targets = [
    {
      address: "1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm", // Fake address
      value: amountSatoshi
    }
  ];
  let out: Array<UtxoInfo> = [];

  // Try unconfirmed funds first
  let selectObj = coinselect(utxosConfirmed, targets, 0);
  if (selectObj.inputs && selectObj.outputs) {
    out = arrayUtxoBjsToEdge(selectObj.inputs);
  } else if (!useOnlyConfirmed) {
    selectObj = coinselect(utxosAll, targets, 0);
    if (selectObj.inputs && selectObj.outputs) {
      out = arrayUtxoBjsToEdge(selectObj.inputs);
    }
  }
  return out;
}

function arrayUtxoBjsToEdge(bjsUtxos: Array<BjsUtxo>): Array<UtxoInfo> {
  const utxos: Array<UtxoInfo> = [];
  for (const bjsUtxo of bjsUtxos) {
    utxos.push(utxoBjsToEdge(bjsUtxo));
  }
  return utxos;
}

function utxoBjsToEdge(bjsUtxo: BjsUtxo) {
  const utxoObj: UtxoInfo = {
    txid: bjsUtxo.txId,
    index: bjsUtxo.vout,
    value: bjsUtxo.value
  };
  return utxoObj;
}

function utxoEdgeToBjs(utxo: UtxoInfo): BjsUtxo {
  const bjsUtxo: BjsUtxo = {
    txId: utxo.txid,
    vout: utxo.index,
    value: utxo.value
  };
  return bjsUtxo;
}
