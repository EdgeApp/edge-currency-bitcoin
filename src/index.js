// @flow

import { crypto } from 'bcoin'
import { type EdgeIo } from 'edge-core-js/types'
import { Socket } from 'net'
import { TLSSocket } from 'tls'

import { makeEdgeCorePlugins } from './plugin/currencyPlugin.js'
import {
  type EdgeSocket,
  type EdgeSocketOptions,
  type PluginIo,
  type SigmaMint,
  type SigmaMintOptions,
  type SigmaSpendOptions,
  makeEdgeSocket
} from './plugin/pluginIo.js'

export function makeNodeIo(io: EdgeIo): PluginIo {
  const { secp256k1, pbkdf2 } = crypto
  return {
    ...io,
    pbkdf2,
    secp256k1,
    makeSocket(opts: EdgeSocketOptions): Promise<EdgeSocket> {
      let socket: net$Socket
      if (opts.type === 'tcp') socket = new Socket()
      else if (opts.type === 'tls') socket = new TLSSocket(new Socket())
      else throw new Error('Unsupported socket type')

      return Promise.resolve(makeEdgeSocket(socket, opts))
    },
    sigmaMint(opts: SigmaMintOptions): Promise<SigmaMint> {
      return Promise.resolve({
        commitment: 'commitment',
        serialNumber: 'serialNumber'
      })
    },
    sigmaSpend(opts: SigmaSpendOptions): Promise<string> {
      return Promise.resolve('proof')
    }
  }
}

const edgeCorePlugins = makeEdgeCorePlugins(opts => makeNodeIo(opts.io))

export default edgeCorePlugins
