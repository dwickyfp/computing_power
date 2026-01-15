import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sourcesRepo } from '@/repo/sources'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { SourceDetailsMetrics } from '../components/source-details-metrics'
import { SourceDetailsTablesList } from '../components/source-details-tables-list'
import { SourceDetailsCreatePublicationDialog } from '../components/source-details-create-publication-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function SourceDetailsPage() {
    // Use TansStack Router useParams
    const { sourceId } = useParams({ from: '/_authenticated/sources/$sourceId/details' })
    const id = parseInt(sourceId)
    const queryClient = useQueryClient()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isPublicationLoading, setIsPublicationLoading] = useState(false)
    const [isReplicationLoading, setIsReplicationLoading] = useState(false)
    const [createPubDialogOpen, setCreatePubDialogOpen] = useState(false)

    const { data, isLoading, error } = useQuery({
        queryKey: ['source-details', id],
        queryFn: () => sourcesRepo.getDetails(id!),
        enabled: !!id,
    })

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await sourcesRepo.refreshSource(id)
            queryClient.invalidateQueries({ queryKey: ['source-details', id] })
            toast.success("Source refreshed successfully")
        } catch (err) {
            console.error(err)
            toast.error("Failed to refresh source")
        } finally {
            setIsRefreshing(false)
        }
    }

    const handlePublicationAction = async () => {
        if (data?.source.is_publication_enabled) {
            // Drop Publication
            if (!window.confirm("Are you sure you want to drop the publication? This will stop CDC.")) return
            setIsPublicationLoading(true)
            try {
                await sourcesRepo.dropPublication(id)
                queryClient.invalidateQueries({ queryKey: ['source-details', id] })
                toast.success("Publication dropped successfully")
            } catch (err) {
                console.error(err)
                toast.error("Failed to drop publication")
            } finally {
                setIsPublicationLoading(false)
            }
        } else {
            // Create Publication -> Open Dialog
            setCreatePubDialogOpen(true)
        }
    }

    const handleReplicationAction = async () => {
        setIsReplicationLoading(true)
        try {
            if (data?.source.is_replication_enabled) {
                // Drop Replication
                if (!window.confirm("Are you sure you want to drop the replication slot?")) return
                await sourcesRepo.dropReplication(id)
                toast.success("Replication slot dropped successfully")
            } else {
                // Create Replication
                await sourcesRepo.createReplication(id)
                toast.success("Replication slot created successfully")
            }
            queryClient.invalidateQueries({ queryKey: ['source-details', id] })
        } catch (err) {
            console.error(err)
            toast.error(`Failed to ${data?.source.is_replication_enabled ? 'drop' : 'create'} replication slot`)
        } finally {
            setIsReplicationLoading(false)
        }
    }

    if (!id) return <div>Invalid Source ID</div>

    return (
        <>
            <Header fixed>
                <Search />
                <div className='ms-auto flex items-center space-x-4'>
                    <ThemeSwitch />
                    <ConfigDrawer />
                </div>
            </Header>

            <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
                <div className='flex items-start justify-between'>
                    <div className="space-y-1">
                        <h2 className='text-2xl font-bold tracking-tight'>
                            {isLoading ? <Skeleton className="h-8 w-48" /> : data?.source.name}
                        </h2>
                        <div className='flex flex-col gap-2 text-sm text-muted-foreground mt-2'>
                            <div className="flex items-center gap-2">
                                <span>Publication:</span>
                                <span className="font-medium text-foreground">{data?.source.publication_name}</span>
                                <Badge 
                                    variant="secondary"
                                    className={cn(
                                        data?.source.is_publication_enabled 
                                            ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" 
                                            : ""
                                    )}
                                >
                                    {data?.source.is_publication_enabled ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Replication Slot:</span>
                                <span className="font-medium text-foreground">supabase_etl_apply_{data?.source.replication_id}</span>
                                <Badge 
                                    variant="secondary"
                                    className={cn(
                                        data?.source.is_replication_enabled 
                                            ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" 
                                            : ""
                                    )}
                                >
                                    {data?.source.is_replication_enabled ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRefresh} 
                            disabled={isRefreshing || isLoading}
                        >
                            <RefreshCcw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button
                            variant={data?.source.is_publication_enabled ? "destructive" : "default"}
                            size="sm"
                            onClick={handlePublicationAction}
                            disabled={isPublicationLoading || isLoading}
                        >
                            {isPublicationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {data?.source.is_publication_enabled ? "Drop Publication" : "Create Publication"}
                        </Button>
                         <Button
                            variant={data?.source.is_replication_enabled ? "destructive" : "default"}
                            size="sm"
                            onClick={handleReplicationAction}
                            disabled={isReplicationLoading || isLoading}
                        >
                            {isReplicationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {data?.source.is_replication_enabled ? "Drop Replication" : "Create Replication"}
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : error ? (
                    <div className="text-red-500">Error loading source details</div>
                ) : (
                    <>
                        <SourceDetailsMetrics data={data?.wal_monitor || null} dataDestinations={data?.destinations || []} />
                        <SourceDetailsTablesList 
                            sourceId={id} 
                            tables={data?.tables || []} 
                            listTables={data?.source.list_tables || []}
                        />
                         <SourceDetailsCreatePublicationDialog 
                            open={createPubDialogOpen}
                            onOpenChange={setCreatePubDialogOpen}
                            sourceId={id}
                            listTables={data?.source.list_tables || []}
                        />
                    </>
                )}
            </Main>
        </>
    )
}
