// @flow

const QUEUE_JOBS_PER_RUN = 8
const QUEUE_RUN_DELAY = 25

type UpdateQueue = {
  id: string,
  action: string,
  updateFunc: Function
}

const updateQueue: Array<UpdateQueue> = []

export function pushUpdate (update: UpdateQueue) {
  let didUpdate = false
  for (const u of updateQueue) {
    if (u.id === update.id && u.action === update.action) {
      u.updateFunc = update.updateFunc
      didUpdate = true
      break
    }
  }
  if (!didUpdate) {
    updateQueue.push(update)
  }
}

export function removeIdFromQueue (id: string) {
  for (let i = 0; i < updateQueue.length; i++) {
    const update = updateQueue[i]
    if (id === update.id) {
      updateQueue.splice(i, 1)
      break
    }
  }
}

function startQueue () {
  setTimeout(() => {
    const numJobs =
      QUEUE_JOBS_PER_RUN < updateQueue.length
        ? QUEUE_JOBS_PER_RUN
        : updateQueue.length
    if (numJobs) console.log('Bitcoin Queue running more jobs...')
    for (let i = 0; i < numJobs; i++) {
      if (updateQueue.length) {
        const u = updateQueue.shift()
        console.log(`Bitcoin Job: ${u.id} ${u.action}`)
        u.updateFunc()
      }
    }
    startQueue()
  }, QUEUE_RUN_DELAY)
}

startQueue()
