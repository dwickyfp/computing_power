import { useState, useEffect } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
    GitBranch,
    Play,
    Loader2,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
    flowTasksRepo,
    type FlowTaskRunHistory,
    type FlowTaskRunStatus,
    type FlowTaskNodeStatus,
} from '@/repo/flow-tasks'

// ─── Sub-components ────────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: FlowTaskRunStatus }) {
    const map: Record<FlowTaskRunStatus, { label: string; cls: string }> = {
        RUNNING: {
            label: 'Running',
            cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        },
        SUCCESS: {
            label: 'Success',
            cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        },
        FAILED: {
            label: 'Failed',
            cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        },
        CANCELLED: {
            label: 'Cancelled',
            cls: 'bg-muted text-muted-foreground',
        },
    }
    const { label, cls } = map[status]
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin" />}
            {label}
        </span>
    )
}

function NodeStatusIcon({ status }: { status: FlowTaskNodeStatus }) {
    if (status === 'SUCCESS') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
    if (status === 'FAILED') return <XCircle className="h-3.5 w-3.5 text-rose-500" />
    if (status === 'RUNNING') return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
}

function RunRow({ run }: { run: FlowTaskRunHistory }) {
    const [open, setOpen] = useState(false)

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
                <TableRow className="cursor-pointer hover:bg-muted/30">
                    <TableCell>
                        <div className="flex items-center gap-2">
                            {open ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="text-xs font-mono text-muted-foreground">
                                #{run.id}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <RunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right">
                        {run.total_input_records?.toLocaleString() ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right">
                        {run.total_output_records?.toLocaleString() ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                        {run.finished_at
                            ? `${Math.round(
                                  (new Date(run.finished_at).getTime() -
                                      new Date(run.started_at).getTime()) /
                                      1000
                              )}s`
                            : '—'}
                    </TableCell>
                </TableRow>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <>
                    {run.node_logs?.map((log) => (
                        <TableRow key={log.id} className="bg-muted/20">
                            <TableCell colSpan={6} className="pl-10 py-1">
                                <div className="flex items-center gap-3 text-xs">
                                    <NodeStatusIcon status={log.status} />
                                    <span className="font-medium">{log.node_label || log.node_id}</span>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {log.node_type}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                        in: {log.row_count_in?.toLocaleString() ?? 0} →
                                        out: {log.row_count_out?.toLocaleString() ?? 0}
                                    </span>
                                    {log.duration_ms != null && (
                                        <span className="text-muted-foreground">
                                            {log.duration_ms}ms
                                        </span>
                                    )}
                                    {log.error_message && (
                                        <span className="text-rose-500 truncate max-w-xs">
                                            {log.error_message}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </>
            </CollapsibleContent>
        </Collapsible>
    )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function FlowTaskDetailPage() {
    const { flowTaskId } = useParams({ from: '/_authenticated/flow-tasks/$flowTaskId' })
    const id = parseInt(flowTaskId)
    const queryClient = useQueryClient()
    const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)

    useEffect(() => {
        document.title = 'Flow Task Details'
        return () => { document.title = 'Rosetta' }
    }, [])

    const { data: ftResp, isLoading: ftLoading } = useQuery({
        queryKey: ['flow-tasks', id],
        queryFn: () => flowTasksRepo.get(id),
        refetchInterval: pollingTaskId ? 3000 : false,
    })

    const { data: runsResp, isLoading: runsLoading } = useQuery({
        queryKey: ['flow-tasks', id, 'runs'],
        queryFn: () => flowTasksRepo.getRuns(id, 1, 20),
        refetchInterval: pollingTaskId ? 3000 : false,
    })

    // Poll Celery task status
    const { data: taskStatusData } = useQuery({
        queryKey: ['flow-task-status', pollingTaskId],
        queryFn: () => flowTasksRepo.getTaskStatus(pollingTaskId!),
        enabled: !!pollingTaskId,
        refetchInterval: 2000,
        select: (resp) => resp.data,
    })

    useEffect(() => {
        if (!taskStatusData) return
        if (taskStatusData.state === 'SUCCESS' || taskStatusData.state === 'FAILURE') {
            setPollingTaskId(null)
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['flow-tasks', id] })
                queryClient.invalidateQueries({ queryKey: ['flow-tasks', id, 'runs'] })
            }, 300)
            if (taskStatusData.state === 'SUCCESS') {
                toast.success('Flow task completed successfully')
            } else {
                toast.error('Flow task failed')
            }
        }
    }, [taskStatusData, id, queryClient])

    const runMutation = useMutation({
        mutationFn: () => flowTasksRepo.run(id),
        onSuccess: (resp) => {
            const { celery_task_id } = resp.data
            setPollingTaskId(celery_task_id)
            toast.info('Flow task started')
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['flow-tasks', id] })
            }, 300)
        },
        onError: () => toast.error('Failed to trigger flow task'),
    })

    const ft = ftResp?.data
    const runs = runsResp?.data.items ?? []

    if (ftLoading) {
        return (
            <Main>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            </Main>
        )
    }

    if (!ft) {
        return (
            <Main>
                <div className="text-center py-16 text-muted-foreground">
                    Flow task not found.
                </div>
            </Main>
        )
    }

    return (
        <>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-6">
                {/* Breadcrumb */}
                <div>
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link to="/flow-tasks">Flow Tasks</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{ft.name}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                {/* Header card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                                    {ft.name}
                                </CardTitle>
                                {ft.description && (
                                    <CardDescription className="mt-1">
                                        {ft.description}
                                    </CardDescription>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button variant="outline" asChild>
                                    <Link
                                        to="/flow-tasks/$flowTaskId/flow"
                                        params={{ flowTaskId: String(ft.id) }}
                                    >
                                        <GitBranch className="h-4 w-4 mr-2" />
                                        Flow Editor
                                    </Link>
                                </Button>
                                <Button
                                    onClick={() => runMutation.mutate()}
                                    disabled={
                                        runMutation.isPending ||
                                        ft.status === 'RUNNING' ||
                                        !!pollingTaskId
                                    }
                                >
                                    {runMutation.isPending || !!pollingTaskId ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Play className="h-4 w-4 mr-2" />
                                    )}
                                    Run Now
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <StatItem
                                label="Status"
                                value={
                                    <span
                                        className={`font-semibold ${
                                            ft.status === 'SUCCESS'
                                                ? 'text-emerald-600'
                                                : ft.status === 'FAILED'
                                                ? 'text-rose-600'
                                                : ft.status === 'RUNNING'
                                                ? 'text-blue-600'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        {ft.status}
                                    </span>
                                }
                            />
                            <StatItem
                                label="Last Run"
                                value={
                                    ft.last_run_at
                                        ? formatDistanceToNow(new Date(ft.last_run_at), {
                                              addSuffix: true,
                                          })
                                        : 'Never'
                                }
                            />
                            <StatItem
                                label="Last Records Written"
                                value={
                                    ft.last_run_record_count != null
                                        ? ft.last_run_record_count.toLocaleString()
                                        : '—'
                                }
                            />
                            <StatItem
                                label="Trigger"
                                value={ft.trigger_type}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Run History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Run History</CardTitle>
                        <CardDescription>
                            Click a row to expand per-node logs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">Run</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Started</TableHead>
                                    <TableHead className="text-right">Input Rows</TableHead>
                                    <TableHead className="text-right">Output Rows</TableHead>
                                    <TableHead>Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {runsLoading && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!runsLoading && runs.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center py-10 text-muted-foreground"
                                        >
                                            No runs yet. Click "Run Now" to start.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {runs.map((run) => (
                                    <RunRow key={run.id} run={run} />
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </Main>
        </>
    )
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 font-medium">{value}</p>
        </div>
    )
}
