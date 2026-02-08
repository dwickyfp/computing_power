import { ColumnDef } from '@tanstack/react-table'
import { Pipeline } from '@/repo/pipelines'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PipelineAnimatedArrow } from './pipeline-animated-arrow.tsx'
import { PipelineRowActions } from './pipeline-row-actions.tsx'
import { Workflow } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { pipelinesRepo } from '@/repo/pipelines'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'


export const pipelineColumns: ColumnDef<Pipeline>[] = [

  {
    id: 'details',
    header: () => <div className="text-center font-semibold">Action</div>,
    cell: ({ row }) => (
      <div className='flex items-center justify-center space-x-2'>
        <PipelineStatusSwitch pipeline={row.original} />
        <PipelineDetailsButton pipelineId={row.original.id} />
      </div>
    ),
    meta: { title: 'Action' },
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <div className='w-[150px] font-medium'>{row.getValue('name')}</div>,
    meta: { title: 'Name' },
  },
  {
    id: 'pipelines',
    header: 'Pipelines',
    cell: ({ row }) => {
      const sourceName = row.original.source?.name || 'Unknown Source'
      const destCount = row.original.destinations?.length || 0
      return (
        <div className='flex items-center space-x-2'>
          <span className='font-medium'>{sourceName}</span>
          <PipelineAnimatedArrow />
          <span className='font-medium'>{destCount} Destination</span>
        </div>
      )
    },
    meta: { title: 'Pipelines' },
  },

  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const isRunning = status === 'START'
      const isRefresh = status === 'REFRESH'
      const isPaused = status === 'PAUSE'

      // Determine display text and styling
      let displayText = status
      let dotColor = 'bg-gray-400 dark:bg-gray-500'
      let bgColor = 'bg-gray-50 dark:bg-gray-900/50'
      let textColor = 'text-gray-700 dark:text-gray-300'

      if (isRunning) {
        displayText = 'Running'
        dotColor = 'bg-green-500 dark:bg-green-400'
        bgColor = 'bg-green-50 dark:bg-green-950/50'
        textColor = 'text-green-700 dark:text-green-400'
      } else if (isRefresh) {
        displayText = 'Refreshing'
        dotColor = 'bg-blue-500 dark:bg-blue-400'
        bgColor = 'bg-blue-50 dark:bg-blue-950/50'
        textColor = 'text-blue-700 dark:text-blue-400'
      } else if (isPaused) {
        displayText = 'Paused'
        dotColor = 'bg-gray-400 dark:bg-gray-500'
        bgColor = 'bg-gray-50 dark:bg-gray-900/50'
        textColor = 'text-gray-600 dark:text-gray-400'
      }

      return (
        <div className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-sm font-medium',
          bgColor,
          textColor
        )}>
          <span className={cn('h-2 w-2 rounded-full', dotColor)} />
          {displayText}
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    meta: { title: 'Status' },
  },

  {
    id: 'actions',
    cell: ({ row }) => <PipelineRowActions row={row} />,
    meta: { title: 'Actions' },
  },
]

function PipelineDetailsButton({ pipelineId }: { pipelineId: number }) {
  const navigate = useNavigate()
  return (
    <Button
      variant="outline"
      size="icon"
      className='h-8 w-8 p-0'
      onClick={() => navigate({ to: '/pipelines/$pipelineId', params: { pipelineId: String(pipelineId) } })}
    >
      <Workflow className="h-4 w-4" />
    </Button>
  )
}

function PipelineStatusSwitch({ pipeline }: { pipeline: Pipeline }) {
  const queryClient = useQueryClient()
  const isRunning = pipeline.status === 'START' || pipeline.status === 'REFRESH'

  const { mutate, isPending } = useMutation({
    mutationFn: async (checked: boolean) => {
      if (checked) {
        return pipelinesRepo.start(pipeline.id)
      } else {
        return pipelinesRepo.pause(pipeline.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      toast.success('Pipeline status updated')
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error}`)
    }
  })

  return (
    <Switch
      checked={isRunning}
      onCheckedChange={(checked) => mutate(checked)}
      disabled={isPending}
    />
  )
}
