/**
 * FlowTaskFlowPage — full-screen ReactFlow editor for a single Flow Task.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Top bar: breadcrumb / Save / Run / status           │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Palette │        ReactFlow Canvas          │ Config  │
 *   │  (w-56) │                                 │  Panel  │
 *   │         │                                 │  (w-72) │
 *   │         │                                 │         │
 *   │         ├─────────────────────────────────┤         │
 *   │         │  Preview Drawer (slide up)       │         │
 *   └─────────┴─────────────────────────────────┴─────────┘
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
    type OnConnect,
    type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { Button } from '@/components/ui/button'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import {
    Save,
    Play,
    Loader2,
    ChevronLeft,
    AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { type FlowGraph, type FlowNode, flowTasksRepo } from '@/repo/flow-tasks'
import { useFlowTaskStore } from '../store/flow-task-store'
import { useTheme } from '@/context/theme-provider'
import { NodePalette } from '../components/NodePalette'
import { NodeConfigPanel } from '../components/NodeConfigPanel'
import { PreviewDrawer } from '../components/PreviewDrawer'

// Node type registry — maps node type strings to components
import { InputNode } from '../components/nodes/InputNode'
import { CleanNode } from '../components/nodes/CleanNode'
import { AggregateNode } from '../components/nodes/AggregateNode'
import { JoinNode } from '../components/nodes/JoinNode'
import { UnionNode } from '../components/nodes/UnionNode'
import { PivotNode } from '../components/nodes/PivotNode'
import { NewRowsNode } from '../components/nodes/NewRowsNode'
import { OutputNode } from '../components/nodes/OutputNode'

const nodeTypes = {
    input: InputNode,
    clean: CleanNode,
    aggregate: AggregateNode,
    join: JoinNode,
    union: UnionNode,
    pivot: PivotNode,
    new_rows: NewRowsNode,
    output: OutputNode,
}

let nodeIdCounter = 1
function generateNodeId(type: string) {
    return `${type}_${nodeIdCounter++}_${Date.now()}`
}

// ─── Inner canvas component (must be inside ReactFlowProvider) ─────────────────

function FlowCanvas({ flowTaskId }: { flowTaskId: number }) {
    const queryClient = useQueryClient()
    const reactFlowRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rfInstance = useRef<any>(null)
    const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)

    const {
        nodes,
        edges,
        selectedNodeId,
        isDirty,
        setNodes,
        setEdges,
        onNodesChange,
        onEdgesChange,
        onConnect: storeOnConnect,
        addNode,
        selectNode,
        markClean,
        openPreview,
        setPreviewResult,
        setPreviewError,
        setRequestPreview,
        closePreview,
    } = useFlowTaskStore()

    // Always close the preview drawer when entering the flow editor
    useEffect(() => {
        closePreview()
    }, [])  // eslint-disable-line react-hooks/exhaustive-deps

    // Load graph from API
    const { data: ftResp } = useQuery({
        queryKey: ['flow-tasks', flowTaskId],
        queryFn: () => flowTasksRepo.get(flowTaskId),
    })

    const { isLoading: graphLoading, data: graphData, isError: graphIsError } = useQuery({
        queryKey: ['flow-tasks', flowTaskId, 'graph'],
        queryFn: () => flowTasksRepo.getGraph(flowTaskId),
        retry: false,
    })

    useEffect(() => {
        if (graphData) {
            const graph = graphData.data
            setNodes(graph.nodes)
            setEdges(graph.edges)
            markClean()
        }
    }, [graphData, setNodes, setEdges, markClean])

    useEffect(() => {
        if (graphIsError) {
            // Graph not yet saved — start empty
            setNodes([])
            setEdges([])
            markClean()
        }
    }, [graphIsError, setNodes, setEdges, markClean])

    // Poll Celery task
    const { data: runStatusData } = useQuery({
        queryKey: ['flow-task-run-status', pollingTaskId],
        queryFn: () => flowTasksRepo.getTaskStatus(pollingTaskId!),
        enabled: !!pollingTaskId,
        refetchInterval: 2000,
        select: (r) => r.data,
    })

    useEffect(() => {
        if (!runStatusData) return
        if (runStatusData.state === 'SUCCESS' || runStatusData.state === 'FAILURE') {
            setPollingTaskId(null)
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['flow-tasks', flowTaskId] })
            }, 300)
            if (runStatusData.state === 'SUCCESS') {
                toast.success('Run completed successfully!')
            } else {
                toast.error('Run failed.')
            }
        }
    }, [runStatusData, flowTaskId, queryClient])

    // Poll preview task
    const [previewPollingTaskId, setPreviewPollingTaskId] = useState<string | null>(null)

    const { data: previewStatusData } = useQuery({
        queryKey: ['flow-task-preview-status', previewPollingTaskId],
        queryFn: () => flowTasksRepo.getTaskStatus(previewPollingTaskId!),
        enabled: !!previewPollingTaskId,
        refetchInterval: 1500,
        select: (r) => r.data,
    })

    useEffect(() => {
        if (!previewStatusData) return
        if (previewStatusData.state === 'SUCCESS') {
            setPreviewPollingTaskId(null)
            setPreviewResult(previewStatusData.result as never)
        } else if (previewStatusData.state === 'FAILURE') {
            setPreviewPollingTaskId(null)
            setPreviewError((previewStatusData.error as string) || 'Preview failed')
        }
    }, [previewStatusData, setPreviewResult, setPreviewError])

    // ─── Save ──────────────────────────────────────────────────────────────────

    const saveMutation = useMutation({
        mutationFn: () => {
            const graph: FlowGraph = { nodes, edges }
            return flowTasksRepo.saveGraph(flowTaskId, graph)
        },
        onSuccess: () => {
            markClean()
            toast.success('Graph saved')
            setTimeout(
                () => queryClient.invalidateQueries({ queryKey: ['flow-tasks', flowTaskId] }),
                300
            )
        },
        onError: () => toast.error('Failed to save graph'),
    })

    // ─── Run ───────────────────────────────────────────────────────────────────

    const runMutation = useMutation({
        mutationFn: () => flowTasksRepo.run(flowTaskId),
        onSuccess: (resp) => {
            setPollingTaskId(resp.data.celery_task_id)
            toast.info('Flow task started')
        },
        onError: () => toast.error('Failed to trigger run'),
    })

    // ─── Drag-and-drop new nodes onto canvas ───────────────────────────────────

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault()
            if (!rfInstance.current || !reactFlowRef.current) return

            const nodeType = event.dataTransfer.getData('application/reactflow-node-type') as FlowNode['type']
            const nodeLabel = event.dataTransfer.getData('application/reactflow-node-label')
            if (!nodeType) return

            const bounds = reactFlowRef.current.getBoundingClientRect()
            const position = rfInstance.current!.screenToFlowPosition({
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            })

            const newNode: FlowNode = {
                id: generateNodeId(nodeType),
                type: nodeType,
                position,
                data: { label: nodeLabel },
            }
            addNode(newNode)
        },
        [rfInstance, addNode]
    )

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    // ─── Node click → select ───────────────────────────────────────────────────

    const onNodeClick: NodeMouseHandler = useCallback(
        (_event, node) => {
            selectNode(node.id)
        },
        [selectNode]
    )

    const onPaneClick = useCallback(() => selectNode(null), [selectNode])

    // ─── Preview a node ────────────────────────────────────────────────────────

    const handlePreviewNode = useCallback(
        async (nodeId: string, nodeLabel: string) => {
            const graphSnapshot: FlowGraph = { nodes, edges }
            try {
                const resp = await flowTasksRepo.previewNode(flowTaskId, {
                    node_id: nodeId,
                    nodes: graphSnapshot.nodes,
                    edges: graphSnapshot.edges,
                    limit: 500,
                })
                const { task_id } = resp.data
                openPreview(nodeId, nodeLabel, task_id)
                setPreviewPollingTaskId(task_id)
            } catch {
                toast.error('Failed to submit preview')
            }
        },
        [nodes, edges, flowTaskId, openPreview]
    )

    // Register handler in store so NodeConfigPanel can call it
    useEffect(() => {
        setRequestPreview(handlePreviewNode)
        return () => setRequestPreview(null)
    }, [handlePreviewNode, setRequestPreview])

    const ft = ftResp?.data
    const isRunning = ft?.status === 'RUNNING' || !!pollingTaskId
    const { resolvedTheme } = useTheme()

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background z-10 flex-shrink-0">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/flow-tasks" className="flex items-center gap-1">
                                    <ChevronLeft className="h-3 w-3" />
                                    Flow Tasks
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        {ft && (
                            <>
                                <BreadcrumbItem>
                                    <BreadcrumbLink asChild>
                                        <Link
                                            to="/flow-tasks/$flowTaskId"
                                            params={{ flowTaskId: String(flowTaskId) }}
                                        >
                                            {ft.name}
                                        </Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                            </>
                        )}
                        <BreadcrumbItem>
                            <BreadcrumbPage>Flow Editor</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="ml-auto flex items-center gap-2">
                    {isDirty && (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">
                            <AlertCircle className="h-2.5 w-2.5 mr-1" />
                            Unsaved
                        </Badge>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || !isDirty}
                    >
                        {saveMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => runMutation.mutate()}
                        disabled={runMutation.isPending || isRunning}
                    >
                        {isRunning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Run
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Palette */}
                <div className="w-56 flex-shrink-0 border-r border-border">
                    <NodePalette />
                </div>

                {/* Canvas */}
                <div
                    className="flex-1 relative"
                    ref={reactFlowRef}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                >
                    {graphLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            colorMode={resolvedTheme}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={storeOnConnect as OnConnect}
                            onInit={(inst) => { rfInstance.current = inst }}
                            onNodeClick={onNodeClick}
                            onPaneClick={onPaneClick}
                            fitView
                            deleteKeyCode="Delete"
                        >
                            <Background gap={16} />
                            <Controls />
                            <MiniMap
                                nodeColor={(n) => {
                                    if (n.type === 'input') return '#10b981'
                                    if (n.type === 'output') return '#f43f5e'
                                    return '#6366f1'
                                }}
                                className="rounded-md border border-border"
                            />
                        </ReactFlow>
                    )}

                    {/* Preview Drawer (absolute bottom) */}
                    <PreviewDrawer />
                </div>

                {/* Right Config Panel */}
                {selectedNodeId && <NodeConfigPanel />}
            </div>
        </div>
    )
}

// ─── Page wrapper with ReactFlowProvider ───────────────────────────────────────

export default function FlowTaskFlowPage() {
    const { flowTaskId } = useParams({
        from: '/_authenticated/flow-tasks/$flowTaskId/flow',
    })
    const id = parseInt(flowTaskId)

    return (
        <ReactFlowProvider>
            <FlowCanvas flowTaskId={id} />
        </ReactFlowProvider>
    )
}
