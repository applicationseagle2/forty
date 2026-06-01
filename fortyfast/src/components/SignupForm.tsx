'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Participant = { name: string; phone: string; email: string; smsOptIn: boolean; emailOptIn: boolean };

export function SignupForm({
  fastId,
  dayNumber,
  isStacking,
  action,
}: {
  fastId: string;
  dayNumber: number;
  isStacking: boolean;
  action: (fd: FormData) => Promise<{ error?: string; redirectTo?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<Participant[]>([
    { name: '', phone: '', email: '', smsOptIn: true, emailOptIn: true },
  ]);

  function update(i: number, patch: Partial<Participant>) {
    setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function add() {
    setPeople((prev) => [...prev, { name: '', phone: '', email: '', smsOptIn: true, emailOptIn: true }]);
  }
  function remove(i: number) {
    setPeople((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('fastId', fastId);
    fd.set('dayNumber', dayNumber.toString());
    for (const p of people) {
      fd.append('name', p.name);
      fd.append('phone', p.phone);
      fd.append('email', p.email);
      fd.append('smsOptIn', p.smsOptIn ? 'on' : '');
      fd.append('emailOptIn', p.emailOptIn ? 'on' : '');
    }
    startTransition(async () => {
      const res = await action(fd);
      if (res.error) setError(res.error);
      else if (res.redirectTo) router.push(res.redirectTo);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {people.map((p, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex justify-between items-center">
            <p className="display-eyebrow">Participant {i + 1}</p>
            {people.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-sm text-ember-700 hover:underline">
                Remove
              </button>
            )}
          </div>
          <div>
            <label className="label">Name</label>
            <input required value={p.name} onChange={(e) => update(i, { name: e.target.value })} className="input" placeholder="Full name" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Cell phone <span className="text-ink-500 font-normal">(optional)</span></label>
              <input type="tel" value={p.phone} onChange={(e) => update(i, { phone: e.target.value })} className="input" placeholder="+12085551234" />
              {p.phone && (
                <label className="flex items-center gap-2 mt-2 text-sm text-ink-700">
                  <input type="checkbox" checked={p.smsOptIn} onChange={(e) => update(i, { smsOptIn: e.target.checked })} />
                  Send SMS reminders
                </label>
              )}
            </div>
            <div>
              <label className="label">Email <span className="text-ink-500 font-normal">(optional)</span></label>
              <input type="email" value={p.email} onChange={(e) => update(i, { email: e.target.value })} className="input" placeholder="you@example.com" />
              {p.email && (
                <label className="flex items-center gap-2 mt-2 text-sm text-ink-700">
                  <input type="checkbox" checked={p.emailOptIn} onChange={(e) => update(i, { emailOptIn: e.target.checked })} />
                  Send email reminders
                </label>
              )}
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="btn-secondary text-sm">+ Add another participant</button>

      {error && <p className="text-ember-700 text-sm">{error}</p>}

      <div className="pt-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving...' : isStacking ? 'Join this day' : 'Claim this day'}
        </button>
        <p className="text-xs text-ink-500 mt-3">
          After signing up, you'll receive a private link to edit your details or share what you experienced.
        </p>
      </div>
    </form>
  );
}
