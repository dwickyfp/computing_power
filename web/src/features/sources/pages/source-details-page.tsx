
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { sourcesRepo } from '@/repo/sources'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { SourceDetailsMetrics } from '../components/source-details-metrics'
import { SourceDetailsTablesList } from '../components/source-details-tables-list'
import { Skeleton } from '@/components/ui/skeleton'

export default function SourceDetailsPage() {
    // Use TansStack Router useParams
    const { sourceId } = useParams({ from: '/_authenticated/sources/$sourceId/details' })
    const id = parseInt(sourceId)

    const { data, isLoading, error } = useQuery({
        queryKey: ['source-details', id],
        queryFn: () => sourcesRepo.getDetails(id!),
        enabled: !!id,
    })

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
                <div className='flex items-center justify-between'>
                    <div>
                        <h2 className='text-2xl font-bold tracking-tight'>
                            {isLoading ? <Skeleton className="h-8 w-48" /> : data?.source.name}
                        </h2>
                        <p className='text-muted-foreground'>
                            Source Details
                        </p>
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
                        <SourceDetailsTablesList tables={data?.tables || []} />
                    </>
                )}
            </Main>
        </>
    )
}
