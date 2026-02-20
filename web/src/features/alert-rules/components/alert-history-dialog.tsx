import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { alertRulesRepo } from '@/repo/alert-rules'
import { type AlertRule } from '../data/schema'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, XCircle } from 'lucide-react'

interface AlertHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: AlertRule
}

export function AlertHistoryDialog({
  open,
  onOpenChange,
  rule,
}: AlertHistoryDialogProps) {
  const { data } = useQuery({
    queryKey: ['alert-rules', rule.id, 'history'],
    queryFn: () => alertRulesRepo.getHistory(rule.id),
    enabled: open,
    refetchInterval: open ? 10_000 : false,
  })

  const items = data?.data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Alert History — {rule.name}</DialogTitle>
          <DialogDescription>
            Showing recent alert triggers for this rule.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[400px]'>
          {items.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              No alerts have been triggered yet.
            </p>
          ) : (
            <div className='space-y-3'>
              {items.map((item) => {
                const isResolved = item.resolved_at !== null
                return (
                  <div
                    key={item.id}
                    className='flex items-start gap-3 rounded-lg border p-3'
                  >
                    <div className='pt-0.5'>
                      {isResolved ? (
                        <CheckCircle2 className='h-4 w-4 text-green-500' />
                      ) : (
                        <XCircle className='h-4 w-4 text-destructive' />
                      )}
                    </div>
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-center gap-2'>
                        <span className='text-muted-foreground text-xs'>
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className='text-sm'>
                        Value: <strong>{item.metric_value}</strong> — Threshold:{' '}
                        <strong>{item.threshold_value}</strong>
                      </p>
                      {item.message && (
                        <p className='text-muted-foreground text-xs'>
                          {item.message}
                        </p>
                      )}
                      {isResolved && item.resolved_at && (
                        <p className='text-xs text-green-600'>
                          Resolved{' '}
                          {formatDistanceToNow(new Date(item.resolved_at), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

