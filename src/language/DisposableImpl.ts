import type { Disposable } from 'vscode'

export class DisposableImpl implements Disposable {
  _subscribers = new Set<Disposable>()

  subscribe(t: Disposable) {
    this._subscribers.add(t)
  }

  dispose() {
    this._subscribers.forEach((item) => item.dispose())
  }
}
