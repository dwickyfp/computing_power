import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { type AlertRule } from '../data/schema'
import { AlertRulesRowActions } from './alert-rules-row-actions'
import { Switch } from '@/components/ui/switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { alertRulesRepo } from '@/repo/alert-rules'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

function EnabledToggle({ row }: { row: { original: AlertRule } }) {
  const queryClient = useQueryClient()
  const toggleMutation = useMutation({
    mutationFn: () => alertRulesRepo.toggle(row.original.id, !row.original.is_enabled),
    onSuccess: async () => {
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Switch
      checked={row.original.is_enabled}
      onCheckedChange={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
    />
  )
}

export const alertRulesColumns: ColumnDef<AlertRule>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <div className='font-medium'>{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'metric_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Metric' />
    ),
    cell: ({ row }) => (
      <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
        {row.getValue('metric_type')}
      </code>
    ),
  },
  {
    id: 'condition',
    header: 'Condition',
    cell: ({ row }) => (
      <span className='text-sm'>
        {row.original.condition_operator} {row.original.threshold_value}
      </span>
    ),
  },
  {
    accessorKey: 'is_enabled',
    header: 'Enabled',
    cell: ({ row }) => <EnabledToggle row={row} />,
  },
  {
    accessorKey: 'trigger_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Triggers' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums'>{row.getValue('trigger_count')}</span>
    ),
  },
  {
    accessorKey: 'last_triggered_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last Triggered' />
    ),
    cell: ({ row }) => {
      const val = row.getValue('last_triggered_at') as string | null
      return val ? (
        <span className='text-muted-foreground text-xs'>
          {formatDistanceToNow(new Date(val), { addSuffix: true })}
        </span>
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <AlertRulesRowActions row={row} />,
  },
]
