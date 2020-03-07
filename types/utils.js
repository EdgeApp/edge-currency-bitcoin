// @flow

export type SaveCache = (
  fileName: string,
  data: Object,
  cacheDirty?: boolean
) => Promise<boolean>
