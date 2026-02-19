import { Link } from '@tanstack/react-router'
import {
  type ScheduleListItem,
  type ScheduleRunStatus,
} from '@/repo/schedules'
import { formatDistanceToNow } from 'date-fns'
import {
  CalendarClock,
  Play,
  Trash2,
  Star
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useSchedules } from './schedules-provider'
import cronstrue from 'cronstrue'

interface Props {
  schedule: ScheduleListItem
}

export function ScheduleCard({ schedule }: Props) {
  const { setOpen, setCurrentRow } = useSchedules()

  const runs = [...(schedule.run_history || [])].reverse()
  // Pad with empty runs if less than 20 for consistent width? 
  // Or just show what we have. 
  // Design shows full width bars.

  // Helper for status color
  const getStatusColor = (status: ScheduleRunStatus) => {
    switch (status) {
      case 'SUCCESS':
        return '#10b981' // emerald-500
      case 'FAILED':
        return '#ef4444' // red-500
      case 'RUNNING':
        return '#3b82f6' // blue-500
      default:
        return '#e5e7eb' // gray-200
    }
  }

  const handleToggle = (checked: boolean) => {
      setCurrentRow(schedule)
      if (checked) {
          setOpen('resume')
      } else {
          setOpen('pause')
      }
  }

  const handleDelete = () => {
    setCurrentRow(schedule)
    setOpen('delete')
  }
  
  // NOTE: "Trigger" is not yet implemented in backend for schedules, 
  // so the Play button is visual only or could trigger the underlying task?
  // For now I'll leave it as a placeholder or remove if confusing. 
  // The image shows it, so I'll include it but maybe disabled or toast "Not implemented".
  const handleRunNow = () => {
      // TODO: Implement run now
      console.log('Run now clicked')
  }

  const cronHuman = (() => {
      try {
          return cronstrue.toString(schedule.cron_expression, { verbose: false })
      } catch {
          return schedule.cron_expression
      }
  })()

  return (
    <Card className='overflow-hidden transition-all hover:shadow-md'>
      <div className='flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between'>
        
        {/* Left: Info */}
        <div className='flex-1 space-y-1.5'>
            <div className='flex items-center gap-2'>
                <Link
                    to='/schedules/$scheduleId'
                    params={{ scheduleId: String(schedule.id) }}
                    className='font-semibold text-primary hover:underline text-lg'
                >
                    {schedule.name}
                </Link>
                <Badge variant='outline' className='font-mono text-[10px]'>
                    {schedule.task_type === 'FLOW_TASK' ? 'flow' : 'linked'}
                </Badge>
                {/* Tag placeholder if needed */}
            </div>
            
            <div className='text-sm text-muted-foreground'>
               {schedule.description || 'No description'}
            </div>

            <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2'>
                <div className='flex items-center gap-1.5'>
                    <span className='font-medium text-foreground'>Schedule</span>
                    <span className='flex items-center gap-1' title={schedule.cron_expression}>
                         <CalendarClock className='h-3.5 w-3.5' />
                         {cronHuman}
                    </span>
                </div>
                
                <div className='flex items-center gap-1.5'>
                     <span className='font-medium text-foreground'>Latest Run</span>
                     <span>
                         {schedule.last_run_at 
                            ? formatDistanceToNow(new Date(schedule.last_run_at), { addSuffix: true })
                            : 'Never'}
                     </span>
                </div>

                <div className='flex items-center gap-1.5'>
                     <span className='font-medium text-foreground'>Next Run</span>
                     <span>
                         {schedule.next_run_at 
                            ? formatDistanceToNow(new Date(schedule.next_run_at), { addSuffix: true })
                            : '—'}
                     </span>
                </div>
            </div>
        </div>

        {/* Right: Actions & Chart */}
        <div className='flex flex-col items-end gap-4'>
            {/* Actions Toolbar */}
            <div className='flex items-center gap-2'>
                <Switch 
                    checked={schedule.status === 'ACTIVE'}
                    onCheckedChange={handleToggle}
                />
                
                <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleRunNow} title="Run Now">
                    <Play className='h-4 w-4' />
                </Button>
                
                <Button variant='ghost' size='icon' className='h-8 w-8' title="Favorite">
                    <Star className='h-4 w-4' />
                </Button>

                <Button variant='ghost' size='icon' className='h-8 w-8 text-destructive hover:text-destructive' onClick={handleDelete} title="Delete">
                    <Trash2 className='h-4 w-4' />
                </Button>
            </div>

            {/* Micro Chart */}
            <div className='h-8 w-[120px]'>
                {runs.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={runs}>
                            <Tooltip 
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                                                <div className="font-medium">{formatDistanceToNow(new Date(data.triggered_at), { addSuffix: true })}</div>
                                                <div className={cn(
                                                    "font-bold capitalized",
                                                    data.status === 'SUCCESS' ? 'text-emerald-500' :
                                                    data.status === 'FAILED' ? 'text-red-500' : 'text-blue-500'
                                                )}>
                                                    {data.status}
                                                </div>
                                                <div>{data.duration_ms ? `${data.duration_ms}ms` : ''}</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="duration_ms" radius={[2, 2, 0, 0]}>
                                {runs.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className='flex h-full items-center justify-center text-xs text-muted-foreground bg-muted/20 rounded'>
                        No runs recorded
                    </div>
                )}
            </div>
        </div>
      </div>
    </Card>
  )
}
