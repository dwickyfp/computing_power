import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { alertRulesRepo } from '@/repo/alert-rules'
import { AlertRulesProvider } from '../components/alert-rules-provider'
import { AlertRulesTable } from '../components/alert-rules-table'
import { AlertRulesPrimaryButtons } from '../components/alert-rules-primary-buttons'
import { AlertRulesDialogs } from '../components/alert-rules-dialogs'

export function AlertRulesListPage() {
  const { data } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => alertRulesRepo.list(),
    refetchInterval: 15_000,
  })

  const rules = data?.data?.items ?? []

  return (
    <AlertRulesProvider>
      <Header fixed>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Alert Rules</h2>
            <p className='text-muted-foreground text-sm'>
              Configure automated alerts based on pipeline and system metrics.
            </p>
          </div>
          <AlertRulesPrimaryButtons />
        </div>

        <AlertRulesTable data={rules} />
      </Main>

      <AlertRulesDialogs />
    </AlertRulesProvider>
  )
}
