import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type AlertRule } from '../data/schema'

type AlertRulesDialogType = 'create' | 'update' | 'delete' | 'history'

interface AlertRulesContextType {
  open: AlertRulesDialogType | null
  setOpen: (str: AlertRulesDialogType | null) => void
  currentRow: AlertRule | null
  setCurrentRow: React.Dispatch<React.SetStateAction<AlertRule | null>>
}

const AlertRulesContext = React.createContext<AlertRulesContextType | null>(null)

export function AlertRulesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<AlertRulesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<AlertRule | null>(null)
  return (
    <AlertRulesContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </AlertRulesContext.Provider>
  )
}

export const useAlertRules = () => {
  const context = React.useContext(AlertRulesContext)
  if (!context) {
    throw new Error('useAlertRules has to be used within <AlertRulesProvider>')
  }
  return context
}
