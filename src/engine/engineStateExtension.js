// @flow

import type { StratumTask } from '../stratum/stratumConnection'
import { EngineState } from './engineState'

export interface EngineStateExtension {
  +load: (engineState: EngineState) => Promise<void>;
  +getBalance?: (options: any) => string;
  +dumpData?: () => any;
  +pickNextTask?: (uri: string, stratumVersion: string) => StratumTask | void;
}
