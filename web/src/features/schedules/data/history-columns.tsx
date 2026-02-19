import { format } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import {
  type ScheduleRunHistory,
  type ScheduleRunStatus,
} from '@/repo/schedules'
import { Loader2 } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/data-table'

// ─── Helper ────────────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: ScheduleRunStatus }) {
  const map: Record<ScheduleRunStatus, string> = {
    RUNNING:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    SUCCESS:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    FAILED:
      'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${map[status]}`}
    >
      {status === 'RUNNING' && <Loader2 className='h-3 w-3 animate-spin' />}
      {status}
    </span>
  )
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

// ─── Columns ─────────────────────────────────────────────────────────────────

export const historyColumns: ColumnDef<ScheduleRunHistory>[] = [
  {
    accessorKey: 'triggered_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Triggered At' />
    ),
    cell: ({ row }) => (
      <span className='text-xs tabular-nums'>
        {format(new Date(row.original.triggered_at), 'yyyy-MM-dd HH:mm:ss')}
      </span>
    ),
    meta: { className: 'w-[175px]' },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
    meta: { className: 'w-[100px]' },
  },
  {
    accessorKey: 'duration_ms',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Duration' />
    ),
    cell: ({ row }) => (
      <span className='text-xs text-muted-foreground tabular-nums'>
        {formatDuration(row.original.duration_ms)}
      </span>
    ),
    meta: { className: 'w-[90px]' },
  },
  {
    accessorKey: 'completed_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Completed At' />
    ),
    cell: ({ row }) => {
      const v = row.original.completed_at
      if (!v) return <span className='text-xs text-muted-foreground'>—</span>
      return (
        <span className='text-xs tabular-nums'>
          {format(new Date(v), 'yyyy-MM-dd HH:mm:ss')}
        </span>
      )
    },
    meta: { className: 'w-[175px]' },
  },
  {
    accessorKey: 'message',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Message' />
    ),
    cell: ({ row }) => {
      const msg = row.original.message
      if (!msg) return <span className='text-xs text-muted-foreground'>—</span>
      return (
        <span
          className='block max-w-[300px] truncate text-xs text-muted-foreground'
          title={msg}
        >
          {msg}
        </span>
      )
    },
  },
]
