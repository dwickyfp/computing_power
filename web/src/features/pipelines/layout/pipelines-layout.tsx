import { PipelinesSidebar } from "@/features/pipelines/components/pipelines-sidebar"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

interface PipelinesLayoutProps {
    children: React.ReactNode
}

export function PipelinesLayout({ children }: PipelinesLayoutProps) {
    return (
        <ResizablePanelGroup
            className="h-full w-full rounded-lg border-t border-border"
        >
            <ResizablePanel
                defaultSize={20}
                minSize={15}
                maxSize={360}
                className="min-w-[250px]"
            >
                <PipelinesSidebar />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={80}>
                <div className="h-full w-full overflow-y-auto">
                    {children}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
