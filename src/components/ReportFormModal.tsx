import React, { useState } from 'react';
import { Lock, Upload, X } from 'lucide-react';
import {
  CAMPUS_ZONES,
  CampusZoneId,
  FIELD_LIMITS,
  ItemCategory,
  ItemReportType,
} from '../types/reclaim';
import { processUploadedPhoto } from '../utils/visualFeatures';

interface ReportFormModalProps {
  open: boolean;
  initialType: ItemReportType;
  categories: ItemCategory[];
  isSignedIn: boolean;
  onClose: () => void;
  onSubmitReport: (data: {
    type: ItemReportType;
    itemName: string;
    category: string;
    description: string;
    location: string;
    campusZone: CampusZoneId;
    dateOccurred: string;
    approxTime: string;
    identifyingCharacteristics: string;
    hasPhoto: boolean;
    photoUrl?: string;
    visualSignature?: string;
  }) => Promise<void>;
}

export const ReportFormModal: React.FC<ReportFormModalProps> = ({
  open,
  initialType,
  categories,
  isSignedIn,
  onClose,
  onSubmitReport,
}) => {
  const [type, setType] = useState<ItemReportType>(initialType);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Wallets & IDs');
  const [description, setDescription] = useState('');
  const [campusZone, setCampusZone] = useState<CampusZoneId>('main-library');
  const [location, setLocation] = useState('');
  const [dateOccurred, setDateOccurred] = useState('2026-11-26');
  const [approxTime, setApproxTime] = useState('');
  const [identifyingCharacteristics, setIdentifyingCharacteristics] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);
  const [visualSignature, setVisualSignature] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    setType(initialType);
    setError(null);
  }, [initialType, open]);

  if (!open) return null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const processed = await processUploadedPhoto(file);
      setPhotoPreview(processed.previewDataUrl);
      setVisualSignature(processed.visualSignature ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = itemName.trim();
    const trimmedDesc = description.trim();
    const trimmedLoc = location.trim();

    if (trimmedName.length < FIELD_LIMITS.itemName.min) {
      setError('Please enter an item name (at least 2 characters).');
      return;
    }
    if (trimmedDesc.length < FIELD_LIMITS.description.min) {
      setError(
        'Please provide a detailed textual description (at least 10 characters) so the intelligent text matching engine can compare it accurately.'
      );
      return;
    }
    if (trimmedLoc.length < FIELD_LIMITS.location.min) {
      setError('Please enter the specific campus room, floor, or area.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOccurred)) {
      setError('Please select a valid date.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitReport({
        type,
        itemName: trimmedName,
        category,
        description: trimmedDesc,
        location: trimmedLoc,
        campusZone,
        dateOccurred,
        approxTime: approxTime.trim(),
        identifyingCharacteristics: identifyingCharacteristics.trim(),
        hasPhoto: Boolean(photoPreview),
        photoUrl: photoPreview,
        visualSignature,
      });
      // Reset fields after successful submit
      setItemName('');
      setDescription('');
      setLocation('');
      setApproxTime('');
      setIdentifyingCharacteristics('');
      setPhotoPreview(undefined);
      setVisualSignature(undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
    >
      <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 id="report-form-title" className="text-lg font-bold text-slate-900">
              {type === 'lost' ? 'Report a Lost Campus Item' : 'Report a Found Campus Item'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isSignedIn
                ? 'Synced live to ReClaim Firestore and immediately scored by the text matching engine.'
                : 'Submitting in local campus preview mode. Sign in with Google to persist reports to Firestore.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report form"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Type Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
            <button
              type="button"
              onClick={() => setType('lost')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                type === 'lost' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Lost Item Report
            </button>
            <button
              type="button"
              onClick={() => setType('found')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                type === 'found' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Found Item Report
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="report-item-name" className="block text-xs font-semibold text-slate-700">
                Item Name *
              </label>
              <input
                id="report-item-name"
                type="text"
                required
                maxLength={FIELD_LIMITS.itemName.max}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={type === 'lost' ? 'e.g., Black Leather Wallet' : 'e.g., Blue Bottle'}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="report-category" className="block text-xs font-semibold text-slate-700">
                Category *
              </label>
              <select
                id="report-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {categories.filter((c) => c.active).map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Textual Description */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="report-description"
                className="block text-xs font-semibold text-slate-700"
              >
                Detailed Textual Description * (Primary Matching Input — 35% Weight)
              </label>
              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                {description.length}/{FIELD_LIMITS.description.max}
              </span>
            </div>
            <textarea
              id="report-description"
              required
              rows={3}
              maxLength={FIELD_LIMITS.description.max}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include color, material, brand, stickers, damage, or distinctive visual details (e.g., 'Black leather wallet with a small silver logo lost near reading tables')."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="report-zone" className="block text-xs font-semibold text-slate-700">
                Campus Building / Zone *
              </label>
              <select
                id="report-zone"
                value={campusZone}
                onChange={(e) => setCampusZone(e.target.value as CampusZoneId)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {CAMPUS_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-location" className="block text-xs font-semibold text-slate-700">
                {type === 'lost' ? 'Specific Lost Location *' : 'Specific Found Location *'}
              </label>
              <input
                id="report-location"
                type="text"
                required
                maxLength={FIELD_LIMITS.location.max}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Library 2nd Floor Study Tables"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="report-date" className="block text-xs font-semibold text-slate-700">
                {type === 'lost' ? 'Date Lost *' : 'Date Found *'}
              </label>
              <input
                id="report-date"
                type="date"
                required
                value={dateOccurred}
                onChange={(e) => setDateOccurred(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="report-time" className="block text-xs font-semibold text-slate-700">
                Approximate Time (Optional)
              </label>
              <input
                id="report-time"
                type="text"
                maxLength={FIELD_LIMITS.approxTime.max}
                value={approxTime}
                onChange={(e) => setApproxTime(e.target.value)}
                placeholder="e.g., Around 2:30 PM"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Private Identifying Characteristics (Isolated from public listing) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Lock className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <label htmlFor="report-private-clues">
                Private Identifying Characteristics (Hidden from Public View)
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {type === 'found'
                ? 'For security, keep sensitive details (contents, serial numbers, inner markings) here so only administrators use them to verify ownership claims.'
                : 'Add private details only the owner knows (card contents, engravings, wallpaper) to help administrators verify your claim.'}
            </p>
            <textarea
              id="report-private-clues"
              rows={2}
              maxLength={FIELD_LIMITS.identifyingCharacteristics.max}
              value={identifyingCharacteristics}
              onChange={(e) => setIdentifyingCharacteristics(e.target.value)}
              placeholder="e.g., Contains library card ending in 4421 and initials etched inside."
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Optional Photo Upload */}
          <div>
            <label htmlFor="report-photo" className="block text-xs font-semibold text-slate-700">
              Optional Photograph (Supplementary Visual Similarity Only)
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                <span>{photoPreview ? 'Replace Photo' : 'Upload Photo (Optional)'}</span>
                <input
                  id="report-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
              </label>
              <span className="text-xs text-slate-500">
                {visualSignature
                  ? 'Visual color/luminance signature extracted locally.'
                  : 'ReClaim works at full accuracy without uploading a photograph.'}
              </span>
            </div>
            {photoPreview && (
              <div className="mt-2.5 flex items-center gap-3">
                <img
                  src={photoPreview}
                  alt="Uploaded item preview"
                  className="h-16 w-24 rounded-md border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(undefined);
                    setVisualSignature(undefined);
                  }}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Remove photo
                </button>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
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
              {submitting
                ? 'Submitting…'
                : type === 'lost'
                ? 'Submit Lost Report'
                : 'Submit Found Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
