'use client';

import { useState, useTransition } from 'react';

type Props = {
  kind: 'broadcast' | 'individual' | 'experienceFollowUp';
  fastId: string;
  fastName: string;
  fastPurpose: string;
  wardName: string;
  offsetLabel: string;
  offsetHint: string;
  action: (fd: FormData) => Promise<void>;
};

const MERGE_FIELDS = [
  '{{firstName}}', '{{fullName}}', '{{fastDate}}', '{{dayNumber}}', '{{daysUntil}}',
  '{{wardName}}', '{{fastName}}', '{{fastPurpose}}', '{{startDate}}', '{{endDate}}',
  '{{magicLink}}', '{{otherParticipantsOnDay}}',
];

export function ReminderEditor(props: Props) {
  const [name, setName] = useState('');
  const [offset, setOffset] = useState('');
  const [subject, setSubject] = useState('');
  const [template, setTemplate] = useState('');
  const [channels, setChannels] = useState<'EMAIL' | 'SMS' | 'BOTH'>('EMAIL');
  const [tone, setTone] = useState('warm and encouraging');
  const [drafting, setDrafting] = useState(false);
  const [pending, startTransition] = useTransition();

  async function draftWithAI() {
    setDrafting(true);
    try {
      const res = await fetch('/api/ai/draft-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderType: props.kind,
          fastName: props.fastName,
          fastPurpose: props.fastPurpose,
          wardName: props.wardName,
          daysOffset: parseInt(offset || '0', 10),
          tone,
          channel: channels,
        }),
      });
      const data = await res.json();
      if (data.subject) setSubject(data.subject);
      if (data.body) setTemplate(data.body);
    } catch (e) {
      alert('AI drafting failed. You can write the message manually.');
    } finally {
      setDrafting(false);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('fastId', props.fastId);
    fd.set('kind', props.kind);
    startTransition(async () => {
      await props.action(fd);
      // Reset form on success
      setName(''); setOffset(''); setSubject(''); setTemplate('');
    });
  }

  function insertField(field: string) {
    setTemplate((t) => t + field);
  }

  return (
    <details className="card p-5">
      <summary className="cursor-pointer font-medium text-sage-700 hover:text-sage-900">
        + Add a new {props.kind === 'broadcast' ? 'broadcast' : props.kind === 'individual' ? 'individual reminder' : 'experience follow-up'}
      </summary>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Name (admin-facing)</label>
            <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g., One week before" />
          </div>
          <div>
            <label className="label">{props.offsetLabel}</label>
            <input name="daysOffset" type="number" required value={offset} onChange={(e) => setOffset(e.target.value)} className="input" placeholder="e.g., -3" />
            <p className="text-xs text-ink-500 mt-1">{props.offsetHint}</p>
          </div>
        </div>

        <div>
          <label className="label">Channels</label>
          <select name="channels" value={channels} onChange={(e) => setChannels(e.target.value as any)} className="input">
            <option value="EMAIL">Email only</option>
            <option value="SMS">SMS only</option>
            <option value="BOTH">Email and SMS</option>
          </select>
        </div>

        {(channels === 'EMAIL' || channels === 'BOTH') && (
          <div>
            <label className="label">Email subject</label>
            <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="e.g., Your fast begins in 3 days" />
          </div>
        )}

        <div className="card bg-parchment-50 p-4 space-y-3">
          <p className="display-eyebrow">Draft with AI</p>
          <div className="flex gap-2">
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="input flex-1"
              placeholder="Tone (e.g., warm and encouraging)"
            />
            <button type="button" onClick={draftWithAI} disabled={drafting} className="btn-secondary text-sm whitespace-nowrap">
              {drafting ? 'Drafting...' : '✨ Draft'}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Message template</label>
          <textarea
            name="template"
            required
            rows={8}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="input font-mono text-sm"
            placeholder="Hello {{firstName}}, ..."
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {MERGE_FIELDS.map((f) => (
              <button key={f} type="button" onClick={() => insertField(f)} className="text-xs text-sage-700 hover:text-sage-900 hover:bg-parchment-100 px-2 py-1 rounded-sm">
                {f}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving...' : 'Save reminder'}
        </button>
      </form>
    </details>
  );
}
