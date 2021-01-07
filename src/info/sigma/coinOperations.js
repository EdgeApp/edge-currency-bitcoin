// @flow

import { bns } from 'biggystring'
import { InsufficientFundsError } from 'edge-core-js/types'

import { type PrivateCoin, DENOMINATIONS } from '../zcoins'

const getRequiredMintCountForValue = (value: string): number => {
  let result = 0
  for (let i = DENOMINATIONS.length - 1; i >= 0; --i) {
    while (bns.gte(value, DENOMINATIONS[i])) {
      value = bns.sub(value, DENOMINATIONS[i])
      result++
    }
  }

  return result
}

// we will try to minimize sum of mints to use and new mints to be created
export const getMintsToSpend = (
  approvedMints: PrivateCoin[],
  spendValue: string
): PrivateCoin[] => {
  // calculate required and max check values in count of min denom
  const minValueCoin = DENOMINATIONS[0]
  const minValueCoinNumber = parseInt(DENOMINATIONS[0])
  const minValueCoinsRequiredStr = bns.div(spendValue, minValueCoin)
  let minValueCoinsRequired = parseInt(minValueCoinsRequiredStr)
  if (bns.gt(spendValue, bns.mul(minValueCoinsRequiredStr, minValueCoin))) {
    minValueCoinsRequired += 1
  }
  const maxCheckValue =
    minValueCoinsRequired +
    parseInt(DENOMINATIONS[DENOMINATIONS.length - 1]) / minValueCoinNumber

  // sort approved mints in value descending order and if value is same than sort in index descending order
  approvedMints.sort((c1, c2) => {
    if (c1.value !== c2.value) {
      return c2.value - c1.value
    }

    return c2.index - c1.index
  })

  // knapsack algorithm two rows
  const bigNumber = 1000000000
  let prevRow = new Array(maxCheckValue + 1)
  let nextRow = new Array(maxCheckValue + 1)
  const mintIndexRow = new Array(maxCheckValue + 1)

  nextRow.fill(bigNumber)
  nextRow[0] = prevRow[0] = 0
  let currentMintIndex = approvedMints.length - 1
  if (currentMintIndex >= 0) {
    nextRow[approvedMints[currentMintIndex].value / minValueCoinNumber] = 1
    mintIndexRow[
      approvedMints[currentMintIndex].value / minValueCoinNumber
    ] = currentMintIndex
    --currentMintIndex
  }

  // run knapsack algorithm and try to minimize total weight for each value: weight is 1 for all mints
  for (; currentMintIndex >= 0; --currentMintIndex) {
    // swap rows
    const temp = prevRow
    prevRow = nextRow
    nextRow = temp

    // get current value
    const currentValue =
      approvedMints[currentMintIndex].value / minValueCoinNumber
    for (let j = 1; j <= maxCheckValue; ++j) {
      nextRow[j] = prevRow[j]
      if (j >= currentValue && nextRow[j] > prevRow[j - currentValue] + 1) {
        nextRow[j] = prevRow[j - currentValue] + 1
        mintIndexRow[j] = currentMintIndex
      }
    }
  }

  // find best spend value
  let bestSpendValue = maxCheckValue
  let index = maxCheckValue
  let currentMin = bigNumber
  while (index >= minValueCoinsRequired) {
    const newMin =
      nextRow[index] +
      getRequiredMintCountForValue(
        bns.mul((index - minValueCoinsRequired).toString(), minValueCoin)
      )
    if (currentMin > newMin && nextRow[index] !== bigNumber) {
      bestSpendValue = index
      currentMin = newMin
    }
    --index
  }
  if (currentMin === bigNumber) {
    throw new InsufficientFundsError()
  }

  // fill mints to spend
  const mintsToBeSpend: PrivateCoin[] = []
  while (bestSpendValue > 0) {
    const mintToSpend = approvedMints[mintIndexRow[bestSpendValue]]
    mintsToBeSpend.push(mintToSpend)
    bestSpendValue -= mintToSpend.value / minValueCoinNumber
  }
  return mintsToBeSpend
}
