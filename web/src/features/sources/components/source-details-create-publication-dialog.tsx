import { useState, useMemo } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { sourcesRepo } from '@/repo/sources'
import { useQueryClient } from '@tanstack/react-query'

interface SourceDetailsCreatePublicationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceId: number
    listTables: string[]
}

export function SourceDetailsCreatePublicationDialog({
    open,
    onOpenChange,
    sourceId,
    listTables
}: SourceDetailsCreatePublicationDialogProps) {
    const [search, setSearch] = useState('')
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()

    const filteredTables = useMemo(() => {
        if (!search) return listTables
        return listTables.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    }, [listTables, search])

    const handleToggleTable = (tableName: string) => {
        const newSelected = new Set(selectedTables)
        if (newSelected.has(tableName)) {
            newSelected.delete(tableName)
        } else {
            newSelected.add(tableName)
        }
        setSelectedTables(newSelected)
    }

    const handleSelectAll = () => {
        if (selectedTables.size === filteredTables.length) {
            setSelectedTables(new Set())
        } else {
            setSelectedTables(new Set(filteredTables))
        }
    }

    const handleSubmit = async () => {
        if (selectedTables.size === 0) {
            toast.error("Please select at least one table")
            return
        }

        setIsSubmitting(true)
        try {
            await sourcesRepo.createPublication(sourceId, Array.from(selectedTables))
            toast.success("Publication created successfully")
            queryClient.invalidateQueries({ queryKey: ['source-details', sourceId] })
            onOpenChange(false)
            setSelectedTables(new Set())
        } catch (error) {
            toast.error("Failed to create publication")
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Publication</DialogTitle>
                    <DialogDescription>
                        Select tables to include in the publication. You must select at least one table.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input
                        placeholder="Search tables..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={handleSelectAll}>
                           {selectedTables.size === filteredTables.length && filteredTables.length > 0 ? "Deselect All" : "Select All"}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            {selectedTables.size} selected
                        </span>
                    </div>
                    <ScrollArea className="h-[300px] border rounded-md p-4">
                        <div className="space-y-4">
                            {filteredTables.length > 0 ? (
                                filteredTables.map((tableName) => (
                                    <div key={tableName} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={tableName} 
                                            checked={selectedTables.has(tableName)}
                                            onCheckedChange={() => handleToggleTable(tableName)}
                                        />
                                        <label
                                            htmlFor={tableName}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {tableName}
                                        </label>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-8">
                                    No tables found.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || selectedTables.size === 0}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
