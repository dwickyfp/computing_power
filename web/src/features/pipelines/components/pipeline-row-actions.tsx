import { MoreHorizontal } from 'lucide-react'
import { Row } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pipeline, pipelinesRepo } from '@/repo/pipelines'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'



interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function PipelineRowActions<TData>({ row }: DataTableRowActionsProps<TData>) {
  const pipeline = row.original as Pipeline
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { mutate: deleteMutate } = useMutation({
    mutationFn: pipelinesRepo.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['pipelines'] })
      const previousPipelines = queryClient.getQueryData(['pipelines'])
      queryClient.setQueryData(['pipelines'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          pipelines: old.pipelines.filter((p: Pipeline) => p.id !== id),
          total: old.total - 1
        }
      })
      return { previousPipelines }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['pipelines'], context?.previousPipelines)
      toast.error('Failed to delete pipeline')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
    onSuccess: () => {
      toast.success('Pipeline deleted')
    },
  })



  const { mutate: refreshMutate } = useMutation({
    mutationFn: pipelinesRepo.refresh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      toast.success('Pipeline refreshed')
    },
    onError: () => {
      toast.error('Failed to refresh pipeline')
    }
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'>
            <MoreHorizontal className='h-4 w-4' />
            <span className='sr-only'>Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[160px]'>

          <DropdownMenuItem onClick={() => refreshMutate(pipeline.id)}>
            Refresh
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
            Delete
            <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {' '}
              <span className="font-medium text-foreground">
                {pipeline.name}
              </span>
              {' '}? This will remove all associated data and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutate(pipeline.id)
                setDeleteDialogOpen(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

