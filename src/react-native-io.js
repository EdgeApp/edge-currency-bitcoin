// @flow
// The native code will use this file to set up the IO object
// before sending it across the bridge to the core side.

import { pbkdf2, secp256k1 } from 'react-native-fast-crypto'
import { Socket } from 'react-native-tcp'
import RNZcoinSigma from 'react-native-zcoin-sigma'
import { bridgifyObject } from 'yaob'

import {
  type EdgeSocket,
  type EdgeSocketOptions,
  type ExtraIo,
  type SigmaMint,
  type SigmaMintOptions,
  type SigmaSpendOptions,
  makeEdgeSocket
} from './plugin/pluginIo.js'

export default function makeCustomIo(): ExtraIo {
  bridgifyObject(pbkdf2)
  bridgifyObject(secp256k1)

  return {
    pbkdf2,
    secp256k1,
    makeSocket(opts: EdgeSocketOptions): Promise<EdgeSocket> {
      let socket: net$Socket
      if (opts.type === 'tcp') socket = new Socket()
      else if (opts.type === 'tls') throw new Error('No TLS support')
      else throw new Error('Unsupported socket type')

      return Promise.resolve(makeEdgeSocket(socket, opts))
    },
    sigmaMint(opts: SigmaMintOptions): Promise<SigmaMint> {
      return new Promise((resolve, reject) => {
        RNZcoinSigma.getMintCommitment(
          opts.denomination,
          opts.privateKey,
          opts.index,
          (commitment, serialNumber) => {
            resolve({ commitment, serialNumber })
          }
        )
      })
    },
    sigmaSpend(opts: SigmaSpendOptions): Promise<string> {
      return new Promise((resolve, reject) => {
        RNZcoinSigma.getSpendProof(
          opts.denomination,
          opts.privateKey,
          opts.index,
          opts.anonymitySet,
          opts.groupId,
          opts.blockHash,
          opts.txHash,
          proof => {
            resolve(proof)
          }
        )
      })
    }
  }
}
