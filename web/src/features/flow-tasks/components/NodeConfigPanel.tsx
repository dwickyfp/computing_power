/**
 * NodeConfigPanel — right-side drawer showing the config form for the selected node.
 * Opens when a node is selected on the canvas.
 */

import { useFlowTaskStore } from '../store/flow-task-store'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { X, Trash2, Eye, Loader2 } from 'lucide-react'
import type { FlowNodeType, FlowNodeData, WriteMode } from '@/repo/flow-tasks'
import { sourcesRepo } from '@/repo/sources'
import { destinationsRepo } from '@/repo/destinations'

export function NodeConfigPanel() {
    const { nodes, selectedNodeId, selectNode, updateNodeData, removeNode, requestPreview } =
        useFlowTaskStore()

    const selectedNode = nodes.find((n) => n.id === selectedNodeId)
    if (!selectedNode) return null

    const update = (patch: Partial<FlowNodeData>) =>
        updateNodeData(selectedNode.id, patch)

    return (
        <div className="flex flex-col h-full w-72 border-l border-border bg-background overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                <p className="text-sm font-semibold capitalize">
                    {selectedNode.type} Config
                </p>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-violet-500 hover:text-violet-600"
                        title="Preview node output"
                        onClick={() => requestPreview?.(selectedNode.id, selectedNode.data.label ?? selectedNode.type)}
                    >
                        <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title="Delete node"
                        onClick={() => {
                            removeNode(selectedNode.id)
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => selectNode(null)}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Common: Label */}
            <div className="px-3 py-3 space-y-3">
                <Field label="Label">
                    <Input
                        className="h-7 text-xs"
                        value={(selectedNode.data.label as string) || ''}
                        onChange={(e) => update({ label: e.target.value })}
                        placeholder="Node label"
                    />
                </Field>
            </div>

            <Separator />

            {/* Type-specific config */}
            <div className="px-3 py-3 space-y-3">
                <NodeTypeConfig type={selectedNode.type} data={selectedNode.data} update={update} />
            </div>
        </div>
    )
}

// ─── Per-type config forms ─────────────────────────────────────────────────────

function NodeTypeConfig({
    type,
    data,
    update,
}: {
    type: FlowNodeType
    data: FlowNodeData
    update: (patch: Partial<FlowNodeData>) => void
}) {
    switch (type) {
        case 'input':
            return <InputConfig data={data} update={update} />
        case 'clean':
            return <CleanConfig data={data} update={update} />
        case 'aggregate':
            return <AggregateConfig data={data} update={update} />
        case 'join':
            return <JoinConfig data={data} update={update} />
        case 'union':
            return <UnionConfig data={data} update={update} />
        case 'pivot':
            return <PivotConfig data={data} update={update} />
        case 'output':
            return <OutputConfig data={data} update={update} />
        default:
            return (
                <p className="text-xs text-muted-foreground">No config for this node type.</p>
            )
    }
}

// ─── Input ─────────────────────────────────────────────────────────────────────

