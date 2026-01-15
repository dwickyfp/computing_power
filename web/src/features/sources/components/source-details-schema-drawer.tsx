import { Key } from 'lucide-react'
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

interface SchemaColumn {
    column_name: string
    is_nullable: string | boolean
    real_data_type: string
    is_primary_key: boolean
    has_default: boolean
    default_value: string | null
}

interface SourceDetailsSchemaDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tableName: string
    schema: SchemaColumn[]
    isLoading?: boolean
    version?: number
}

export function SourceDetailsSchemaDrawer({
    open,
    onOpenChange,
    tableName,
    schema,
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
                                        <TableCell className='font-medium flex items-center gap-2'>
                                            {col.column_name}
                                            {col.is_primary_key && (
                                                <Key className="h-3.5 w-3.5 text-yellow-500" />
                                            )}
                                        </TableCell>
                                        <TableCell>{col.real_data_type}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center">
                                                <Checkbox 
                                                    checked={col.is_nullable === 'YES' || col.is_nullable === true} 
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
            </SheetContent>
        </Sheet>
    )
}
