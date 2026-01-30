import { workspace } from 'vscode'

const ConfigSection = 'ohm-js'

export const ConfigKey = {
  validator: 'validator',
} as const

export function getConfigKeyString(key: string) {
  return `${ConfigSection}.${key}`
}

export interface ValidatorMatchConfig {
  match: string[]
  grammar: string
}

export interface OhmConfiguration {
  [ConfigKey.validator]: ValidatorMatchConfig[]
}

export function getConfig<key extends keyof OhmConfiguration>(key: key) {
  return workspace
    .getConfiguration(ConfigSection)
    .get<OhmConfiguration[key]>(key)
}
