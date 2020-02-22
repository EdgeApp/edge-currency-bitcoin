// @flow
// The native code will use this file to set up the IO object
// before sending it across the bridge to the core side.

import { pbkdf2, secp256k1 } from 'react-native-fast-crypto'
import { Socket } from 'react-native-tcp'
import { bridgifyObject } from 'yaob'
import { type EdgeCorePluginOptions } from 'edge-core-js/types'

import {
  type EdgeSocket,
  type EdgeSocketOptions,
  type ExtraIo
} from '../types/plugin.js'
import { makeEdgeSocket } from './plugin/pluginIo.js'

type FetchJson = (uri: string, opts?: Object) => Object

function makeFetchJson (io): FetchJson {
  return function fetchJson (uri, opts) {
    return io.fetch(uri, opts).then(reply => {
      if (!reply.ok) {
        throw new Error(`Error ${reply.status} while fetching ${uri}`)
      }
      return reply.json()
    })
  }
}

export function getFetchJson (opts: EdgeCorePluginOptions): FetchJson {
  const nativeIo = opts.nativeIo['edge-currency-bitcoin']
  return nativeIo != null ? nativeIo.fetchJson : makeFetchJson(opts.io)
}

export default function makeCustomIo (): ExtraIo {
  bridgifyObject(pbkdf2)
  bridgifyObject(secp256k1)

  return {
    pbkdf2,
    secp256k1,
    fetchJson: makeFetchJson(window),
    makeSocket (opts: EdgeSocketOptions): Promise<EdgeSocket> {
      let socket: net$Socket
      if (opts.type === 'tcp') socket = new Socket()
      else if (opts.type === 'tls') throw new Error('No TLS support')
      else throw new Error('Unsupported socket type')

      return Promise.resolve(makeEdgeSocket(socket, opts))
    }
  }
}
