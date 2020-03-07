// @flow

import { Socket } from "net";
import { TLSSocket } from "tls";

import { type EdgeIo } from "edge-core-js/types";

import {
  type EdgeSocket,
  type EdgeSocketOptions,
  type PluginIo
} from "../types/plugin.js";
import { makeEdgeCorePlugins } from "./plugin/currencyPlugin.js";
import { makeEdgeSocket } from "./plugin/pluginIo.js";

export function makeNodeIo(io: EdgeIo): PluginIo {
  return {
    ...io,
    makeSocket(opts: EdgeSocketOptions): Promise<EdgeSocket> {
      let socket: net$Socket;
      if (opts.type === "tcp") socket = new Socket();
      else if (opts.type === "tls") socket = new TLSSocket(new Socket());
      else throw new Error("Unsupported socket type");

      return Promise.resolve(makeEdgeSocket(socket, opts));
    }
  };
}

const edgeCorePlugins = makeEdgeCorePlugins(opts => makeNodeIo(opts.io));

export default edgeCorePlugins;
