import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { dataCatalogRepo } from '@/repo/data-catalog'
import { useDataCatalog } from './data-catalog-provider'
import { DataCatalogMutateDrawer } from './data-catalog-mutate-drawer'

export function DataCatalogDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useDataCatalog()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dataCatalogRepo.remove(id),
    onSuccess: async () => {
      toast.success('Catalog entry deleted')
      setOpen(null)
      setCurrentRow(null)
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['data-catalog'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete catalog entry')
    },
  })

  return (
    <>
      {/* Create / Update Drawer */}
      <DataCatalogMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null)
            setCurrentRow(null)
          }
        }}
        currentRow={open === 'update' ? currentRow : null}
      />

      {/* Delete Confirmation */}
      {currentRow && (
        <ConfirmDialog
          open={open === 'delete'}
          onOpenChange={(v) => {
            if (!v) {
              setOpen(null)
              setCurrentRow(null)
            }
          }}
          title='Delete Catalog Entry'
          desc={`Are you sure you want to delete the catalog entry for "${currentRow.schema_name}.${currentRow.table_name}"? This will also remove all associated data dictionary columns.`}
          confirmText='Delete'
          destructive
          handleConfirm={() => deleteMutation.mutate(currentRow.id)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </>
  )
}
