import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useAlertRules } from './alert-rules-provider'

export function AlertRulesPrimaryButtons() {
  const { setOpen } = useAlertRules()

  return (
    <div className='flex items-center gap-2'>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus className='mr-2 h-4 w-4' />
        Add Alert Rule
      </Button>
    </div>
  )
}
