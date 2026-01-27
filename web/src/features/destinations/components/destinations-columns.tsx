import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { type Destination } from '../data/schema'
import { DestinationsRowActions } from './destinations-row-actions'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Info, Snowflake } from 'lucide-react'

export const destinationsColumns: ColumnDef<Destination>[] = [
    {
        id: 'details',
        header: () => <div className="text-center font-semibold w-[50px]">Action</div>,
        cell: ({ row }) => (
            <div className='flex items-center justify-center w-[50px]'>
                <DestinationDetailsButton destinationId={row.original.id} />
            </div>
        ),
        meta: { title: 'Detail' },
    },
    {
        accessorKey: 'name',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title='Name' />
        ),
        cell: ({ row }) => (
            <div className='flex items-center'>
                <span className='truncate font-medium'>{row.getValue('name')}</span>
            </div>
        ),
        meta: { title: 'Name' },
    },
    {
        accessorKey: 'type',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title='Type' className="w-[200px]" />
        ),
        cell: ({ row }) => {
            const type = row.getValue('type') as string
            const isSnowflake = type.toLowerCase() === 'snowflake'
            const isPostgres = type.toLowerCase() === 'postgres'
            return (
                <div className={`flex items-center gap-2 w-[200px] ${isSnowflake ? 'text-[#29b5e8]' : ''}`}>
                    {isSnowflake && <Snowflake className='h-4 w-4' />}
                    <span className='truncate font-medium capitalize'>
                        {isPostgres ? (
                            <span>Postgre<span style={{ color: '#316192' }}>SQL</span></span>
                        ) : (
                            type
                        )}
                    </span>
                </div>
            )
        },
        meta: { title: 'Type' },
    },
    {
        id: 'actions',
        cell: ({ row }) => <div className="w-[50px] flex justify-end"><DestinationsRowActions row={row} /></div>,
        meta: { title: 'Actions' },
    },
]

function DestinationDetailsButton({ destinationId }: { destinationId: number }) {
    const navigate = useNavigate()
    return (
        <Button
            variant="ghost"
            size="icon"
            className='h-8 w-8 p-0'
            onClick={() => navigate({ to: '/destinations/$destinationId', params: { destinationId: destinationId } })}
        >
            <Info className="h-4 w-4" />
        </Button>
    )
}
