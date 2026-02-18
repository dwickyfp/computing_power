import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
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
        IDLE: 'bg-muted text-muted-foreground',
        RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    }
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${variants[status]}`}>
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
                <div className="rounded-md border border-border/50">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Run</TableHead>
                                <TableHead className="text-right">Records Written</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && flowTasks.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="text-center py-12 text-muted-foreground"
                                    >
                                        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>No flow tasks yet. Create one to get started.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {flowTasks.map((ft) => (
                                <TableRow key={ft.id} className="group">
                                    <TableCell>
                                        <Link
                                            to="/flow-tasks/$flowTaskId"
                                            params={{ flowTaskId: String(ft.id) }}
                                            className="font-medium hover:underline"
                                        >
                                            {ft.name}
                                        </Link>
                                        {ft.description && (
                                            <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                                                {ft.description}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={ft.status} />
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {ft.last_run_at
                                            ? formatDistanceToNow(new Date(ft.last_run_at), {
                                                  addSuffix: true,
                                              })
                                            : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {ft.last_run_record_count != null
                                            ? ft.last_run_record_count.toLocaleString()
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        to="/flow-tasks/$flowTaskId/flow"
                                                        params={{ flowTaskId: String(ft.id) }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <GitBranch className="h-4 w-4" />
                                                        Open Flow Editor
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        to="/flow-tasks/$flowTaskId"
                                                        params={{ flowTaskId: String(ft.id) }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        View Details
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => openEdit(ft)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive flex items-center gap-2"
                                                    onClick={() => {
                                                        if (confirm(`Delete "${ft.name}"?`))
                                                            deleteMutation.mutate(ft.id)
                                                    }}
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
        </>
    )
}
