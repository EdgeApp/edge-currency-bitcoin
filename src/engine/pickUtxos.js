/**
 * Created by Paul Puey 2017/11/09.
 * @flow
 */

import type { AddressInfos, AddressInfo, UtxoInfo } from './engineState.js'
// import type { HeaderCache } from './pluginState.js'
import coinselect from 'coinselect'

interface BjsUtxo {
  txId: string;
  vout: number;
  value: number;
}

export function pickUtxos (
  addressCache: AddressInfos,
  // headerCache: HeaderCache,
  amountSatoshi: number,
  useOnlyConfirmed: boolean = true
) {
  // Build single list of utxos into an array
  const utxosConfirmed: Array<BjsUtxo> = []
  const utxosAll: Array<BjsUtxo> = []
  // Loop over all addresses
  for (const scriptHash in addressCache) {
    if (addressCache.hasOwnProperty(scriptHash)) {
      // Loop over all utxos in an address
      const addressObj: AddressInfo = addressCache[scriptHash]
      for (const utxo: UtxoInfo of addressObj.utxos) {
        // TODO: Need to actually find out if this is confirmed
        const confirmed: boolean = true
        const bjsUtxo: BjsUtxo = utxoAbcToBjs(utxo)
        utxosAll.push(bjsUtxo)
        if (confirmed) {
          utxosConfirmed.push(bjsUtxo)
        }
      }
    }
  }

  const targets = [
    {
      address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm', // Fake address
      value: amountSatoshi
    }
  ]
  let out: Array<UtxoInfo> = []

  // Try unconfirmed funds first
  let selectObj = coinselect(utxosConfirmed, targets, 0)
  if (selectObj.inputs && selectObj.outputs) {
    out = arrayUtxoBjsToAbc(selectObj.inputs)
  } else if (!useOnlyConfirmed) {
    selectObj = coinselect(utxosAll, targets, 0)
    if (selectObj.inputs && selectObj.outputs) {
      out = arrayUtxoBjsToAbc(selectObj.inputs)
    }
  }
  return out
}

function arrayUtxoBjsToAbc (bjsUtxos: Array<BjsUtxo>): Array<UtxoInfo> {
  const utxos: Array<UtxoInfo> = []
  for (const bjsUtxo of bjsUtxos) {
    utxos.push(utxoBjsToAbc(bjsUtxo))
  }
  return utxos
}

function utxoBjsToAbc (bjsUtxo: BjsUtxo) {
  const utxoObj: UtxoInfo = {
    txid: bjsUtxo.txId,
    index: bjsUtxo.vout,
    value: bjsUtxo.value
  }
  return utxoObj
}

function utxoAbcToBjs (utxo: UtxoInfo): BjsUtxo {
  const bjsUtxo: BjsUtxo = {
    txId: utxo.txid,
    vout: utxo.index,
    value: utxo.value
  }
  return bjsUtxo
}
