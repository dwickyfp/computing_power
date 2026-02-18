import { create } from 'zustand'
import {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type Connection,
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react'
import type { FlowNode, FlowEdge, FlowNodeData, NodePreviewResult } from '@/repo/flow-tasks'

interface PreviewState {
    isOpen: boolean
    isLoading: boolean
    nodeId: string | null
    nodeLabel: string | null
    celeryTaskId: string | null
    result: NodePreviewResult | null
    error: string | null
}

interface FlowTaskStore {
    // Graph state
    nodes: FlowNode[]
    edges: FlowEdge[]
    selectedNodeId: string | null
    isDirty: boolean

    // Preview state
    preview: PreviewState

    // Actions — graph
    setNodes: (nodes: FlowNode[]) => void
    setEdges: (edges: FlowEdge[]) => void
    onNodesChange: (changes: NodeChange[]) => void
    onEdgesChange: (changes: EdgeChange[]) => void
    onConnect: (connection: Connection) => void
    addNode: (node: FlowNode) => void
    updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void
    selectNode: (nodeId: string | null) => void
    removeNode: (nodeId: string) => void
    markClean: () => void

    // Actions — preview
    openPreview: (nodeId: string, nodeLabel: string, celeryTaskId: string) => void
    setPreviewLoading: (loading: boolean) => void
    setPreviewResult: (result: NodePreviewResult) => void
    setPreviewError: (error: string) => void
    closePreview: () => void
    // Slot set by FlowCanvas so NodeConfigPanel can trigger preview
    requestPreview: ((nodeId: string, nodeLabel: string) => void) | null
    setRequestPreview: (fn: ((nodeId: string, nodeLabel: string) => void) | null) => void
}

export const useFlowTaskStore = create<FlowTaskStore>((set) => ({
    // Initial state
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isDirty: false,

    preview: {
        isOpen: false,
        isLoading: false,
        nodeId: null,
        nodeLabel: null,
        celeryTaskId: null,
        result: null,
        error: null,
    },

    // ─── Graph actions ──────────────────────────────────────────────────────────

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) =>
        set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes) as FlowNode[],
            isDirty: true,
        })),

    onEdgesChange: (changes) =>
        set((state) => ({
            edges: applyEdgeChanges(changes, state.edges) as FlowEdge[],
            isDirty: true,
        })),

    onConnect: (connection) =>
        set((state) => ({
            edges: addEdge(connection, state.edges) as FlowEdge[],
            isDirty: true,
        })),

    addNode: (node) =>
        set((state) => ({
            nodes: [...state.nodes, node],
            isDirty: true,
        })),

    updateNodeData: (nodeId, data) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ),
            isDirty: true,
        })),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    removeNode: (nodeId) =>
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== nodeId),
            edges: state.edges.filter(
                (e) => e.source !== nodeId && e.target !== nodeId
            ),
            selectedNodeId:
                state.selectedNodeId === nodeId ? null : state.selectedNodeId,
            isDirty: true,
        })),

    markClean: () => set({ isDirty: false }),

    requestPreview: null,
    setRequestPreview: (fn) => set({ requestPreview: fn }),

    // ─── Preview actions ────────────────────────────────────────────────────────

    openPreview: (nodeId, nodeLabel, celeryTaskId) =>
        set({
            preview: {
                isOpen: true,
                isLoading: true,
                nodeId,
                nodeLabel,
                celeryTaskId,
                result: null,
                error: null,
            },
        }),

    setPreviewLoading: (loading) =>
        set((state) => ({
            preview: { ...state.preview, isLoading: loading },
        })),

    setPreviewResult: (result) =>
        set((state) => ({
            preview: { ...state.preview, isLoading: false, result, error: null },
        })),

    setPreviewError: (error) =>
        set((state) => ({
            preview: { ...state.preview, isLoading: false, error, result: null },
        })),

    closePreview: () =>
        set({
            preview: {
                isOpen: false,
                isLoading: false,
                nodeId: null,
                nodeLabel: null,
                celeryTaskId: null,
                result: null,
                error: null,
            },
        }),
}))
