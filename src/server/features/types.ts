import type { IFilesystem } from '../../shared/FilesystemProtocol'
import type { OhmLanguage } from '../OhmLanguage'

export interface FeatureContext {
  ohm: OhmLanguage
  fs: IFilesystem
}
