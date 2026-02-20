import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { alertRulesRepo } from '@/repo/alert-rules'
import {
  alertRuleFormSchema,
  type AlertRuleForm,
  type AlertRule,
} from '../data/schema'

interface AlertRuleMutateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: AlertRule | null
}

const METRIC_OPTIONS = [
  { value: 'pipeline_error_rate', label: 'Pipeline Error Rate' },
  { value: 'wal_size_bytes', label: 'WAL Size (bytes)' },
  { value: 'replication_lag_seconds', label: 'Replication Lag (s)' },
  { value: 'cpu_usage_percent', label: 'CPU Usage (%)' },
  { value: 'memory_usage_percent', label: 'Memory Usage (%)' },
  { value: 'dlq_message_count', label: 'DLQ Message Count' },
  { value: 'pipeline_stopped_count', label: 'Stopped Pipelines' },
]

const OPERATOR_OPTIONS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '==' },
  { value: 'neq', label: '!=' },
]

export function AlertRuleMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: AlertRuleMutateDrawerProps) {
  const isUpdate = !!currentRow
  const queryClient = useQueryClient()

  const form = useForm<AlertRuleForm>({
    resolver: zodResolver(alertRuleFormSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      metric_type: '',
      condition_operator: 'gt',
      threshold_value: 0,
      cooldown_minutes: 15,
      is_enabled: true,
    },
  })

  useEffect(() => {
    if (currentRow) {
      form.reset({
        name: currentRow.name,
        description: currentRow.description ?? '',
        metric_type: currentRow.metric_type,
        condition_operator: currentRow.condition_operator,
        threshold_value: currentRow.threshold_value,
        cooldown_minutes: currentRow.cooldown_minutes,
        is_enabled: currentRow.is_enabled,
      })
    } else {
      form.reset({
        name: '',
        description: '',
        metric_type: '',
        condition_operator: 'gt',
        threshold_value: 0,
        cooldown_minutes: 15,
        is_enabled: true,
      })
    }
  }, [currentRow, form])

  const createMutation = useMutation({
    mutationFn: (data: AlertRuleForm) =>
      alertRulesRepo.create({
        name: data.name,
        description: data.description,
        metric_type: data.metric_type,
        condition_operator: data.condition_operator,
        threshold_value: data.threshold_value,
        cooldown_minutes: data.cooldown_minutes,
        is_enabled: data.is_enabled,
      }),
    onSuccess: async () => {
      toast.success('Alert rule created')
      onOpenChange(false)
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create alert rule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: AlertRuleForm) =>
      alertRulesRepo.update(currentRow!.id, {
        name: data.name,
        description: data.description,
        metric_type: data.metric_type,
        condition_operator: data.condition_operator,
        threshold_value: data.threshold_value,
        cooldown_minutes: data.cooldown_minutes,
        is_enabled: data.is_enabled,
      }),
    onSuccess: async () => {
      toast.success('Alert rule updated')
      onOpenChange(false)
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update alert rule'),
  })

  const onSubmit = (data: AlertRuleForm) => {
    if (isUpdate) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='sm:max-w-md overflow-y-auto'>
        <SheetHeader>
          <SheetTitle>
            {isUpdate ? 'Update Alert Rule' : 'Create Alert Rule'}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Modify the alert rule configuration.'
              : 'Define conditions that trigger alerts.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4 px-1 pt-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='High WAL size' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Alert when...'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='metric_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metric</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select metric...' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {METRIC_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='condition_operator'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='threshold_value'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Threshold</FormLabel>
                    <FormControl>
                      <Input type='number' step='any' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='cooldown_minutes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cooldown (minutes)</FormLabel>
                  <FormControl>
                    <Input type='number' min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='is_enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-lg border p-3'>
                  <div className='space-y-0.5'>
                    <FormLabel>Enabled</FormLabel>
                    <p className='text-muted-foreground text-xs'>
                      Enable this alert rule to start monitoring
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-2 pt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : isUpdate
                    ? 'Update'
                    : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
