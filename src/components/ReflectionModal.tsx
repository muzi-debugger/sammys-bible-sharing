import { useEffect, useState } from 'react';
import { Feather } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getDatabase } from '@/services/storage';
import { journalService } from '@/services/journal';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { Field } from '@/components/ui/primitives';

export function ReflectionModal({
  open,
  onClose,
  reference,
}: {
  open: boolean;
  onClose: () => void;
  reference: string;
}) {
  const { user } = useApp();
  const { notify } = useToast();
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    const existing = getDatabase().reflections.find(
      (entry) => entry.userId === user.id && entry.reference === reference,
    );
    setBody(existing?.body ?? '');
  }, [open, reference, user.id]);

  const save = () => {
    if (!body.trim()) {
      notify('Write a sentence first — even a single thought is enough.', 'info');
      return;
    }
    journalService.saveReflection(user.id, reference, body.trim());
    notify('Reflection saved to your private journal.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${reference} · NLT`}
      title="Take a moment to reflect"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button icon={<Feather size={14} />} onClick={save}>
            Save reflection
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="font-serif text-[1.05rem] leading-relaxed text-charcoal/70 italic">
          This is yours alone. Nothing written here is shared with your partner.
        </p>
        <Field label="Your reflection" htmlFor="reflection-body">
          <textarea
            id="reflection-body"
            className="writing-area min-h-[190px]"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What is this passage stirring in you today?"
          />
        </Field>
        <p className="font-sans text-[0.68rem] leading-relaxed text-charcoal/40">
          Saved to your Scripture Journal and visible only to you.
        </p>
      </div>
    </Modal>
  );
}
