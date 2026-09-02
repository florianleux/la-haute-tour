import { createDatabase, setDatabase } from '../db/client'

export default defineNitroPlugin(async () => {
  setDatabase(await createDatabase())
})
