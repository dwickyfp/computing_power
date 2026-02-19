import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { Sparkles } from 'lucide-react'
import { BaseNode } from './BaseNode'

export const CleanNode = memo(function CleanNode({ id, selected, data }: NodeProps) {
    const label = (data?.label as string) || 'Clean'
    const ops: string[] = []
    if (data?.drop_nulls) ops.push('Drop nulls')
    if (data?.deduplicate) ops.push('Deduplicate')
    if (data?.filter_expr) ops.push('Filter')
    const selectCols = data?.select_columns as string[] | undefined
    if (selectCols?.length) ops.push(`Select ${selectCols.length} cols`)

    return (
        <BaseNode
            id={id}
            selected={selected}
            accentColor="bg-sky-500"
            bgColor="bg-sky-50 dark:bg-sky-950/30"
            iconColor="text-sky-600"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={label}
            subtitle={ops.length ? ops.join(' · ') : undefined}
        >
            {ops.length === 0 && (
                <span className="italic text-muted-foreground">No transformations</span>
            )}
        </BaseNode>
    )
})
