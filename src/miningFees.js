/**
 * Created by Paul Puey on 2017/11/09
 * @flow
 */

import type { EarnComFees, BitcoinFees } from './flowTypes.js'
import { EarnComFeesSchema } from './jsonSchemas.js'
import { bns } from 'biggystring'
import { validateObject } from './utils.js'

export const ES_FEE_LOW = 'low'
export const ES_FEE_STANDARD = 'standard'
export const ES_FEE_HIGH = 'high'
export const ES_FEE_CUSTOM = 'custom'

const MAX_FEE = 999999999.0
const MAX_STANDARD_DELAY = 12
const MIN_STANDARD_DELAY = 3

/**
 * Calculate the BitcoinFees struct given a default BitcoinFees struct and EarnComFees
 * @param bitcoinFees
 * @param earnComFees
 * @returns {BitcoinFees}
 */
export function calcFeesFromEarnCom (
  bitcoinFees: BitcoinFees,
  earnComFeesJson: any
): BitcoinFees {
  let highDelay = 999999
  let lowDelay = 0
  let highFee = MAX_FEE
  let standardFeeHigh
  let standardFeeLow = MAX_FEE
  let lowFee = MAX_FEE

  const valid = validateObject(earnComFeesJson, EarnComFeesSchema)
  if (!valid) {
    return bitcoinFees
  }

  const earnComFees: EarnComFees = earnComFeesJson
  for (const fee of earnComFees.fees) {
    const p = `minFee:${fee.minFee},maxFee:${fee.maxFee},minDelay:${
      fee.minDelay
    },maxDelay:${fee.maxDelay},minMinutes:${fee.minMinutes},maxMinutes:${
      fee.maxMinutes
    }`
    console.log(p)

    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }

    // Set the lowFee if the delay in blocks and minutes is less that 10000.
    // 21.co uses 10000 to mean infinite
    if (fee.maxDelay < 10000 && fee.maxMinutes < 10000) {
      if (fee.maxFee < lowFee) {
        // Set the low fee if the current fee estimate is lower than the previously set low fee
        lowDelay = fee.maxDelay
        lowFee = fee.maxFee
      }
    }

    // Set the high fee only if the delay is 0
    if (fee.maxDelay === 0) {
      if (fee.maxFee < highFee) {
        // Set the low fee if the current fee estimate is lower than the previously set high fee
        highFee = fee.maxFee
        highDelay = fee.maxDelay
      }
    }
  }

  // Now find the standard fee range. We want the range to be within a maxDelay of
  // 3 to 18 blocks (about 30 mins to 3 hours). The standard fee at the low end should
  // have a delay less than the lowFee from above. The standard fee at the high end
  // should have a delay that's greater than the highFee from above.
  for (const fee of earnComFees.fees) {
    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }

    if (fee.maxDelay < lowDelay && fee.maxDelay <= MAX_STANDARD_DELAY) {
      if (standardFeeLow > fee.minFee) {
        standardFeeLow = fee.minFee
      }
    }
  }

  // Go backwards looking for lowest standardFeeHigh that:
  // 1. Is < highFee
  // 2. Has a blockdelay > highDelay
  // 3. Has a delay that is > MIN_STANDARD_DELAY
  // Use the highFee as the default standardHighFee
  standardFeeHigh = highFee
  for (let i = earnComFees.fees.length - 1; i >= 0; i--) {
    const fee = earnComFees.fees[i]

    if (i < 0) {
      break
    }

    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }

    // Dont ever go below standardFeeLow
    if (fee.maxFee <= standardFeeLow) {
      break
    }

    if (fee.maxDelay > highDelay) {
      standardFeeHigh = fee.maxFee
    }

    // If we have a delay that's greater than MIN_STANDARD_DELAY, then we're done.
    // Otherwise we'd be getting bigger delays and further reducing fees.
    if (fee.maxDelay > MIN_STANDARD_DELAY) {
      break
    }
  }

  //
  // Check if we have a complete set of fee info.
  //
  if (
    highFee < MAX_FEE &&
    lowFee < MAX_FEE &&
    standardFeeHigh > 0 &&
    standardFeeLow < MAX_FEE
  ) {
    const out: BitcoinFees = bitcoinFees

    // Overwrite the fees with those from earn.com
    out.lowFee = lowFee.toFixed(0)
    out.standardFeeLow = standardFeeLow.toFixed(0)
    out.standardFeeHigh = standardFeeHigh.toFixed(0)
    out.highFee = highFee.toFixed(0)

    return out
  } else {
    return bitcoinFees
  }
}

/**
 * Calculate the sat/byte mining fee given an amount to spend and a BitcoinFees struct
 * @param nativeAmount
 * @param feeOption
 * @param customFee
 * @param bitcoinFees
 * @returns {string}
 */
export function calcMinerFeePerByte (
  nativeAmount: string,
  feeOption: string,
  customFee: string,
  bitcoinFees: BitcoinFees
): string {
  let satoshiPerByteFee: string = customFee
  switch (feeOption) {
    case ES_FEE_LOW:
      satoshiPerByteFee = bitcoinFees.lowFee
      break
    case ES_FEE_STANDARD:
      if (bns.gte(nativeAmount, bitcoinFees.standardFeeHighAmount)) {
        satoshiPerByteFee = bitcoinFees.standardFeeHigh
        break
      }
      if (bns.lte(nativeAmount, bitcoinFees.standardFeeLowAmount)) {
        satoshiPerByteFee = bitcoinFees.standardFeeLow
        break
      }

      // Scale the fee by the amount the user is sending scaled between standardFeeLowAmount and standardFeeHighAmount
      const lowHighAmountDiff = bns.sub(
        bitcoinFees.standardFeeHighAmount,
        bitcoinFees.standardFeeLowAmount
      )
      const lowHighFeeDiff = bns.sub(
        bitcoinFees.standardFeeHigh,
        bitcoinFees.standardFeeLow
      )

      // How much above the lowFeeAmount is the user sending
      const amountDiffFromLow = bns.sub(
        nativeAmount,
        bitcoinFees.standardFeeLowAmount
      )

      // Add this much to the low fee = (amountDiffFromLow * lowHighFeeDiff) / lowHighAmountDiff)
      const temp1 = bns.mul(amountDiffFromLow, lowHighFeeDiff)
      const addFeeToLow = bns.div(temp1, lowHighAmountDiff)
      satoshiPerByteFee = bns.add(bitcoinFees.standardFeeLow, addFeeToLow)
      break
    case ES_FEE_HIGH:
      satoshiPerByteFee = bitcoinFees.highFee
      break
    case ES_FEE_CUSTOM:
      break
    default:
      throw new Error('Invalid networkFeeOption:' + feeOption)
  }
  return satoshiPerByteFee
}
