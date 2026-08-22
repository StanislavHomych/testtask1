import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface PromptDialogProps {
  open: boolean
  title: string
  description?: string
  label: string
  initialValue?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: (value: string) => void
  onClose: () => void
}

export function PromptDialog({
  open,
  title,
  description,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [seed, setSeed] = useState(initialValue)
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValue(initialValue)
      setSeed(initialValue)
    }
  } else if (open && initialValue !== seed) {
    setSeed(initialValue)
    setValue(initialValue)
  }

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form="vault-prompt-form"
            disabled={busy || !value.trim()}
          >
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id="vault-prompt-form"
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = value.trim()
          if (!next) {
            return
          }
          onConfirm(next)
        }}
      >
        <label
          htmlFor="vault-prompt-input"
          className="block text-sm font-semibold text-ink"
        >
          {label}
        </label>
        <Input
          id="vault-prompt-input"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </form>
    </Dialog>
  )
}
