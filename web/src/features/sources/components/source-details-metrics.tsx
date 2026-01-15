import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WALMonitorResponse } from '@/repo/sources'
import { Activity, Database, Clock, Share2 } from 'lucide-react'

interface SourceDetailsMetricsProps {
    data: WALMonitorResponse | null
    dataDestinations: string[]
}

export function SourceDetailsMetrics(props: SourceDetailsMetricsProps) {
    const { data } = props
    if (!data) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='text-sm text-muted-foreground'>No metrics available.</div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Status</CardTitle>
                    <Activity className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                    <div className='text-2xl font-bold'>{data.status}</div>
                    <p className='text-xs text-muted-foreground'>
                        {data.error_message || 'Operational'}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Destinations</CardTitle>
                    <Share2 className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                    <div className='text-2xl font-bold truncate' title={props.dataDestinations?.length ? `Sink to ${props.dataDestinations.join(', ')}` : 'Not Sink'}>
                        {props.dataDestinations?.length ? `Sink to ${props.dataDestinations.join(', ')}` : 'Not Sink'}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Total WAL Size</CardTitle>
                    <Database className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                    <div className='text-2xl font-bold'>
                        {data.total_wal_size || 'N/A'}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Last Received</CardTitle>
                    <Clock className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                    <div className='text-2xl font-bold text-sm'>
                         {data.last_wal_received ? new Date(data.last_wal_received).toLocaleString() : 'Never'}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
