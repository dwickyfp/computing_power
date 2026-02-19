import { useState } from 'react'
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    type SortingState,
} from '@tanstack/react-table'
import {
    Loader2,
    AlertCircle,
    RotateCw,
    Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { historyColumns } from '../data/history-columns'
import { type ScheduleRunHistory } from '@/repo/schedules'

interface ScheduleRunsProps {
    data: ScheduleRunHistory[]
    isLoading: boolean
    onRefresh: () => void
}

export function ScheduleRuns({ data, isLoading, onRefresh }: ScheduleRunsProps) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    // Filter data locally for now
    const filteredData = data.filter((item) => {
        if (statusFilter === 'ALL') return true
        return item.status === statusFilter
    })

    // Calculate max duration for sparklines/visuals if needed
    // const maxDuration = Math.max(...filteredData.map(d => d.duration_ms || 0))

    const table = useReactTable({
        data: filteredData,
        columns: historyColumns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search logs..."
                            className="w-full sm:w-[250px] pl-9"
                            disabled
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="SUCCESS">Success</SelectItem>
                            <SelectItem value="FAILED">Failed</SelectItem>
                            <SelectItem value="RUNNING">Running</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                    <RotateCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* Content */}
            <div className="rounded-md border bg-card overflow-hidden">
                {isLoading && data.length === 0 ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="relative max-h-[600px] overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                                {table.getHeaderGroups().map((hg) => (
                                    <TableRow key={hg.id} className="bg-muted/50 hover:bg-muted/50 transition-none border-b-0 shadow-sm">
                                        {hg.headers.map((h) => (
                                            <TableHead key={h.id} className={cn(h.column.columnDef.meta?.className, "text-xs uppercase tracking-wider text-muted-foreground/70 h-10")}>
                                                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="group border-b border-muted/40 hover:bg-muted/30 data-[state=selected]:bg-muted/50 transition-colors duration-200"
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.className, "py-2")}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={historyColumns.length} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <AlertCircle className="h-8 w-8 opacity-20" />
                                                <p>No runs found matching your criteria</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination placeholder (if needed later) */}
            <div className="flex items-center justify-end text-xs text-muted-foreground">
                Showing {filteredData.length} runs
            </div>
        </div>
    )
}
