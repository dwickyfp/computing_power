/**
 * PreviewDrawer — bottom slide-up panel that shows the node preview result.
 * Supports drag-to-resize via the top resize handle.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFlowTaskStore } from '../store/flow-task-store'
import { Button } from '@/components/ui/button'
import { X, Loader2, AlertCircle, GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_HEIGHT = 120
const MAX_HEIGHT = 600
const DEFAULT_HEIGHT = 224  // h-56

export function PreviewDrawer() {
    const { preview, closePreview } = useFlowTaskStore()
    const [height, setHeight] = useState(DEFAULT_HEIGHT)
    const [visible, setVisible] = useState(false)
    const dragging = useRef(false)
    const startY = useRef(0)
    const startH = useRef(0)

    // Trigger enter animation
    useEffect(() => {
        if (preview.isOpen) {
            setHeight(DEFAULT_HEIGHT)
            // small delay so the initial transform is applied before transitioning
            requestAnimationFrame(() => setVisible(true))
        } else {
            setVisible(false)
        }
    }, [preview.isOpen])

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        dragging.current = true
        startY.current = e.clientY
        startH.current = height
    }, [height])

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return
            const delta = startY.current - e.clientY
            setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH.current + delta)))
        }
        const onUp = () => { dragging.current = false }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [])

    if (!preview.isOpen) return null

    return (
        <div
            className={cn(
                'absolute bottom-0 left-0 right-0 z-10 border-t border-border bg-background shadow-lg',
                'transition-transform duration-300 ease-out',
                visible ? 'translate-y-0' : 'translate-y-full'
            )}
        >
            {/* Resize handle */}
            <div
                onMouseDown={onMouseDown}
                className="flex items-center justify-center h-3 cursor-ns-resize hover:bg-muted/50 transition-colors group"
            >
                <GripHorizontal className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Preview</span>
                    {preview.nodeLabel && (
                        <span className="text-xs text-muted-foreground">— {preview.nodeLabel}</span>
                    )}
                    {preview.result && (
                        <span className="text-xs text-muted-foreground">
                            ({preview.result.row_count} row{preview.result.row_count !== 1 ? 's' : ''},&nbsp;
                            {preview.result.elapsed_ms}ms)
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={closePreview}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Body */}
            <div className="overflow-auto p-2" style={{ height }}>
                {preview.isLoading && (
                    <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Running preview…</span>
                    </div>
                )}

                {preview.error && !preview.isLoading && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <pre className="text-xs whitespace-pre-wrap font-mono">{preview.error}</pre>
                    </div>
                )}

                {preview.result && !preview.isLoading && (
                    <PreviewTable
                        columns={preview.result.columns}
                        columnTypes={preview.result.column_types}
                        rows={preview.result.rows}
                    />
                )}
            </div>
        </div>
    )
}

interface PreviewTableProps {
    columns: string[]
    columnTypes: Record<string, string>
    rows: unknown[][]
}

function PreviewTable({ columns, columnTypes, rows }: PreviewTableProps) {
    if (columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No columns returned.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full">
                <thead>
                    <tr className="border-b border-border bg-muted/50">
                        {columns.map((col) => (
                            <th
                                key={col}
                                className="px-2 py-1 text-left font-semibold whitespace-nowrap"
                            >
                                <div>{col}</div>
                                {columnTypes[col] && (
                                    <div className="font-normal text-muted-foreground text-[9px]">
                                        {columnTypes[col]}
                                    </div>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, ri) => (
                        <tr
                            key={ri}
                            className={cn(
                                'border-b border-border/30',
                                ri % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                            )}
                        >
                            {(row as unknown[]).map((cell, ci) => (
                                <td key={ci} className="px-2 py-1 whitespace-nowrap font-mono">
                                    {cell === null || cell === undefined ? (
                                        <span className="italic text-muted-foreground">NULL</span>
                                    ) : (
                                        String(cell)
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
