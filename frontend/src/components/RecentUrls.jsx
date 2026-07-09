import { useState, useEffect } from 'react';
import { checkStatus } from '../services/api.js';
import styles from './RecentUrls.module.css';

/**
 * RecentUrls — shows last 5 shortened URLs from LocalStorage.
 */
export default function RecentUrls({ items, onSelect, onClear, onDelete, onEdit }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMap, setStatusMap] = useState({}); // shortCode → { isAlive }

  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchCode = item.shortCode?.toLowerCase().includes(query);
    const matchUrl = item.originalUrl?.toLowerCase().includes(query);
    const matchTitle = item.title?.toLowerCase().includes(query);
    const matchTags = item.tags?.toLowerCase().includes(query);
    return matchCode || matchUrl || matchTitle || matchTags;
  });

  const displayItems = searchQuery.trim() === '' ? items.slice(0, 5) : filteredItems.slice(0, 20);

  // Check status for displayed items on mount or when they change
  useEffect(() => {
    if (!displayItems || displayItems.length === 0) return;
    let cancelled = false;

    const checkAll = async () => {
      for (const item of displayItems) {
        if (cancelled) break;
        // Don't recheck if we already have it
        if (item.shortCode in statusMap) continue;

        try {
          const result = await checkStatus(item.shortCode);
          if (!cancelled) {
            setStatusMap((prev) => ({ ...prev, [item.shortCode]: result.isAlive }));
          }
        } catch {
          // silently skip if check fails
        }
      }
    };

    checkAll();
    return () => { cancelled = true; };
  }, [displayItems.map(i => i.shortCode).join(',')]); // eslint-disable-line

  if (!items || items.length === 0) return null;

  const startEditing = (item) => {
    setEditingId(item.shortCode);
    setEditValue(item.originalUrl);
  };

  const handleSave = async (item) => {
    if (!editValue || editValue === item.originalUrl) {
      setEditingId(null);
      return;
    }
    
    // onEdit returns true if successful
    const success = await onEdit(item.shortCode, editValue, item.editToken);
    if (success) {
      setEditingId(null);
    }
  };

  const handleKeyDown = (e, item) => {
    if (e.key === 'Enter') {
      handleSave(item);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/>
          </svg>
          Recent
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder="Search by alias, title, tags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className={styles.clearBtn} onClick={onClear} aria-label="Clear recent URLs">
            Clear all
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {displayItems.length === 0 ? (
          <li className={styles.emptyState}>No links found matching "{searchQuery}"</li>
        ) : (
          displayItems.map((item, i) => {
            const isEditing = editingId === item.shortCode;
            const hasTags = item.tags && item.tags.trim().length > 0;
            const tagArray = hasTags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

          return (
            <li key={item.shortCode + i} className={styles.item}>
              <div className={styles.itemWrapper}>
                
                {isEditing ? (
                  <div className={styles.editWrapper}>
                    <input
                      type="url"
                      autoFocus
                      className={styles.editInput}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, item)}
                    />
                    <button className={styles.saveBtn} onClick={() => handleSave(item)} title="Save">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                    <button className={styles.cancelBtn} onClick={() => setEditingId(null)} title="Cancel">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.itemBtn}
                      onClick={() => onSelect(item)}
                      title={item.originalUrl}
                    >
                      <div className={styles.itemInfo}>
                        <div className={styles.itemPrimary}>
                          {/* Status dot */}
                          {item.shortCode in statusMap ? (
                            <span
                              className={statusMap[item.shortCode] ? styles.statusDotOk : styles.statusDotBad}
                              title={statusMap[item.shortCode] ? 'Destination active' : 'Destination broken'}
                            />
                          ) : (
                            <span className={styles.dot} />
                          )}
                          <span className={styles.shortCode}>/{item.shortCode}</span>
                          <span className={styles.mainTitle}>
                            {item.title 
                              ? (item.title.length > 30 ? item.title.slice(0, 30) + '…' : item.title)
                              : (item.originalUrl.length > 42 ? item.originalUrl.slice(0, 42) + '…' : item.originalUrl)
                            }
                          </span>
                        </div>
                        {(item.title || hasTags) && (
                          <div className={styles.itemSecondary}>
                            {item.title && (
                              <span className={styles.originalUrlSmall}>
                                {item.originalUrl.length > 35 ? item.originalUrl.slice(0, 35) + '…' : item.originalUrl}
                              </span>
                            )}
                            {hasTags && (
                              <div className={styles.tagsContainer}>
                                {tagArray.map((tag, idx) => (
                                  <span key={idx} className={styles.tagBadge}>{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    <div className={styles.actions}>
                      {item.editToken && (
                        <button
                          className={styles.editActionBtn}
                          onClick={() => startEditing(item)}
                          title="Edit destination"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                          </svg>
                        </button>
                      )}
                      
                      <button
                        className={styles.deleteBtn}
                        onClick={() => onDelete(item.shortCode)}
                        title="Remove from recents"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}

              </div>
            </li>
          );
        }))}
      </ul>
    </div>
  );
}
