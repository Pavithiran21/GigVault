import { zodResolver } from '@hookform/resolvers/zod';
import { IconCalendar } from '@tabler/icons-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { daysBetween, isIsoDate } from '../lib/dates';
import { TextField } from './Field';
import { usePopover } from './overlayContext';

/** A five-year limit, the same as the backend's (5 × 366 days). */
export const FIVE_YEARS_DAYS = 5 * 366;

function rangeSchema(maxDays) {
  return z.object({ from: z.string(), to: z.string() }).superRefine((range, ctx) => {
    if (!isIsoDate(range.from) || !isIsoDate(range.to)) {
      const path = isIsoDate(range.from) ? 'to' : 'from';
      ctx.addIssue({ code: 'custom', path: [path], message: 'Pick a start and an end date.' });
    } else if (range.to < range.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: "The end date can't be before the start date." });
    } else if (maxDays && daysBetween(range.from, range.to) > maxDays) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Pick a range of at most 5 years.' });
    }
  });
}

/**
 * From and To dates with Apply, inside a <Popover> (the Dates filters and the custom period;
 * UI-UX.md screens 6 and 8). Dates are calendar dates ("2026-10-01"), the value of
 * <input type="date">. Apply and the secondary button (Clear or Cancel) close the popover.
 */
export function DateRangeForm({
  title,
  description,
  from = '',
  to = '',
  maxDays,
  sideBySide = false,
  secondaryLabel,
  onSecondary,
  onApply,
}) {
  const { close, titleId } = usePopover();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(rangeSchema(maxDays)), defaultValues: { from, to } });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((range) => {
        close();
        onApply(range);
      })}
    >
      <h3 id={titleId} className="mt-0 mb-1 text-base">
        {title}
      </h3>
      <p className="muted mt-0 mb-3.5 text-[13px]">{description}</p>
      <div className={sideBySide ? 'grid grid-cols-2 gap-2.5' : ''}>
        <TextField label="From" type="date" icon={IconCalendar} error={errors.from?.message} {...register('from')} />
        <TextField label="To" type="date" icon={IconCalendar} error={errors.to?.message} {...register('to')} />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-line"
          onClick={() => {
            close();
            onSecondary?.();
          }}
        >
          {secondaryLabel}
        </button>
        <button type="submit" className="btn btn-teal">
          Apply
        </button>
      </div>
    </form>
  );
}
