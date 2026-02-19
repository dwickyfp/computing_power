import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2, History } from 'lucide-react'
import { type Row } from '@tanstack/react-table'
import { type AlertRule } from '../data/schema'
import { useAlertRules } from './alert-rules-provider'

interface AlertRulesRowActionsProps {
  row: Row<AlertRule>
}

export function AlertRulesRowActions({ row }: AlertRulesRowActionsProps) {
  const { setOpen, setCurrentRow } = useAlertRules()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-8 w-8 p-0'>
          <span className='sr-only'>Open menu</span>
          <MoreHorizontal className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('history')
          }}
        >
          <History className='mr-2 h-4 w-4' />
          View History
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('update')
          }}
        >
          <Pencil className='mr-2 h-4 w-4' />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive'
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('delete')
          }}
        >
          <Trash2 className='mr-2 h-4 w-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
