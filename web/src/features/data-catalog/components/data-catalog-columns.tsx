import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { type DataCatalog } from '../data/schema'
import { DataCatalogRowActions } from './data-catalog-row-actions'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

export const dataCatalogColumns: ColumnDef<DataCatalog>[] = [
  {
    accessorKey: 'table_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Table' />
    ),
    cell: ({ row }) => (
      <div className='font-medium'>{row.getValue('table_name')}</div>
    ),
  },
  {
    accessorKey: 'schema_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Schema' />
    ),
    cell: ({ row }) => (
      <span className='text-muted-foreground'>
        {row.getValue('schema_name')}
      </span>
    ),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Description' />
    ),
    cell: ({ row }) => {
      const desc = row.getValue('description') as string | null
      return (
        <span className='max-w-[300px] truncate text-sm'>
          {desc || <span className='text-muted-foreground italic'>—</span>}
        </span>
      )
    },
  },
  {
    accessorKey: 'owner',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Owner' />
    ),
    cell: ({ row }) => {
      const owner = row.getValue('owner') as string | null
      return owner ? (
        <Badge variant='outline'>{owner}</Badge>
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
  },
  {
    accessorKey: 'classification',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Classification' />
    ),
    cell: ({ row }) => {
      const cls = row.getValue('classification') as string | null
      if (!cls) return <span className='text-muted-foreground'>—</span>
      const variant =
        cls === 'PII'
          ? 'destructive'
          : cls === 'SENSITIVE'
            ? 'default'
            : 'secondary'
      return <Badge variant={variant}>{cls}</Badge>
    },
  },
  {
    accessorKey: 'tags',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tags' />
    ),
    cell: ({ row }) => {
      const tags = row.getValue('tags') as string[] | null
      if (!tags || tags.length === 0) return <span className='text-muted-foreground'>—</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {tags.map((t) => (
            <Badge key={t} variant='secondary' className='text-xs'>{t}</Badge>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: 'updated_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Updated' />
    ),
    cell: ({ row }) => {
      const val = row.getValue('updated_at') as string
      return (
        <span className='text-muted-foreground text-xs'>
          {formatDistanceToNow(new Date(val), { addSuffix: true })}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataCatalogRowActions row={row} />,
  },
]
