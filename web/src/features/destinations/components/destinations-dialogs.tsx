import { ConfirmDialog } from '@/components/confirm-dialog'
import { DestinationsMutateDrawer } from './destinations-mutate-drawer'
import { useDestinations } from './destinations-provider'
import { destinationsRepo } from '@/repo/destinations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function DestinationsDialogs() {
    const { open, setOpen, currentRow, setCurrentRow } = useDestinations()
    const queryClient = useQueryClient()

    const deleteMutation = useMutation({
        mutationFn: destinationsRepo.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['destinations'] })
            setOpen(null)
            setTimeout(() => {
                setCurrentRow(null)
            }, 500)
            toast.success('Destination deleted successfully')
        },
        onError: (error) => {
            toast.error('Failed to delete destination')
            console.error(error)
        }
    })

    return (
        <>
            <DestinationsMutateDrawer
                key='destination-create'
                open={open === 'create'}
                onOpenChange={() => setOpen('create')}
            />

            {currentRow && (
                <>
                    <DestinationsMutateDrawer
                        key={`destination-update-${currentRow.id}`}
                        open={open === 'update'}
                        onOpenChange={(isOpen) => {
                            if (!isOpen) {
                                setOpen(null)
                                setTimeout(() => setCurrentRow(null), 500)
                            }
                        }}
                        currentRow={currentRow}
                    />

                    <ConfirmDialog
                        key='destination-delete'
                        destructive
                        open={open === 'delete'}
                        onOpenChange={() => {
                            setOpen('delete')
                            setTimeout(() => {
                                setCurrentRow(null)
                            }, 500)
                        }}
                        handleConfirm={() => {
                            deleteMutation.mutate(currentRow.id)
                        }}
                        className='max-w-md'
                        title={`Delete this destination: ${currentRow.name} ?`}
                        desc={
                            <>
                                You are about to delete the destination{' '}
                                <strong>{currentRow.name}</strong>. <br />
                                This action cannot be undone.
                            </>
                        }
                        confirmText='Delete'
                    />
                </>
            )}
        </>
    )
}
