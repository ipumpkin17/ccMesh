import { InfoIcon } from 'lucide-react'

import { HintButton } from '@/components/common'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function FormFieldLabel({ htmlFor, label, hint }: { htmlFor?: string; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <HintButton aria-label={hint}>
            <InfoIcon className="size-3.5" />
          </HintButton>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </div>
  )
}
