export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

let toasts = $state<Toast[]>([])

export function addToast(opts: { message: string; type?: ToastType; duration?: number }) {
  const id = crypto.randomUUID()
  toasts.push({ id, message: opts.message, type: opts.type ?? 'info' })
  setTimeout(() => removeToast(id), opts.duration ?? 4000)
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
}

export function getToasts(): Toast[] {
  return toasts
}
