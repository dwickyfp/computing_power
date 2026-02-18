import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Plus,
    MoreHorizontal,
    GitBranch,
    Loader2,
    Pencil,
    Trash2,
    ExternalLink,
    Play,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { flowTasksRepo, type FlowTask, type FlowTaskStatus } from '@/repo/flow-tasks'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlowTaskStatus }) {
    const variants: Record<FlowTaskStatus, string> = {
        IDLE: 'bg-muted text-muted-foreground border-border',
        RUNNING: 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500',
        SUCCESS: 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500',
        FAILED: 'bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:border-rose-500',
    }
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-sm ${variants[status]}`}>
            {status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin" />}
            {status}
        </span>
    )
}

// ─── Create / Edit dialog ─────────────────────────────────────────────────────

const formSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

interface FlowTaskDialogProps {
    open: boolean
    onClose: () => void
    onSaved: () => void
    existing?: FlowTask
}

function FlowTaskDialog({ open, onClose, onSaved, existing }: FlowTaskDialogProps) {
    const { register, handleSubmit, reset, formState: { errors } } =
        useForm<FormValues>({
            resolver: zodResolver(formSchema),
            defaultValues: { name: existing?.name ?? '', description: existing?.description ?? '' },
        })

    useEffect(() => {
        if (open) {
            reset({ name: existing?.name ?? '', description: existing?.description ?? '' })
        }
    }, [open, existing, reset])

    const createMutation = useMutation({
        mutationFn: (data: FormValues) => flowTasksRepo.create(data),
        onSuccess: () => {
            toast.success('Flow task created')
            onClose()
            setTimeout(() => onSaved(), 300)
        },
        onError: () => toast.error('Failed to create flow task'),
    })

    const updateMutation = useMutation({
        mutationFn: (data: FormValues) => flowTasksRepo.update(existing!.id, data),
        onSuccess: () => {
            toast.success('Flow task updated')
            onClose()
            setTimeout(() => onSaved(), 300)
        },
        onError: () => toast.error('Failed to update flow task'),
    })

    const onSubmit = (data: FormValues) => {
        if (existing) {
            updateMutation.mutate(data)
        } else {
            createMutation.mutate(data)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{existing ? 'Edit Flow Task' : 'New Flow Task'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input {...register('name')} placeholder="My ETL Flow" />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea
                            {...register('description')}
                            placeholder="What this flow does…"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {existing ? 'Save Changes' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function FlowTaskListPage() {
    const queryClient = useQueryClient()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<FlowTask | undefined>()
    const [filter, setFilter] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<FlowTask | undefined>()

    useEffect(() => {
        document.title = 'Flow Tasks'
        return () => { document.title = 'Rosetta' }
    }, [])

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['flow-tasks'],
        queryFn: () => flowTasksRepo.list(1, 100),
        refetchInterval: 10_000,
        refetchOnWindowFocus: true,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => flowTasksRepo.remove(id),
        onSuccess: () => {
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['flow-tasks'] }), 300)
            toast.success('Flow task deleted')
        },
        onError: () => toast.error('Failed to delete flow task'),
    })

    const [runningId, setRunningId] = useState<number | null>(null)
    const runMutation = useMutation({
        mutationFn: (id: number) => flowTasksRepo.run(id),
        onMutate: (id) => setRunningId(id),
        onSuccess: (_data, id) => {
            setRunningId(null)
            toast.success('Flow task triggered')
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['flow-tasks'] }), 300)
        },
        onError: (_err, id) => {
            setRunningId(null)
            toast.error('Failed to trigger flow task')
        },
    })

    const openCreate = useCallback(() => {
        setEditTarget(undefined)
        setDialogOpen(true)
    }, [])

    const openEdit = useCallback((ft: FlowTask) => {
        setEditTarget(ft)
        setDialogOpen(true)
    }, [])

    const flowTasks = (data?.data.items ?? []).filter((ft) =>
        ft.name.toLowerCase().includes(filter.toLowerCase())
    )

    return (
        <>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-2xl font-bold tracking-tight">Flow Tasks</h2>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Visual ETL transformation flows powered by DuckDB.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Flow Task
                    </Button>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2 max-w-sm">
                    <Input
                        placeholder="Filter by name…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="h-8"
                    />
                </div>

                {/* Table */}
                <div className="rounded-md border border-border/50 overflow-hidden bg-card/40 backdrop-blur-sm">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-b border-border/60">
                                <TableHead className="w-[380px] pl-4">Flow Task</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                                <TableHead className="w-[120px]">Trigger</TableHead>
                                <TableHead>Last Execution</TableHead>
                                <TableHead className="w-[80px]">Run</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground/50" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && flowTasks.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="text-center py-16 text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                                                <GitBranch className="h-6 w-6 opacity-30" />
                                            </div>
                                            <span className="font-medium">No flow tasks yet</span>
                                            <span className="text-sm opacity-60">Create one to get started with your ETL pipelines.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {flowTasks.map((ft) => (
                                <TableRow key={ft.id} className="group hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
                                    <TableCell className="pl-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <div className="h-9 w-9 mt-0.5 rounded-lg border bg-background/50 flex items-center justify-center shrink-0 shadow-sm">
                                                <GitBranch className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <Link
                                                    to="/flow-tasks/$flowTaskId"
                                                    params={{ flowTaskId: String(ft.id) }}
                                                    className="font-medium hover:underline text-sm text-foreground block decoration-primary/50 underline-offset-4"
                                                >
                                                    {ft.name}
                                                </Link>
                                                {ft.description ? (
                                                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                                                        {ft.description}
                                                    </p>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/50 italic">No description provided</span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={ft.status} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-[10px] font-mono capitalize px-2 py-0.5 bg-muted/50 text-muted-foreground font-medium border-0 tracking-wider">
                                            {ft.trigger_type?.toLowerCase() || 'manual'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">
                                                {ft.last_run_at
                                                    ? formatDistanceToNow(new Date(ft.last_run_at), {
                                                          addSuffix: true,
                                                      })
                                                    : 'Never executed'}
                                            </span>
                                            {ft.last_run_at && (
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {ft.last_run_record_count != null
                                                         ? `${ft.last_run_record_count.toLocaleString()} records`
                                                         : '—'}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2.5 gap-1.5 text-xs font-medium"
                                            disabled={ft.status === 'RUNNING' || runningId === ft.id}
                                            onClick={() => runMutation.mutate(ft.id)}
                                        >
                                            {runningId === ft.id
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Play className="h-3 w-3" />}
                                            Run
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground group-hover:text-foreground opacity-50 group-hover:opacity-100 transition-all"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        to="/flow-tasks/$flowTaskId"
                                                        params={{ flowTaskId: String(ft.id) }}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                                        View Details
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        to="/flow-tasks/$flowTaskId/flow"
                                                        params={{ flowTaskId: String(ft.id) }}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                                                        Flow Editor
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => openEdit(ft)}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                                    Edit Settings
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                                                    onClick={() => setDeleteTarget(ft)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Main>

            <FlowTaskDialog
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false)
                    setEditTarget(undefined)
                }}
                onSaved={() => refetch()}
                existing={editTarget}
            />

            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(undefined)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Flow Task</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{' '}
                            <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>?
                            This action cannot be undone and will permanently remove the
                            flow task and all associated run history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                                setDeleteTarget(undefined)
                            }}
                        >
                            {deleteMutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                : <Trash2 className="h-4 w-4 mr-2" />
                            }
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
