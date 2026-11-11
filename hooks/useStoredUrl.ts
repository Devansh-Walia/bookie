import { useEffect, useState } from "react";
import { releaseUrl, storedUrl, type StoreKind } from "../utils/storage";

/**
 * Resolves a stored file to a URL the UI can render, and releases it when the
 * component unmounts or the file changes.
 *
 * On native this is a plain `file://` path. On web it is an object URL, which
 * must be revoked or the blob leaks for the lifetime of the tab.
 */
export function useStoredUrl(
  kind: StoreKind,
  name: string | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!name) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    storedUrl(kind, name)
      .then((next) => {
        if (cancelled) {
          if (next) releaseUrl(next);
          return;
        }
        created = next;
        setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      if (created) releaseUrl(created);
    };
  }, [kind, name]);

  return url;
}
