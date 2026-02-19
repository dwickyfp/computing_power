import { formatDistanceToNow } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import {
  type ScheduleRunHistory,
} from '@/repo/schedules'
import { Loader2, CheckCircle2, XCircle, Info } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/data-table'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Helper ────────────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: string }) {
  if (status === 'RUNNING') {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
  }
  if (status === 'SUCCESS') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  }
  if (status === 'FAILED') {
    return <XCircle className="h-4 w-4 text-red-500" />
  }
  return <div className="h-2 w-2 rounded-full bg-muted" />
}

function DurationBar({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-muted-foreground">—</span>

  // Cap visual bar at 10 minutes for scale? Or just simple text.
  // User asked for "shape of value row", so maybe a pill or bar.
  // Let's do a simple clean text for now, but bold/colored if long?

  let formatted = ''
  if (ms < 1000) formatted = `${ms}ms`
  else if (ms < 60_000) formatted = `${(ms / 1000).toFixed(1)}s`
  else formatted = `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`

  return (
    <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-sm">
      {formatted}
    </span>
  )
}

// ─── Columns ─────────────────────────────────────────────────────────────────

export const historyColumns: ColumnDef<ScheduleRunHistory>[] = [
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <StatusIndicator status={row.original.status} />
        <span className={cn(
          "text-xs font-medium",
          row.original.status === 'SUCCESS' && "text-foreground",
          row.original.status === 'FAILED' && "text-red-500",
          row.original.status === 'RUNNING' && "text-blue-500",
        )}>
          {row.original.status}
        </span>
      </div>
    ),
    meta: { className: 'w-[120px]' },
  },
  {
    accessorKey: 'triggered_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Triggered' />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className='text-xs font-medium'>
          {formatDistanceToNow(new Date(row.original.triggered_at), { addSuffix: true })}
        </span>
        <span className="text-[10px] text-muted-foreground hidden group-hover:block">
          {new Date(row.original.triggered_at).toLocaleString()}
        </span>
      </div>
    ),
    meta: { className: 'w-[150px]' },
  },
  {
    accessorKey: 'duration_ms',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Duration' />
    ),
    cell: ({ row }) => <DurationBar ms={row.original.duration_ms} />,
    meta: { className: 'w-[100px]' },
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
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div className='flex items-center gap-1.5 max-w-[400px] cursor-help'>
                {row.original.status === 'FAILED' && <Info className="h-3 w-3 text-red-500 shrink-0" />}
                <span className='truncate text-xs text-muted-foreground'>
                  {msg}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[400px] break-words text-xs">
              {msg}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
]
