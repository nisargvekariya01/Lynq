import { useState, useCallback } from 'react';

/**
 * useLocalStorage — state backed by localStorage.
 * @param {string} key
 * @param {*} initialValue
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (err) {
        console.error('useLocalStorage error:', err);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}
