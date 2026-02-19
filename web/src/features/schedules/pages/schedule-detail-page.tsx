import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table'
import { flowTasksRepo } from '@/repo/flow-tasks'
import { linkedTasksRepo } from '@/repo/linked-tasks'
import {
  schedulesRepo,
  type ScheduleCreate,
  type ScheduleUpdate,
} from '@/repo/schedules'
import cronstrue from 'cronstrue'
import {
  Loader2,
  Save,
  Clock,
  MoreVertical,
  Star,
  Trash2,
  CalendarClock,
  RotateCw
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { historyColumns } from '../data/history-columns'
import { scheduleFormSchema, type ScheduleFormValues } from '../data/schema'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Cron presets ─────────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  label: `${i}:00`,
  value: String(i),
}))
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}))
const DAYS_OF_WEEK = [
  { label: 'Sunday', value: '0' },
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
]

// ─── Page component ───────────────────────────────────────────────────────────

export default function ScheduleDetailPage() {
  const { scheduleId } = useParams({
    from: '/_authenticated/schedules/$scheduleId',
  })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = scheduleId === 'new'

  const [cronMode, setCronMode] = useState<'preset' | 'manual'>('preset')
  const [presetType, setPresetType] = useState<
    'simple' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  >('simple')
  const [hour, setHour] = useState('0')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [sorting, setSorting] = useState<SortingState>([])

  // ── Queries ───────────────────────────────────────────────────────────

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedules', Number(scheduleId)],
    queryFn: () => schedulesRepo.getById(Number(scheduleId)),
    enabled: !isNew && !Number.isNaN(Number(scheduleId)),
  })

  // We only enable history fetching if we're not creating a new schedule
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['schedules', Number(scheduleId), 'history'],
    queryFn: () =>
      schedulesRepo.getHistory(Number(scheduleId), { skip: 0, limit: 50 }),
    enabled: !isNew && !Number.isNaN(Number(scheduleId)),
    refetchInterval: 30_000,
  })

  const { data: flowTasksData } = useQuery({
    queryKey: ['flow-tasks'],
    queryFn: () => flowTasksRepo.list(1, 200),
  })

  const { data: linkedTasksData } = useQuery({
    queryKey: ['linked-tasks'],
    queryFn: () => linkedTasksRepo.list(1, 100),
  })

  // ── Form ──────────────────────────────────────────────────────────────

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      name: '',
      description: null,
      task_type: 'FLOW_TASK',
      task_id: 0,
      cron_expression: '*/5 * * * *',
      status: 'ACTIVE',
    },
  })

  useEffect(() => {
    if (schedule) {
      form.reset({
        name: schedule.name,
        description: schedule.description,
        task_type: schedule.task_type,
        task_id: schedule.task_id,
        cron_expression: schedule.cron_expression,
        status: schedule.status,
      })
    }
  }, [schedule, form])

  // ── Mutations ─────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: ScheduleCreate) => schedulesRepo.create(data),
    onSuccess: async (newSchedule) => {
      toast.success('Schedule created')
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['schedules'], refetchType: 'active' })
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(newSchedule.id) },
      })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail || 'Failed to create schedule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ScheduleUpdate) =>
      schedulesRepo.update(Number(scheduleId), data),
    onSuccess: async () => {
      toast.success('Schedule updated')
      queryClient.invalidateQueries({ queryKey: ['schedules'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['schedules', Number(scheduleId)] })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail || 'Failed to update schedule'),
  })
  
  const pauseMutation = useMutation({
      mutationFn: () => schedulesRepo.pause(Number(scheduleId)),
      onSuccess: () => {
        toast.success('Schedule paused')
        queryClient.invalidateQueries({ queryKey: ['schedules', Number(scheduleId)] })
      },
      onError: () => toast.error('Failed to pause schedule')
  })

  const resumeMutation = useMutation({
      mutationFn: () => schedulesRepo.resume(Number(scheduleId)),
      onSuccess: () => {
        toast.success('Schedule resumed')
        queryClient.invalidateQueries({ queryKey: ['schedules', Number(scheduleId)] })
      },
      onError: () => toast.error('Failed to resume schedule')
  })

  const deleteMutation = useMutation({
      mutationFn: () => schedulesRepo.delete(Number(scheduleId)),
      onSuccess: () => {
          toast.success('Schedule deleted')
          navigate({ to: '/schedules' })
      },
       onError: () => toast.error('Failed to delete schedule')
  })

  function onSubmit(values: ScheduleFormValues) {
    if (isNew) {
      createMutation.mutate(values)
    } else {
      updateMutation.mutate(values)
    }
  }

  // ── Cron builder helpers ──────────────────────────────────────────────

  function handlePresetClick(preset: string) {
    if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(preset)) {
      setPresetType(preset as any)
    } else {
      setPresetType('simple')
      form.setValue('cron_expression', preset)
    }
  }

  useEffect(() => {
    if (presetType === 'DAILY') {
      form.setValue('cron_expression', `0 ${hour} * * *`)
    } else if (presetType === 'WEEKLY') {
      form.setValue('cron_expression', `0 ${hour} * * ${dayOfWeek}`)
    } else if (presetType === 'MONTHLY') {
      form.setValue('cron_expression', `0 ${hour} ${dayOfMonth} * *`)
    }
  }, [presetType, hour, dayOfMonth, dayOfWeek, form])

  function getCronHuman(expr: string): string {
    try {
      return cronstrue.toString(expr, { verbose: false })
    } catch {
      return 'Invalid cron expression'
    }
  }

  // ── History table ─────────────────────────────────────────────────────

  const historyTable = useReactTable({
    data: historyData?.items ?? [],
    columns: historyColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // ── Render ────────────────────────────────────────────────────────────

  useEffect(() => {
    document.title = isNew
      ? 'New Schedule'
      : `Schedule: ${schedule?.name || ''}`
    return () => {
      document.title = 'Rosetta'
    }
  }, [isNew, schedule])

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const flowTasks = flowTasksData?.data.items ?? []
  const linkedTasks = linkedTasksData?.data.items ?? []
  const taskType = form.watch('task_type')
  const availableTasks = taskType === 'FLOW_TASK' ? flowTasks : linkedTasks
  
  // Custom form layout for "Configurations"
  const ConfigurationForm = () => (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder='daily_sync' />
                            </FormControl>
                            <FormDescription>Unique name (no spaces)</FormDescription>
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
                                <Textarea {...field} value={field.value ?? ''} placeholder='Optional description' rows={1} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormField
                    control={form.control}
                    name='task_type'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Task Type</FormLabel>
                            <Select
                                onValueChange={(v) => {
                                    field.onChange(v)
                                    form.setValue('task_id', 0)
                                }}
                                value={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value='FLOW_TASK'>Flow Task</SelectItem>
                                    <SelectItem value='LINKED_TASK'>Linked Task</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name='task_id'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Task</FormLabel>
                            <Select
                                onValueChange={(v) => field.onChange(Number(v))}
                                value={field.value ? String(field.value) : ''}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder='Select a task…' />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {availableTasks.map((t: any) => (
                                        <SelectItem key={t.id} value={String(t.id)}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className='space-y-4'>
                <FormLabel>Schedule (Cron)</FormLabel>
                <RadioGroup value={cronMode} onValueChange={(v: any) => setCronMode(v)} className='flex gap-4'>
                    <div className='flex items-center gap-2'>
                        <RadioGroupItem value='preset' id='preset' />
                        <label htmlFor='preset' className='cursor-pointer text-sm'>Preset</label>
                    </div>
                    <div className='flex items-center gap-2'>
                        <RadioGroupItem value='manual' id='manual' />
                        <label htmlFor='manual' className='cursor-pointer text-sm'>Manual (Crontab)</label>
                    </div>
                </RadioGroup>

                {cronMode === 'preset' && (
                    <div className='space-y-3'>
                        <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
                            {CRON_PRESETS.map((p) => (
                                <Button
                                    key={p.value}
                                    type='button'
                                    size='sm'
                                    variant={form.watch('cron_expression') === p.value || presetType === p.value ? 'default' : 'outline'}
                                    onClick={() => handlePresetClick(p.value)}
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                        {/* Preset options logic preserved from original... */}
                        {presetType === 'DAILY' && (
                             <div className='flex items-center gap-2'>
                                  <span className='text-sm text-muted-foreground'>At hour:</span>
                                  <Select value={hour} onValueChange={setHour}>
                                      <SelectTrigger className='w-[120px]'><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                          {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                             </div>
                        )}
                        {/* ... Weekly/Monthly logic omitted for brevity in recreation, assuming mostly user uses Manual or simple presets */}
                        {/* Actually need to include it if we want full parity. I'll include simplified version of logic or full if room. */}
                        {/* Full logic: */}
                        {presetType === 'WEEKLY' && (
                            <div className='space-y-2'>
                                <div className='flex items-center gap-2'>
                                    <span className='text-sm text-muted-foreground'>At hour:</span>
                                    <Select value={hour} onValueChange={setHour}>
                                        <SelectTrigger className='w-[120px]'><SelectValue /></SelectTrigger>
                                        <SelectContent>{HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <span className='text-sm text-muted-foreground'>On day:</span>
                                    <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                                        <SelectTrigger className='w-[150px]'><SelectValue /></SelectTrigger>
                                        <SelectContent>{DAYS_OF_WEEK.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        {presetType === 'MONTHLY' && (
                            <div className='space-y-2'>
                                <div className='flex items-center gap-2'>
                                    <span className='text-sm text-muted-foreground'>At hour:</span>
                                     <Select value={hour} onValueChange={setHour}>
                                        <SelectTrigger className='w-[120px]'><SelectValue /></SelectTrigger>
                                        <SelectContent>{HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <span className='text-sm text-muted-foreground'>On day:</span>
                                    <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                                        <SelectTrigger className='w-[150px]'><SelectValue /></SelectTrigger>
                                        <SelectContent>{DAYS_OF_MONTH.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {cronMode === 'manual' && (
                    <FormField
                        control={form.control}
                        name='cron_expression'
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input {...field} placeholder='*/5 * * * *' className='font-mono' />
                                </FormControl>
                                <FormDescription>5-part crontab: minute hour day month weekday</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                
                <div className='rounded-md bg-muted px-3 py-2'>
                    <p className='text-sm text-muted-foreground'>
                        <Clock className='-mt-0.5 mr-1.5 inline h-3.5 w-3.5' />
                        {getCronHuman(form.watch('cron_expression'))}
                    </p>
                </div>
            </div>

            <div className='flex items-center gap-3'>
                <Button type='submit' disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? (
                        <><Loader2 className='mr-2 h-4 w-4 animate-spin' />Saving…</>
                    ) : (
                        <><Save className='mr-2 h-4 w-4' />Save Changes</>
                    )}
                </Button>
            </div>
        </form>
      </Form>
  )

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        {/* Top Breadcrumb */}
        <Breadcrumb>
            <BreadcrumbList>
            <BreadcrumbItem>
                <BreadcrumbLink asChild>
                <Link to='/schedules'>Schedules</Link>
                </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>
                {isNew ? 'New Schedule' : schedule?.name}
                </BreadcrumbPage>
            </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
        
        {/* Header Area */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div className='flex items-center gap-3'>
                {/* Icon Box */}
                <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                    <CalendarClock className='h-6 w-6' />
                </div>
                <div>
                    <h1 className='text-xl font-bold tracking-tight flex items-center gap-2'>
                        {isNew ? 'Create Schedule' : schedule?.name}
                        {schedule && (
                             <Switch 
                                checked={schedule.status === 'ACTIVE'} 
                                onCheckedChange={(c) => c ? resumeMutation.mutate() : pauseMutation.mutate()}
                                className="ml-2"
                             />
                        )}
                    </h1>
                     <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <span className='font-mono'>{schedule?.cron_expression}</span>
                        {schedule && (
                            <>
                             <span>•</span>
                             <Badge variant='outline'>{schedule.task_type === 'FLOW_TASK' ? 'flow' : 'linked'}</Badge>
                            </>
                        )}
                     </div>
                </div>
            </div>

            {!isNew && (
                <div className='flex items-center gap-2'>
                    <Button variant='outline' size='sm'>
                         <Star className='mr-2 h-4 w-4' />
                         Favorite Dag
                    </Button>
                    <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                             <Button variant='outline' size='icon'>
                                 <MoreVertical className='h-4 w-4' />
                             </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align='end'>
                             <DropdownMenuItem onClick={() => deleteMutation.mutate()} className='text-destructive'>
                                 <Trash2 className='mr-2 h-4 w-4' />
                                 Delete Schedule
                             </DropdownMenuItem>
                         </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>

        {/* Content Tabs */}
        {isNew ? (
            <Card>
                <CardHeader>
                     <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <ConfigurationForm />
                </CardContent>
            </Card>
        ) : (
            <Tabs defaultValue="runs" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="runs">Runs</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview">
                    <Card>
                        <CardHeader>
                             <CardTitle>Configuration</CardTitle>
                             <CardDescription>Manage schedule settings and cron expression.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ConfigurationForm />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="runs">
                     <Card>
                        <CardHeader>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <CardTitle>Run History</CardTitle>
                                    <CardDescription>Recent executions triggered by this schedule.</CardDescription>
                                </div>
                                <Button variant='outline' size='sm' onClick={() => queryClient.invalidateQueries({queryKey: ['schedules', Number(scheduleId), 'history']})}>
                                     <RotateCw className='mr-2 h-4 w-4' />
                                     Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className='flex items-center justify-center py-8'>
                                    <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                                </div>
                            ) : (
                                <div className='rounded-md border border-border/50'>
                                <Table>
                                    <TableHeader>
                                        {historyTable.getHeaderGroups().map((hg) => (
                                            <TableRow key={hg.id}>
                                                {hg.headers.map((h) => (
                                                    <TableHead key={h.id} className={cn(h.column.columnDef.meta?.className)}>
                                                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableHeader>
                                    <TableBody>
                                        {historyTable.getRowModel().rows.length ? (
                                            historyTable.getRowModel().rows.map((row) => (
                                                <TableRow key={row.id}>
                                                    {row.getVisibleCells().map((cell) => (
                                                        <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.className)}>
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={historyColumns.length} className='h-24 text-center'>
                                                    No runs found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                                </div>
                            )}
                        </CardContent>
                     </Card>
                </TabsContent>
                
                <TabsContent value="tasks">
                     <div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>
                         Tasks view placeholder
                     </div>
                </TabsContent>
                
                {/* Placeholders for other tabs */}
                <TabsContent value="calendar"><div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>Calendar view placeholder</div></TabsContent>
                <TabsContent value="backfills"><div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>Backfills view placeholder</div></TabsContent>
                <TabsContent value="audit"><div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>Audit Log view placeholder</div></TabsContent>
                <TabsContent value="code"><div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>Code view placeholder</div></TabsContent>
                <TabsContent value="details"><div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>Details view placeholder</div></TabsContent>

            </Tabs>
        )}
      </Main>
    </>
  )
}
