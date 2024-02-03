import Localdrive from 'localdrive'
import { ROOT } from './constants.js'

export default async function createPlatformDrive () {
  const drive = new Localdrive(ROOT)
  return drive
}

