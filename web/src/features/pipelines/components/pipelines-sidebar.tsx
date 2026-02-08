import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { useQuery } from '@tanstack/react-query'
import { pipelinesRepo, Pipeline } from '@/repo/pipelines'
import { sourcesRepo } from '@/repo/sources'
import { Link, useParams } from '@tanstack/react-router'
import { Database, Folder, Table, Layers, Milestone, Loader2, Search, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// -- Sub-components for clean recursion

function TableItem({ name, isActive }: { name: string, isActive?: boolean }) {
    return (
        <div className="relative group/table">
            <div className={cn(
                "absolute left-0 top-1/2 w-3 h-px bg-border -translate-y-1/2",
                // "group-hover/table:bg-accent-foreground/50 transition-colors"
            )} />
            <div className={cn(
                "flex items-center gap-2 py-1 px-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer ml-3",
                isActive && "bg-accent text-accent-foreground font-medium"
            )}>
                <Table className="h-3 w-3 shrink-0" />
                <span className="truncate">{name}</span>
            </div>
        </div>
    )
}

function SourceTables({ sourceId }: { sourceId: number }) {
    const { data: details, isLoading } = useQuery({
        queryKey: ['source-details', sourceId],
        queryFn: () => sourcesRepo.getDetails(sourceId),
    })

    if (isLoading) {
        return <div className="ml-6 py-1"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>
    }

    if (!details?.tables?.length) {
        return <div className="ml-6 py-1 text-xs text-muted-foreground">No tables found</div>
    }

    return (
        <div className="flex flex-col gap-0.5 mt-1 border-l border-border ml-2 pl-1">
            {details.tables.map((table) => (
                <TableItem key={table.id} name={table.table_name} />
            ))}
        </div>
    )
}

function PipelineItem({ pipeline }: { pipeline: Pipeline, isActive: boolean }) {
    // We use a separate accordion for the internal structure of each pipeline
    // or just nested items if the parent accordion handles the pipeline level.
    // Here we assume the parent accordion handles opening/closing the pipeline.

    const sourceName = pipeline.source?.name || 'Source'
    const destinations = pipeline.destinations || []

    return (
        <div className="flex flex-col gap-1 pb-2">
            <Accordion type="multiple" className="w-full">
                {/* SOURCES FOLDER */}
                <AccordionItem value="sources" className="border-none">
                    <AccordionTrigger chevronPosition="left" className="justify-start py-1 px-2 gap-1.5 hover:bg-muted/50 hover:no-underline rounded-md text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-orange-500" />
                            <span>Sources</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-0.5">
                        <Accordion type="multiple" className="w-full ml-2 border-l border-border/50 pl-2">
                            <AccordionItem value={`src-${pipeline.source_id}`} className="border-none">
                                <AccordionTrigger chevronPosition="left" className="justify-start py-1 px-2 gap-1.5 hover:bg-muted/50 hover:no-underline rounded-md text-sm">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-3.5 w-3.5 text-blue-500" />
                                        <span>{sourceName}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0">
                                    <SourceTables sourceId={pipeline.source_id} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>

                {/* DESTINATIONS FOLDER */}
                <AccordionItem value="destinations" className="border-none">
                    <AccordionTrigger chevronPosition="left" className="justify-start py-1 px-2 gap-1.5 hover:bg-muted/50 hover:no-underline rounded-md text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-indigo-500" />
                            <span>Destinations</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-0.5">
                        <div className="flex flex-col gap-1 ml-2 border-l border-border/50 pl-2">
                            {destinations.length === 0 && (
                                <div className="text-xs text-muted-foreground px-2 py-1">No destinations</div>
                            )}
                            {destinations.map(d => (
                                <Accordion key={d.id} type="multiple" className="w-full">
                                    <AccordionItem value={`dest-${d.id}`} className="border-none">
                                        <AccordionTrigger chevronPosition="left" className="justify-start py-1 px-2 gap-1.5 hover:bg-muted/50 hover:no-underline rounded-md text-sm">
                                            <div className="flex items-center gap-2">
                                                <Layers className="h-3.5 w-3.5 text-purple-500" />
                                                <span className="truncate">{d.destination.name}</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-0">
                                            <div className="flex flex-col gap-0.5 mt-1 border-l border-border ml-2 pl-1">
                                                {/* We don't have table list for destinations readily available in the pipeline object 
                                                     without fetching details, or maybe we do in table_syncs? 
                                                     Let's check the type definition. 
                                                     Pipeline -> destinations -> table_syncs exists!
                                                 */}
                                                {d.table_syncs?.map(sync => (
                                                    <TableItem
                                                        key={sync.id}
                                                        name={sync.table_name_target || sync.table_name}
                                                    />
                                                ))}
                                                {(!d.table_syncs || d.table_syncs.length === 0) && (
                                                    <div className="ml-5 py-1 text-xs text-muted-foreground">No synced tables</div>
                                                )}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}

export function PipelinesSidebar() {
    const { pipelineId } = useParams({ strict: false }) as { pipelineId?: string }
    const currentId = pipelineId ? parseInt(pipelineId) : null
    const [searchQuery, setSearchQuery] = useState("")

    const { data: pipelinesData, isLoading, isError, refetch } = useQuery({
        queryKey: ['pipelines'],
        queryFn: pipelinesRepo.getAll,
    })

    if (isError) {
        return (
            <div className="p-4 text-sm text-destructive">
                Failed to load pipelines.
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="p-4 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const pipelines = pipelinesData?.pipelines || []

    const filteredPipelines = pipelines.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
            {/* Header: Search & Refresh */}
            <div className="p-3 border-b border-sidebar-border space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search"
                            className="h-8 pl-8 text-xs bg-sidebar-accent/50 border-sidebar-border"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => refetch()}
                        title="Refresh pipelines"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2">
                    {filteredPipelines.length === 0 && (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            No pipelines found
                        </div>
                    )}
                    <Accordion type="multiple" defaultValue={currentId ? [`pipeline-${currentId}`] : []} className="w-full">
                        {filteredPipelines.map(pipeline => (
                            <AccordionItem key={pipeline.id} value={`pipeline-${pipeline.id}`} className="border-none mb-1">
                                <div className="group relative">
                                    <AccordionTrigger chevronPosition="left" className={cn(
                                        "justify-start py-2 px-2 pr-8 gap-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline rounded-md text-sm font-semibold flex-1",
                                        currentId === pipeline.id && "bg-[#d6e7ff] text-[#065bd8] hover:bg-[#d6e7ff] hover:text-[#065bd8]"
                                    )}>
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <Milestone className={cn("h-4 w-4 shrink-0", currentId === pipeline.id ? "text-[#065bd8]" : "text-primary")} />
                                            <span className="truncate">{pipeline.name}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <Link
                                        to="/pipelines/$pipelineId"
                                        params={{ pipelineId: pipeline.id.toString() }}
                                        className={cn(
                                            "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-md transition-opacity",
                                            currentId === pipeline.id
                                                ? "text-[#065bd8] hover:bg-white/20"
                                                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent-foreground/5"
                                        )}
                                        title="Go to details"
                                    >
                                        <Milestone className="h-3 w-3" />
                                    </Link>
                                </div>
                                <AccordionContent className="pb-0 pt-1 pl-2">
                                    <div className="border-l border-border/40 pl-2">
                                        <PipelineItem pipeline={pipeline} isActive={currentId === pipeline.id} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </ScrollArea>
        </div>
    )
}
