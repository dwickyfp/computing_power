import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
import { useDataCatalog } from './data-catalog-provider'

interface DataCatalogPrimaryButtonsProps {
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function DataCatalogPrimaryButtons({
  onRefresh,
  isRefreshing,
}: DataCatalogPrimaryButtonsProps) {
  const { setOpen } = useDataCatalog()

  return (
    <div className='flex items-center gap-2'>
      {onRefresh && (
        <Button variant='outline' size='sm' onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      )}
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus className='mr-2 h-4 w-4' />
        Add Catalog Entry
      </Button>
    </div>
  )
}
