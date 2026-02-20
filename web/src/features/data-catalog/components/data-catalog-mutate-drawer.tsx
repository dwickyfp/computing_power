import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { dataCatalogRepo } from '@/repo/data-catalog'
import {
  dataCatalogFormSchema,
  type DataCatalogForm,
  type DataCatalog,
} from '../data/schema'

interface DataCatalogMutateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: DataCatalog | null
}

export function DataCatalogMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: DataCatalogMutateDrawerProps) {
  const isUpdate = !!currentRow
  const queryClient = useQueryClient()

  const form = useForm<DataCatalogForm>({
    resolver: zodResolver(dataCatalogFormSchema) as any,
    defaultValues: {
      schema_name: '',
      table_name: '',
      description: '',
      owner: '',
      tags: '',
      classification: '',
      source_id: null,
      destination_id: null,
    },
  })

  useEffect(() => {
    if (currentRow) {
      form.reset({
        schema_name: currentRow.schema_name,
        table_name: currentRow.table_name,
        description: currentRow.description ?? '',
        owner: currentRow.owner ?? '',
        tags: (currentRow.tags ?? []).join(', '),
        classification: currentRow.classification ?? '',
        source_id: currentRow.source_id,
        destination_id: currentRow.destination_id,
      })
    } else {
      form.reset({
        schema_name: '',
        table_name: '',
        description: '',
        owner: '',
        tags: '',
        classification: '',
        source_id: null,
        destination_id: null,
      })
    }
  }, [currentRow, form])

  const createMutation = useMutation({
    mutationFn: (data: DataCatalogForm) =>
      dataCatalogRepo.create({
        schema_name: data.schema_name,
        table_name: data.table_name,
        description: data.description,
        owner: data.owner,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        classification: data.classification,
        source_id: data.source_id ?? undefined,
        destination_id: data.destination_id ?? undefined,
      }),
    onSuccess: async () => {
      toast.success('Catalog entry created')
      onOpenChange(false)
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['data-catalog'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create catalog entry')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: DataCatalogForm) =>
      dataCatalogRepo.update(currentRow!.id, {
        schema_name: data.schema_name,
        table_name: data.table_name,
        description: data.description,
        owner: data.owner,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        classification: data.classification,
        source_id: data.source_id ?? undefined,
        destination_id: data.destination_id ?? undefined,
      }),
    onSuccess: async () => {
      toast.success('Catalog entry updated')
      onOpenChange(false)
      await new Promise((r) => setTimeout(r, 300))
      queryClient.invalidateQueries({ queryKey: ['data-catalog'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update catalog entry')
    },
  })

  const onSubmit = (data: DataCatalogForm) => {
    if (isUpdate) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>
            {isUpdate ? 'Update Catalog Entry' : 'Add Catalog Entry'}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Edit the catalog entry details below.'
              : 'Fill in the details to add a new catalog entry.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4 px-1 pt-4'
          >
            <FormField
              control={form.control}
              name='schema_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schema Name</FormLabel>
                  <FormControl>
                    <Input placeholder='public' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='table_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Name</FormLabel>
                  <FormControl>
                    <Input placeholder='users' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Describe the table...'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='owner'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner</FormLabel>
                  <FormControl>
                    <Input placeholder='data-team' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='classification'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Classification</FormLabel>
                  <FormControl>
                    <Input placeholder='PII, SENSITIVE, PUBLIC...' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder='analytics, core, ...' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-2 pt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : isUpdate
                    ? 'Update'
                    : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
