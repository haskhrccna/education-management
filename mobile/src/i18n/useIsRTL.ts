import i18next from 'i18next';
import { useEffect, useState } from 'react';

/** Returns true when the current locale is RTL. */
export function useIsRTL(): boolean {
  const [rtl, setRtl] = useState(i18next.dir());

  useEffect(() => {
    const handleChange = () => setRtl(i18next.dir());
    i18next.on('languageChanged', handleChange);
    return () => i18next.off('languageChanged', handleChange);
  }, []);

  return rtl === 'rtl';
}
