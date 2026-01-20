import { Key, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { type SchemaColumn, type TableSchemaDiff } from '@/repo/sources'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'

interface SourceDetailsSchemaDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tableName: string
    schema: SchemaColumn[]
    diff?: TableSchemaDiff
    isLoading?: boolean
    version?: number
}

export function SourceDetailsSchemaDrawer({
    open,
    onOpenChange,
    tableName,
    schema,
    diff,
    isLoading = false,
    version
}: SourceDetailsSchemaDrawerProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className='sm:max-w-4xl w-full sm:w-[900px] overflow-y-auto p-8'>
                <SheetHeader>
                    <SheetTitle>Schema: {tableName} {version ? <span className="text-muted-foreground ml-2 text-sm font-normal">(v{version})</span> : null}</SheetTitle>
                    <SheetDescription>
                        Detailed schema information for {tableName}.
                    </SheetDescription>
                </SheetHeader>
                <div className='mt-6 rounded-md border'>
                    {isLoading ? (
                         <div className="flex h-64 items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                         </div>
                    ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Column Name</TableHead>
                                <TableHead>Data Type</TableHead>
                                <TableHead className="text-center">Nullable</TableHead>
                                <TableHead className="text-center">Has Default</TableHead>
                                <TableHead>Default Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schema && schema.length > 0 ? (
                                schema.map((col, index) => (
                                    <TableRow key={index}>
                                        <TableCell className='font-medium'>
                                            <div className="flex items-center gap-2">
                                                {col.column_name}
                                                {col.is_primary_key && (
                                                    <Key className="h-3.5 w-3.5 text-yellow-500" />
                                                )}
                                                {diff?.new_columns?.includes(col.column_name) && (
                                                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 h-5 px-1.5 ml-2">New</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {col.real_data_type}
                                                {diff?.type_changes?.[col.column_name] && (
                                                     <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 h-5 px-1.5">
                                                        Changed
                                                     </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center">
                                                <Checkbox 
                                                    checked={col.is_nullable === 'YES'} 
                                                    disabled 
                                                    className="cursor-default opacity-100 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center">
                                                 <Checkbox 
                                                    checked={col.has_default} 
                                                    disabled 
                                                    className="cursor-default opacity-100 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground truncate max-w-[100px] inline-block" title={col.default_value || ''}>
                                                 {col.default_value || '-'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className='text-center h-24'>
                                        No schema information available.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    )}
                </div>

                {diff?.dropped_columns && diff.dropped_columns.length > 0 && (
                    <div className="mt-8 space-y-3">
                        <div className="flex items-center gap-2 text-destructive">
                             <AlertTriangle className="h-5 w-5" />
                             <h3 className="font-semibold text-lg">Dropped Columns</h3>
                        </div>
                        <div className='rounded-md border border-red-200'>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-red-50/50 hover:bg-red-50/50">
                                        <TableHead className="w-[180px] text-red-900">Column Name</TableHead>
                                        <TableHead className="text-red-900">Data Type</TableHead>
                                        <TableHead className="text-center text-red-900">Nullable</TableHead>
                                        <TableHead className="text-center text-red-900">Has Default</TableHead>
                                        <TableHead className="text-red-900">Value</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {diff.dropped_columns.map((col, index) => (
                                        <TableRow key={index} className="bg-red-50/30 hover:bg-red-50/50">
                                            <TableCell className='font-medium text-red-900 strike-through decoration-red-900/50'>
                                                <span className="line-through">{col.column_name}</span>
                                            </TableCell>
                                            <TableCell className="text-red-900/80">{col.real_data_type}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    <Checkbox 
                                                        checked={col.is_nullable === 'YES'} 
                                                        disabled 
                                                        className="cursor-default opacity-50 data-[state=checked]:bg-red-900 data-[state=checked]:border-red-900"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                     <Checkbox 
                                                        checked={col.has_default} 
                                                        disabled 
                                                        className="cursor-default opacity-50 data-[state=checked]:bg-red-900 data-[state=checked]:border-red-900"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                 <span className="text-xs text-red-900/70">
                                                     {col.default_value || '-'}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
