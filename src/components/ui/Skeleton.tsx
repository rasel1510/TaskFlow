import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#F3F4F6] animate-pulse">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 bg-[#E5E7EB] rounded w-2/3" />
        <div className="h-3 bg-[#F3F4F6] rounded w-20" />
      </div>
      <div className="w-32 hidden md:block">
        <div className="h-3.5 bg-[#E5E7EB] rounded w-24" />
      </div>
      <div className="w-28 hidden md:block">
        <div className="h-5 bg-[#E5E7EB] rounded-full w-20" />
      </div>
      <div className="w-24 hidden md:block">
        <div className="h-3.5 bg-[#E5E7EB] rounded w-16" />
      </div>
      <div className="w-28 hidden md:flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#E5E7EB] shrink-0" />
        <div className="h-3.5 bg-[#E5E7EB] rounded w-14" />
      </div>
      <div className="w-28 hidden md:block">
        <div className="h-3.5 bg-[#E5E7EB] rounded w-20" />
      </div>
      <div className="w-16 hidden md:block">
        <div className="h-3.5 bg-[#E5E7EB] rounded w-8" />
      </div>
      <div className="w-20 hidden md:flex justify-end gap-1.5">
        <div className="w-7 h-7 bg-[#F3F4F6] rounded" />
        <div className="w-7 h-7 bg-[#F3F4F6] rounded" />
      </div>
    </div>
  );
}

export function KanbanCardSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-2.5 animate-pulse space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 bg-[#E5E7EB] rounded w-16" />
        <div className="h-3 bg-[#E5E7EB] rounded w-12" />
      </div>
      <div className="h-4 bg-[#E5E7EB] rounded w-5/6" />
      <div className="h-3 bg-[#F3F4F6] rounded w-1/2" />
      <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-between">
        <div className="w-5 h-5 rounded-full bg-[#E5E7EB]" />
        <div className="h-3 bg-[#F3F4F6] rounded w-14" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex items-start gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-7 bg-[#E5E7EB] rounded w-16" />
        <div className="h-3.5 bg-[#F3F4F6] rounded w-28" />
        <div className="h-2.5 bg-[#F3F4F6] rounded w-20" />
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F3F4F6]" />
          <div className="space-y-1.5">
            <div className="h-4 bg-[#E5E7EB] rounded w-32" />
            <div className="h-3 bg-[#F3F4F6] rounded w-20" />
          </div>
        </div>
        <div className="h-5 bg-[#F3F4F6] rounded-full w-16" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 bg-[#F3F4F6] rounded w-full" />
        <div className="h-3 bg-[#F3F4F6] rounded w-3/4" />
      </div>
      <div className="space-y-1 pt-2">
        <div className="flex justify-between">
          <div className="h-3 bg-[#F3F4F6] rounded w-12" />
          <div className="h-3 bg-[#F3F4F6] rounded w-8" />
        </div>
        <div className="h-1.5 bg-[#E5E7EB] rounded-full w-full" />
      </div>
    </div>
  );
}

export { Skeleton }
