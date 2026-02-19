import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { alertRulesRepo } from '@/repo/alert-rules'
import { useAlertRules } from './alert-rules-provider'
import { AlertRuleMutateDrawer } from './alert-rule-mutate-drawer'
import { AlertHistoryDialog } from './alert-history-dialog'

export function AlertRulesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useAlertRules()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: number) => alertRulesRepo.remove(id),
    onSuccess: async () => {
      toast.success('Alert rule deleted')
      setOpen(null)
      setCurrentRow(null)
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
  })

  return (
    <>
      {/* Create / Update Drawer */}
      <AlertRuleMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null)
            setCurrentRow(null)
          }
        }}
        currentRow={open === 'update' ? currentRow : null}
      />

      {/* History Dialog */}
      {currentRow && (
        <AlertHistoryDialog
          open={open === 'history'}
          onOpenChange={(v) => {
            if (!v) {
              setOpen(null)
              setCurrentRow(null)
            }
          }}
          rule={currentRow}
        />
      )}

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
          title='Delete Alert Rule'
          desc={`Are you sure you want to delete the alert rule "${currentRow.name}"? This action cannot be undone.`}
          confirmText='Delete'
          destructive
          handleConfirm={() => deleteMutation.mutate(currentRow.id)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </>
  )
}
