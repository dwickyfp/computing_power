import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { Database } from 'lucide-react'
import { BaseNode } from './BaseNode'

export const InputNode = memo(function InputNode({ id, selected, data }: NodeProps) {
    const label = (data?.label as string) || 'Input'
    const tableName = (data?.table_name as string) || ''
    const schemaName = (data?.schema_name as string) || 'public'

    return (
        <BaseNode
            id={id}
            selected={selected}
            accentColor="bg-emerald-500"
            bgColor="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-600"
            icon={<Database className="h-3.5 w-3.5" />}
            label={label}
            subtitle={tableName ? `${schemaName}.${tableName}` : undefined}
            hasTarget={false}
        >
            {!tableName && (
                <span className="italic text-muted-foreground">No table selected</span>
            )}
        </BaseNode>
    )
})