function InputConfig({ data, update }: ConfigFormProps) {
    const sourceType = (data.source_type as 'POSTGRES' | 'SNOWFLAKE') || 'POSTGRES'
    const sourceId = data.source_id as number | undefined
    const destinationId = data.destination_id as number | undefined

    // Fetch all postgres sources
    const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
        queryKey: ['sources'],
        queryFn: () => sourcesRepo.getAll(),
        enabled: sourceType === 'POSTGRES',
        staleTime: 30_000,
    })

    // Fetch all snowflake destinations
    const { data: destsData, isLoading: destsLoading } = useQuery({
        queryKey: ['destinations'],
        queryFn: () => destinationsRepo.getAll(),
        enabled: sourceType === 'SNOWFLAKE',
        staleTime: 30_000,
    })

    const snowflakeDests = destsData?.destinations.filter(
        (d) => d.type.toLowerCase().includes('snowflake')
    ) ?? []

    // Fetch available tables for selected source (postgres)
    const { data: pgTables, isLoading: pgTablesLoading } = useQuery({
        queryKey: ['source-available-tables', sourceId],
        queryFn: () => sourcesRepo.getAvailableTables(sourceId!),
        enabled: sourceType === 'POSTGRES' && !!sourceId,
        staleTime: 30_000,
    })

    // Fetch table list for selected snowflake destination
    const { data: sfTableData, isLoading: sfTablesLoading } = useQuery({
        queryKey: ['destination-tables', destinationId],
        queryFn: () => destinationsRepo.getTableList(destinationId!),
        enabled: sourceType === 'SNOWFLAKE' && !!destinationId,
        staleTime: 30_000,
    })

    const tables: string[] =
        sourceType === 'POSTGRES'
            ? (pgTables ?? [])
            : (sfTableData?.tables ?? [])

    const tablesLoading = sourceType === 'POSTGRES' ? pgTablesLoading : sfTablesLoading
    const activeId = sourceType === 'POSTGRES' ? sourceId : destinationId

    return (
        <>
            <Field label="Source Type">
                <Select
                    value={sourceType}
                    onValueChange={(v) =>
                        update({
                            source_type: v as 'POSTGRES' | 'SNOWFLAKE',
                            source_id: undefined,
                            destination_id: undefined,
                            table_name: undefined,
                            schema_name: undefined,
                        })
                    }
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="POSTGRES">PostgreSQL</SelectItem>
                        <SelectItem value="SNOWFLAKE">Snowflake</SelectItem>
                    </SelectContent>
                </Select>
            </Field>

            {/* Source / Destination selector */}
            <Field label={sourceType === 'POSTGRES' ? 'Source' : 'Destination'}>
                {sourceType === 'POSTGRES' && sourcesLoading && (
                    <div className="flex items-center gap-1.5 h-7 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading sources…
                    </div>
                )}
                {sourceType === 'SNOWFLAKE' && destsLoading && (
                    <div className="flex items-center gap-1.5 h-7 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading destinations…
                    </div>
                )}
                {sourceType === 'POSTGRES' && !sourcesLoading && (
                    <Select
                        value={sourceId != null ? String(sourceId) : ''}
                        onValueChange={(v) =>
                            update({ source_id: parseInt(v), table_name: undefined })
                        }
                    >
                        <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select source…" />
                        </SelectTrigger>
                        <SelectContent>
                            {(sourcesData?.sources ?? []).map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {sourceType === 'SNOWFLAKE' && !destsLoading && (
                    <Select
                        value={destinationId != null ? String(destinationId) : ''}
                        onValueChange={(v) =>
                            update({ destination_id: parseInt(v), table_name: undefined })
                        }
                    >
                        <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select destination…" />
                        </SelectTrigger>
                        <SelectContent>
                            {snowflakeDests.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </Field>

            {/* Table selector — shown only when a source/destination is selected */}
            {!!activeId && (
                <Field label="Table">
                    {tablesLoading ? (
                        <div className="flex items-center gap-1.5 h-7 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading tables…
                        </div>
                    ) : (
                        <Select
                            value={(data.table_name as string) || ''}
                            onValueChange={(v) => update({ table_name: v })}
                        >
                            <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Select table…" />
                            </SelectTrigger>
                            <SelectContent>
                                {tables.length === 0 ? (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                        No tables found
                                    </div>
                                ) : (
                                    tables.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    )}
                </Field>
            )}

            {/* Schema — only relevant for postgres */}
            {sourceType === 'POSTGRES' && (
                <Field label="Schema">
                    <Input
                        className="h-7 text-xs"
                        value={(data.schema_name as string) || 'public'}
                        onChange={(e) => update({ schema_name: e.target.value })}
                    />
                </Field>
            )}

            <Field label="Alias (optional)">
                <Input
                    className="h-7 text-xs"
                    value={(data.alias as string) || ''}
                    onChange={(e) => update({ alias: e.target.value })}
                    placeholder="cte_alias"
                />
            </Field>
        </>
    )
}

// ─── Clean ─────────────────────────────────────────────────────────────────────

function CleanConfig({ data, update }: ConfigFormProps) {
    return (
        <>
            <SwitchField
                label="Drop nulls"
                checked={!!(data.drop_nulls)}
                onChange={(v) => update({ drop_nulls: v })}
            />
            <SwitchField
                label="Deduplicate rows"
                checked={!!(data.deduplicate)}
                onChange={(v) => update({ deduplicate: v })}
            />

            <Field label="Filter expression">
                <Input
                    className="h-7 text-xs font-mono"
                    value={(data.filter_expr as string) || ''}
                    onChange={(e) => update({ filter_expr: e.target.value })}
                    placeholder="e.g. age > 18 AND status = 'active'"
                />
            </Field>

            <Field label="Select columns (comma-separated)">
                <Input
                    className="h-7 text-xs"
                    value={((data.select_columns as string[]) || []).join(', ')}
                    onChange={(e) =>
                        update({
                            select_columns: e.target.value
                                ? e.target.value.split(',').map((s) => s.trim())
                                : [],
                        })
                    }
                    placeholder="col1, col2, col3"
                />
            </Field>
        </>
    )
}

// ─── Aggregate ─────────────────────────────────────────────────────────────────

function AggregateConfig({ data, update }: ConfigFormProps) {
    const groupBy = (data.group_by as string[]) || []

    return (
        <>
            <Field label="Group by columns (comma-separated)">
                <Input
                    className="h-7 text-xs"
                    value={groupBy.join(', ')}
                    onChange={(e) =>
                        update({
                            group_by: e.target.value
                                ? e.target.value.split(',').map((s) => s.trim())
                                : [],
                        })
                    }
                    placeholder="col1, col2"
                />
            </Field>
            <p className="text-[10px] text-muted-foreground">
                Aggregation columns can be configured in full-edit mode.
            </p>
        </>
    )
}

// ─── Join ──────────────────────────────────────────────────────────────────────

function JoinConfig({ data, update }: ConfigFormProps) {
    return (
        <>
            <Field label="Join Type">
                <Select
                    value={(data.join_type as string) || 'INNER'}
                    onValueChange={(v) => update({ join_type: v })}
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {['INNER', 'LEFT', 'RIGHT', 'FULL OUTER', 'CROSS'].map((t) => (
                            <SelectItem key={t} value={t}>
                                {t} JOIN
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
            <p className="text-[10px] text-muted-foreground">
                Connect two nodes to this Join node via edges. The first connected input
                is the left side; the second is the right side.
            </p>
        </>
    )
}

// ─── Union ─────────────────────────────────────────────────────────────────────

function UnionConfig({ data, update }: ConfigFormProps) {
    return (
        <SwitchField
            label="UNION ALL (keep duplicates)"
            checked={(data.union_all as boolean) ?? true}
            onChange={(v) => update({ union_all: v })}
        />
    )
}

// ─── Pivot ─────────────────────────────────────────────────────────────────────

function PivotConfig({ data, update }: ConfigFormProps) {
    const pivotType = (data.pivot_type as string) || 'PIVOT'

    return (
        <>
            <Field label="Pivot Type">
                <Select
                    value={pivotType}
                    onValueChange={(v) => update({ pivot_type: v as 'PIVOT' | 'UNPIVOT' })}
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="PIVOT">PIVOT (rows → columns)</SelectItem>
                        <SelectItem value="UNPIVOT">UNPIVOT (columns → rows)</SelectItem>
                    </SelectContent>
                </Select>
            </Field>

            <Field label="Pivot column">
                <Input
                    className="h-7 text-xs"
                    value={(data.pivot_column as string) || ''}
                    onChange={(e) => update({ pivot_column: e.target.value })}
                    placeholder="category"
                />
            </Field>

            <Field label="Value column">
                <Input
                    className="h-7 text-xs"
                    value={(data.value_column as string) || ''}
                    onChange={(e) => update({ value_column: e.target.value })}
                    placeholder="amount"
                />
            </Field>

            <Field label="Pivot values (comma-separated)">
                <Input
                    className="h-7 text-xs"
                    value={((data.pivot_values as string[]) || []).join(', ')}
                    onChange={(e) =>
                        update({
                            pivot_values: e.target.value
                                ? e.target.value.split(',').map((s) => s.trim())
                                : [],
                        })
                    }
                    placeholder="val1, val2, val3"
                />
            </Field>
        </>
    )
}

// ─── Output ────────────────────────────────────────────────────────────────────

function OutputConfig({ data, update }: ConfigFormProps) {
    return (
        <>
            <Field label="Destination ID">
                <Input
                    className="h-7 text-xs"
                    type="number"
                    value={(data.destination_id as number) ?? ''}
                    onChange={(e) =>
                        update({
                            destination_id: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                        })
                    }
                    placeholder="Destination database ID"
                />
            </Field>

            <Field label="Schema">
                <Input
                    className="h-7 text-xs"
                    value={(data.schema_name as string) || 'public'}
                    onChange={(e) => update({ schema_name: e.target.value })}
                />
            </Field>

            <Field label="Target Table">
                <Input
                    className="h-7 text-xs"
                    value={(data.table_name as string) || ''}
                    onChange={(e) => update({ table_name: e.target.value })}
                    placeholder="output_table"
                />
            </Field>

            <Field label="Write Mode">
                <Select
                    value={(data.write_mode as string) || 'APPEND'}
                    onValueChange={(v) => update({ write_mode: v as WriteMode })}
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="APPEND">APPEND</SelectItem>
                        <SelectItem value="UPSERT">UPSERT (MERGE)</SelectItem>
                        <SelectItem value="REPLACE">REPLACE (truncate + insert)</SelectItem>
                    </SelectContent>
                </Select>
            </Field>

            <Field label="Upsert keys (comma-separated)">
                <Input
                    className="h-7 text-xs"
                    value={((data.upsert_keys as string[]) || []).join(', ')}
                    onChange={(e) =>
                        update({
                            upsert_keys: e.target.value
                                ? e.target.value.split(',').map((s) => s.trim())
                                : [],
                        })
                    }
                    placeholder="id, created_at"
                />
            </Field>
        </>
    )
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

type ConfigFormProps = {
    data: FlowNodeData
    update: (patch: Partial<FlowNodeData>) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {label}
            </Label>
            {children}
        </div>
    )
}

function SwitchField({
    label,
    checked,
    onChange,
}: {
    label: string
    checked: boolean
    onChange: (v: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between">
            <Label className="text-xs">{label}</Label>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    )
}
