import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { dataCatalogRepo } from '@/repo/data-catalog'
import { DataCatalogProvider } from '../components/data-catalog-provider'
import { DataCatalogTable } from '../components/data-catalog-table'
import { DataCatalogPrimaryButtons } from '../components/data-catalog-primary-buttons'
import { DataCatalogDialogs } from '../components/data-catalog-dialogs'

export function DataCatalogListPage() {
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['data-catalog'],
    queryFn: () => dataCatalogRepo.list(),
    refetchInterval: 30_000,
  })

  const catalogs = data?.data?.items ?? []

  return (
    <DataCatalogProvider>
      <Header fixed>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Data Catalog</h2>
            <p className='text-muted-foreground text-sm'>
              Browse and document your data assets with metadata, ownership, and
              classification.
            </p>
          </div>
          <DataCatalogPrimaryButtons
            onRefresh={() => refetch()}
            isRefreshing={isRefetching}
          />
        </div>

        <DataCatalogTable data={catalogs} />
      </Main>

      <DataCatalogDialogs />
    </DataCatalogProvider>
  )
}
