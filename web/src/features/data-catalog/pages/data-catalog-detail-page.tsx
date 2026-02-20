import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Key,
  CircleDot,
} from 'lucide-react'
import { dataCatalogRepo } from '@/repo/data-catalog'
import { formatDistanceToNow } from 'date-fns'

export function DataCatalogDetailPage() {
  const { catalogId } = useParams({
    from: '/_authenticated/data-catalog/$catalogId',
  })
  const navigate = useNavigate()

  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<{
    id?: number
    column_name: string
    data_type: string
    description: string
    is_pii: boolean
    is_nullable: boolean
    sample_values: string
  } | null>(null)

  // ─── Queries ──────────────────────────────────────────────────────

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['data-catalog', catalogId],
    queryFn: () => dataCatalogRepo.get(catalogId),
    retry: false,
  })

  const { data: columnsData, refetch: refetchColumns } = useQuery({
    queryKey: ['data-catalog', catalogId, 'columns'],
    queryFn: () => dataCatalogRepo.getColumns(catalogId),
    enabled: !!catalog,
  })

  const catalogEntry = catalog?.data
  const columns = columnsData?.data ?? []

  // ─── Mutations ────────────────────────────────────────────────────

  const addColumnMutation = useMutation({
    mutationFn: (data: typeof editingColumn) =>
      dataCatalogRepo.addColumn(catalogId, {
        column_name: data!.column_name,
        data_type: data!.data_type || undefined,
        description: data!.description || undefined,
        is_pii: data!.is_pii,
        is_nullable: data!.is_nullable,
        sample_values: data!.sample_values || undefined,
      }),
    onSuccess: async () => {
      toast.success('Column added')
      setColumnDialogOpen(false)
      setEditingColumn(null)
      await new Promise((r) => setTimeout(r, 300))
      refetchColumns()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateColumnMutation = useMutation({
    mutationFn: (data: typeof editingColumn) =>
      dataCatalogRepo.updateColumn(data!.id!, {
        column_name: data!.column_name,
        data_type: data!.data_type || undefined,
        description: data!.description || undefined,
        is_pii: data!.is_pii,
        is_nullable: data!.is_nullable,
        sample_values: data!.sample_values || undefined,
      }),
    onSuccess: async () => {
      toast.success('Column updated')
      setColumnDialogOpen(false)
      setEditingColumn(null)
      await new Promise((r) => setTimeout(r, 300))
      refetchColumns()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: number) =>
      dataCatalogRepo.removeColumn(columnId),
    onSuccess: async () => {
      toast.success('Column removed')
      await new Promise((r) => setTimeout(r, 300))
      refetchColumns()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ─── Handlers ─────────────────────────────────────────────────────

  const openNewColumn = () => {
    setEditingColumn({
      column_name: '',
      data_type: '',
      description: '',
      is_pii: false,
      is_nullable: true,
      sample_values: '',
    })
    setColumnDialogOpen(true)
  }

  const openEditColumn = (col: (typeof columns)[0]) => {
    setEditingColumn({
      id: col.id,
      column_name: col.column_name,
      data_type: col.data_type ?? '',
      description: col.description ?? '',
      is_pii: col.is_pii,
      is_nullable: col.is_nullable,
      sample_values: col.sample_values ?? '',
    })
    setColumnDialogOpen(true)
  }

  const handleColumnSubmit = () => {
    if (!editingColumn) return
    if (editingColumn.id) {
      updateColumnMutation.mutate(editingColumn)
    } else {
      addColumnMutation.mutate(editingColumn)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <Header fixed>
          <Search />
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
          </div>
        </Header>
        <Main className='space-y-6'>
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-40 w-full' />
        </Main>
      </>
    )
  }

  if (!catalogEntry) {
    return (
      <>
        <Header fixed>
          <Search />
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
          </div>
        </Header>
        <Main className='flex flex-col items-center justify-center gap-4'>
          <p className='text-muted-foreground'>Catalog entry not found.</p>
          <Button
            variant='outline'
            onClick={() => navigate({ to: '/data-catalog' })}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Catalog
          </Button>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href='/data-catalog'>Data Catalog</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {catalogEntry.schema_name}.{catalogEntry.table_name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {catalogEntry.schema_name}.{catalogEntry.table_name}
              {catalogEntry.classification && (
                <Badge
                  variant={
                    catalogEntry.classification === 'PII'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {catalogEntry.classification}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
              <div>
                <p className='text-muted-foreground'>Owner</p>
                <p className='font-medium'>
                  {catalogEntry.owner || '—'}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>SLA Freshness</p>
                <p className='font-medium tabular-nums'>
                  {catalogEntry.sla_freshness_minutes != null
                    ? `${catalogEntry.sla_freshness_minutes} min`
                    : '—'}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Classification</p>
                <p className='font-medium'>
                  {catalogEntry.classification || '—'}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Last Updated</p>
                <p className='font-medium'>
                  {formatDistanceToNow(new Date(catalogEntry.updated_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {catalogEntry.description && (
                <div className='col-span-full'>
                  <p className='text-muted-foreground'>Description</p>
                  <p className='font-medium'>{catalogEntry.description}</p>
                </div>
              )}
              {catalogEntry.tags && catalogEntry.tags.length > 0 && (
                <div className='col-span-full'>
                  <p className='text-muted-foreground mb-1'>Tags</p>
                  <div className='flex flex-wrap gap-1'>
                    {(catalogEntry.tags ?? []).map((tag: string) => (
                      <Badge key={tag} variant='outline'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Dictionary Table */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>Data Dictionary</CardTitle>
            <Button size='sm' onClick={openNewColumn}>
              <Plus className='mr-2 h-4 w-4' />
              Add Column
            </Button>
          </CardHeader>
          <CardContent>
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className='w-20 text-center'>PII</TableHead>
                    <TableHead className='w-24 text-center'>Nullable</TableHead>
                    <TableHead>Sample Values</TableHead>
                    <TableHead className='w-24'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='h-16 text-center text-muted-foreground'
                      >
                        No columns documented yet. Click "Add Column" to start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    columns.map((col) => (
                      <TableRow key={col.id}>
                        <TableCell className='font-mono text-sm font-medium'>
                          {col.column_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>
                            {col.data_type ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className='max-w-[200px] truncate text-sm'>
                          {col.description || (
                            <span className='text-muted-foreground italic'>
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='text-center'>
                          {col.is_pii && (
                            <Key className='mx-auto h-4 w-4 text-amber-500' />
                          )}
                        </TableCell>
                        <TableCell className='text-center'>
                          {col.is_nullable && (
                            <CircleDot className='mx-auto h-4 w-4 text-muted-foreground' />
                          )}
                        </TableCell>
                        <TableCell className='max-w-[150px] truncate font-mono text-xs'>
                          {col.sample_values || '—'}
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-1'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={() => openEditColumn(col)}
                            >
                              <Pencil className='h-3.5 w-3.5' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7 text-destructive'
                              onClick={() => deleteColumnMutation.mutate(col.id)}
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Main>

      {/* Column Add/Edit Dialog */}
      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {editingColumn?.id ? 'Edit Column' : 'Add Column'}
            </DialogTitle>
            <DialogDescription>
              Document the column metadata for this table.
            </DialogDescription>
          </DialogHeader>
          {editingColumn && (
            <div className='space-y-3'>
              <div>
                <label className='text-sm font-medium'>Column Name</label>
                <Input
                  value={editingColumn.column_name}
                  onChange={(e) =>
                    setEditingColumn({
                      ...editingColumn,
                      column_name: e.target.value,
                    })
                  }
                  placeholder='column_name'
                />
              </div>
              <div>
                <label className='text-sm font-medium'>Type</label>
                <Input
                  value={editingColumn.data_type}
                  onChange={(e) =>
                    setEditingColumn({
                      ...editingColumn,
                      data_type: e.target.value,
                    })
                  }
                  placeholder='varchar, integer, timestamp...'
                />
              </div>
              <div>
                <label className='text-sm font-medium'>Description</label>
                <Textarea
                  value={editingColumn.description}
                  onChange={(e) =>
                    setEditingColumn({
                      ...editingColumn,
                      description: e.target.value,
                    })
                  }
                  placeholder='What does this column represent?'
                />
              </div>
              <div className='flex gap-4'>
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={editingColumn.is_pii}
                    onChange={(e) =>
                      setEditingColumn({
                        ...editingColumn,
                        is_pii: e.target.checked,
                      })
                    }
                  />
                  PII
                </label>
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={editingColumn.is_nullable}
                    onChange={(e) =>
                      setEditingColumn({
                        ...editingColumn,
                        is_nullable: e.target.checked,
                      })
                    }
                  />
                  Nullable
                </label>
              </div>
              <div>
                <label className='text-sm font-medium'>Sample Values</label>
                <Input
                  value={editingColumn.sample_values}
                  onChange={(e) =>
                    setEditingColumn({
                      ...editingColumn,
                      sample_values: e.target.value,
                    })
                  }
                  placeholder='e.g. "active", "inactive"'
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setColumnDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleColumnSubmit}
              disabled={
                !editingColumn?.column_name ||
                addColumnMutation.isPending ||
                updateColumnMutation.isPending
              }
            >
              {editingColumn?.id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
