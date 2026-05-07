import { useIsRTL } from '@/src/i18n/useIsRTL';

/** Physical CSS properties resolved for current locale direction. */
export type LogicalStyle = { marginLeft?: number; marginRight?: number; paddingLeft?: number; paddingRight?: number };

/** Map logical margin values to physical marginLeft/marginRight that flip for RTL.

 *  @param inlineStartPx — space on the start (left in LTR, right in RTL) side
 *  @param inlineEndPx   — space on the end (right in LTR, left in RTL) side
 */
export function useLogicalMargin(inlineStartPx?: number, inlineEndPx?: number): LogicalStyle {
  const isRTL = useIsRTL();
  if (!inlineStartPx && !inlineEndPx) return {};

  if (isRTL) {
    return {
      marginRight: inlineStartPx ?? inlineEndPx ?? 0,
      marginLeft: inlineEndPx ?? inlineStartPx ?? 0,
    };
  }
  return {
    marginLeft: inlineStartPx ?? inlineEndPx ?? 0,
    marginRight: inlineEndPx ?? inlineStartPx ?? 0,
  };
}

/** Map logical padding values to physical paddingLeft/paddingRight. */
export function useLogicalPadding(inlineStartPx?: number, inlineEndPx?: number): LogicalStyle {
  const isRTL = useIsRTL();
  if (!inlineStartPx && !inlineEndPx) return {};

  if (isRTL) {
    return {
      paddingRight: inlineStartPx ?? inlineEndPx ?? 0,
      paddingLeft: inlineEndPx ?? inlineStartPx ?? 0,
    };
  }
  return {
    paddingLeft: inlineStartPx ?? inlineEndPx ?? 0,
    paddingRight: inlineEndPx ?? inlineStartPx ?? 0,
  };
}
