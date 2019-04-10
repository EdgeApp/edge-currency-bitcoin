/**
 * Created by Paul Puey on 2017/11/09
 * @flow
 */

import { bns } from 'biggystring'

import { type BitcoinFees, type EarnComFee } from '../utils/flowTypes.js'

export const ES_FEE_LOW = 'low'
export const ES_FEE_STANDARD = 'standard'
export const ES_FEE_HIGH = 'high'
export const ES_FEE_CUSTOM = 'custom'

const HIGH_STANDARD_DELAY = 4
const LOW_STANDARD_DELAY = 2
const MAX_ALLOWABLE_DELAY = 10000
const MIN_ALLOWABLE_DELAY = 1
const MIN_FEE = 0

/**
 * Calculate the BitcoinFees object given a default BitcoinFees object and EarnComFees
 * @param bitcoinFees
 * @param earnComFees
 * @returns {BitcoinFees}
 */
export function calcFeesFromEarnCom (
  fees?: Array<EarnComFee> | null
): $Shape<BitcoinFees> {
  if (!fees || !fees.length) return {}

  // Keep only the fees that has an estimatation BIGGER then MIN_FEE
  fees = fees.filter(
    ({ maxFee, minFee }) => maxFee > MIN_FEE && minFee > MIN_FEE
  )

  /**
   * Finds and returns appropriate fee option for a given condition
   * @param delay: number or function - number is target delay, function can be custom condition
   * @param sortKey: criteria to use for select best choice from relevant list of fees
   * @returns EarnComFee
   */

  const calcEarnFee = (delay, sortKey) => {
    const condition = fee =>
      typeof delay !== 'function' ? fee.maxDelay < delay : delay(fee)
    const compare = (a, b) => a[sortKey] - b[sortKey]
    const earnFee = (fees: any).filter(condition).sort(compare)[0]
    return { ...earnFee, feeString: earnFee[sortKey].toFixed(0) }
  }

  // Calculate the lowFee
  const lowFee = calcEarnFee(MAX_ALLOWABLE_DELAY, 'maxFee')
  // Calculate the highFee
  const highFee = calcEarnFee(MIN_ALLOWABLE_DELAY, 'minFee')
  // The low end should have a delay less than the lowFee from above and a maxDelay of MAX_STANDARD_DELAY.
  const standardFeeLow = calcEarnFee(
    Math.min(HIGH_STANDARD_DELAY, lowFee.maxDelay),
    'minFee'
  )
  // The high end should have a delay that's greater than the highFee from above and a maxDelay of MIN_STANDARD_DELAY.
  const standardFeeHigh = calcEarnFee(
    fee =>
      fee.maxDelay < LOW_STANDARD_DELAY && fee.maxFee > standardFeeLow.minFee,
    'maxFee'
  )

  return {
    lowFee: lowFee.feeString,
    highFee: highFee.feeString,
    standardFeeLow: standardFeeLow.feeString,
    standardFeeHigh: standardFeeHigh.feeString
  }
}

/**
 * Calculate the sat/byte mining fee given an amount to spend and a BitcoinFees object
 * @param nativeAmount
 * @param feeOption
 * @param customFee
 * @param bitcoinFees
 * @returns {string}
 */
export function calcMinerFeePerByte (
  nativeAmount: string,
  feeOption: string,
  bitcoinFees: BitcoinFees,
  customFee: string = '0'
): string {
  if (feeOption === ES_FEE_CUSTOM && customFee !== '0') return customFee
  let satoshiPerByteFee: string = '0'
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
    default:
      throw new Error(
        `Invalid networkFeeOption: ${feeOption}, And/Or customFee: ${customFee}`
      )
  }
  return satoshiPerByteFee
}
