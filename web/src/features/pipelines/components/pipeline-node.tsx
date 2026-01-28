import { Handle, Position, NodeProps, type Node } from '@xyflow/react'
import { Database, Server, Trash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { pipelinesRepo } from '@/repo/pipelines'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface PipelineNodeData extends Record<string, unknown> {
  label: string
  type: string
  isSource?: boolean
  status?: string
  pipelineId?: number
  destinationId?: number
}

export function PipelineNode({ data }: NodeProps<Node<PipelineNodeData>>) {
  const isSource = data.isSource
  const queryClient = useQueryClient()

  const { mutate: deleteDestination, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      if (!data.pipelineId || !data.destinationId) return
      return pipelinesRepo.removeDestination(data.pipelineId, data.destinationId)
    },
    onSuccess: () => {
      toast.success('Destination removed')
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', data.pipelineId] })
    },
    onError: (error) => {
      toast.error(`Failed to remove destination: ${error}`)
    }
  })


  return (
    <div className={cn(
      "relative min-w-[200px] rounded-xl border-2 bg-background transition-all hover:shadow-lg group",
      isSource
        ? "border-blue-500/50 shadow-blue-500/20"
        : "border-emerald-500/50 shadow-emerald-500/20"
    )}>
      {/* Header with Gradient */}
      <div className={cn(
        "flex items-center justify-between rounded-t-[10px] px-4 py-3 text-white",
        isSource
          ? "bg-gradient-to-r from-blue-600 to-indigo-600"
          : "bg-gradient-to-r from-emerald-600 to-teal-600"
      )}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Database className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm truncate" title={data.label}>
            {data.label}
          </span>
        </div>

        {!isSource && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20 -mr-2"
                onClick={(e) => e.stopPropagation()}
                disabled={isDeleting}
              >
                <Trash className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Destination</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this destination from the pipeline? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteDestination()
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Server className="h-3 w-3" />
            <span className="uppercase tracking-wider font-medium">
              {data.type}
            </span>
          </div>
          {data.status && (
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "h-2 w-2 rounded-full",
                data.status === 'START' ? "bg-green-500" : "bg-yellow-500"
              )} />
              <span>{data.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Handles */}
      {isSource ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-blue-600 !h-3 !w-3 !-right-2 border-2 border-white"
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-emerald-600 !h-3 !w-3 !-left-2 border-2 border-white"
        />
      )}
    </div>
  )
}
