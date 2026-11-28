import React, { useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import { CampusItem, FIELD_LIMITS, MatchResult } from '../types/reclaim';

interface ClaimModalProps {
  open: boolean;
  targetItem: CampusItem | null;
  targetMatch: MatchResult | null;
  onClose: () => void;
  onSubmitClaim: (data: {
    itemId: string;
    matchedItemId?: string;
    itemName: string;
    verificationAnswer: string;
    uniqueMarks: string;
    matchScore?: number;
  }) => Promise<void>;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  open,
  targetItem,
  targetMatch,
  onClose,
  onSubmitClaim,
}) => {
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [uniqueMarks, setUniqueMarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open || (!targetItem && !targetMatch)) return null;

  const item = targetMatch ? targetMatch.foundItem : targetItem!;
  const matchedLost = targetMatch?.lostItem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedAnswer = verificationAnswer.trim();
    if (trimmedAnswer.length < FIELD_LIMITS.verificationAnswer.min) {
      setError('Please provide specific private verification details (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitClaim({
        itemId: item.id,
        matchedItemId: matchedLost?.id,
        itemName: item.itemName,
        verificationAnswer: trimmedAnswer,
        uniqueMarks: uniqueMarks.trim(),
        matchScore: targetMatch?.finalScore,
      });
      setVerificationAnswer('');
      setUniqueMarks('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit ownership claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
    >
      <div className="my-8 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="claim-modal-title" className="text-lg font-bold text-slate-900">
                Submit Ownership Claim
              </h2>
              <p className="text-xs text-slate-500">
                Matches never auto-confirm ownership. Campus admins review your private answers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close claim dialog"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm">
          <p className="font-semibold text-slate-900">{item.itemName}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {item.category} · {item.location} · {item.dateOccurred}
            {targetMatch ? ` · Text match score ${targetMatch.finalScore}%` : ''}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="claim-verification-answer"
              className="block text-xs font-semibold text-slate-700"
            >
              Private Verification Details * (Describe contents, markings, or hidden features)
            </label>
            <textarea
              id="claim-verification-answer"
              required
              rows={3}
              maxLength={FIELD_LIMITS.verificationAnswer.max}
              value={verificationAnswer}
              onChange={(e) => setVerificationAnswer(e.target.value)}
              placeholder="e.g., Inside pocket contains a blue transit pass, a coffee receipt from Nov 22, or specific initials/serial digits."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="claim-unique-marks"
              className="block text-xs font-semibold text-slate-700"
            >
              Additional Proof / When &amp; Where Last Seen (Optional)
            </label>
            <input
              id="claim-unique-marks"
              type="text"
              maxLength={FIELD_LIMITS.uniqueMarks.max}
              value={uniqueMarks}
              onChange={(e) => setUniqueMarks(e.target.value)}
              placeholder="e.g., Scuff on bottom corner, purchase receipt available at pickup"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span>
              Your verification response is visible only to you and campus administrators.
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Verification Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
