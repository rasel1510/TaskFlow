'use client';

/**
 * A small "Ask FlowAi" control for suite records: runs one AI task and shows the result.
 */
import React, { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi } from '@/lib/suite/useRecords';
import { Button } from '@/components/suite/ui';

export default function AiAssist({
  task,
  id,
  label,
  hint,
  extra,
  onDone,
  disabled,
}: {
  task: 'stories_from_doc' | 'release_notes' | 'draft_content' | 'summarize_deal' | 'reply_ticket';
  id: string;
  label: string;
  hint?: string;
  extra?: Record<string, string>;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const res = await suiteApi<{ text: string; created?: number }>('/api/suite/ai', { method: 'POST', body: JSON.stringify({ task, id, ...extra }) });
      setText(res.text);
      if (res.created) toast.success(`${res.created} stories added to the backlog`);
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={busy || disabled}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
          </svg>
          {busy ? 'Thinking…' : label}
        </Button>
        {hint && <span className="text-[11.5px] text-neutral-400">{hint}</span>}
      </div>
      {text && (
        <div className="rounded-lg bg-neutral-50 border border-[#E5E7EB] px-3 py-2.5">
          <p className="text-[12.5px] text-[#111111] whitespace-pre-wrap leading-relaxed">{text}</p>
          <div className="flex justify-end mt-1.5">
            <button type="button" className="text-[11.5px] text-[#2563EB] cursor-pointer" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))}>Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}
