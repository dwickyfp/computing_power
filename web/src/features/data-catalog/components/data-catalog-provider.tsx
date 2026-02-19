import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type DataCatalog } from '../data/schema'

type DataCatalogDialogType = 'create' | 'update' | 'delete'

interface DataCatalogContextType {
  open: DataCatalogDialogType | null
  setOpen: (str: DataCatalogDialogType | null) => void
  currentRow: DataCatalog | null
  setCurrentRow: React.Dispatch<React.SetStateAction<DataCatalog | null>>
}

const DataCatalogContext = React.createContext<DataCatalogContextType | null>(
  null
)

export function DataCatalogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<DataCatalogDialogType>(null)
  const [currentRow, setCurrentRow] = useState<DataCatalog | null>(null)
  return (
    <DataCatalogContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </DataCatalogContext.Provider>
  )
}

export const useDataCatalog = () => {
  const context = React.useContext(DataCatalogContext)
  if (!context) {
    throw new Error(
      'useDataCatalog has to be used within <DataCatalogProvider>'
    )
  }
  return context
}
