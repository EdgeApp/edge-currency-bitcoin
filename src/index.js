// @flow

import { Socket } from 'net'
import { TLSSocket } from 'tls'

import { makeEdgeCorePlugins } from './plugin/currencyPlugin.js'

export default makeEdgeCorePlugins(({ io }) => ({ ...io, Socket, TLSSocket }))
