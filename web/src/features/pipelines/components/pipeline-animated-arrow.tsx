import { ArrowRight } from 'lucide-react'

export function PipelineAnimatedArrow() {
  return (
    <div className='flex items-center space-x-1 text-muted-foreground'>
      <div className='h-1 w-1 rounded-full bg-primary animate-[pulse_1.5s_ease-in-out_infinite]' />
      <div className='h-1 w-1 rounded-full bg-primary animate-[pulse_1.5s_ease-in-out_infinite_0.2s]' />
      <div className='h-1 w-1 rounded-full bg-primary animate-[pulse_1.5s_ease-in-out_infinite_0.4s]' />
      <ArrowRight className='h-4 w-4 text-primary' />
    </div>
  )
}
