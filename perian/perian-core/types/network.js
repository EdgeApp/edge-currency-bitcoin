// @flow
import type { NetworkInfo } from '@perian/network-info'
import type { HDSettings } from './hd.js'

export type FullNetworkInfo = NetworkInfo & { hdSettings: HDSettings }
export type FullNetworkInfos = { [networkType: string]: FullNetworkInfo }
