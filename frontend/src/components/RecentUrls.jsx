import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkStatus } from '../services/api.js';
import styles from './RecentUrls.module.css';

const MAX_VISIBLE_LINKS = 6;

/**
 * RecentUrls — shows up to 5-6 shortened URLs with fast auto-adjusting list.
 */
export default function RecentUrls({ items = [], onSelect, onClear, onDelete, onEdit, isSignedIn = false }) {
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

  const displayItems = searchQuery.trim() === '' 
    ? items.slice(0, MAX_VISIBLE_LINKS) 
    : filteredItems.slice(0, MAX_VISIBLE_LINKS);

  // Check status for displayed items in parallel (fast, non-blocking)
  useEffect(() => {
    if (!displayItems || displayItems.length === 0) return;
    let cancelled = false;

    const uncached = displayItems.filter(item => !(item.shortCode in statusMap));
    if (uncached.length === 0) return;

    Promise.allSettled(
      uncached.map(async (item) => {
        try {
          const result = await checkStatus(item.shortCode);
          if (!cancelled && result) {
            setStatusMap((prev) => ({ ...prev, [item.shortCode]: result.isAlive }));
          }
        } catch {
          // silently skip if check fails
        }
      })
    );

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{isSignedIn ? 'Your Links' : 'Recent Links'}</span>
          <span className={styles.countBadge}>{displayItems.length}</span>
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
          <AnimatePresence initial={false} mode="popLayout">
            {displayItems.map((item) => {
              const isEditing = editingId === item.shortCode;
              const hasTags = item.tags && item.tags.trim().length > 0;
              const tagArray = hasTags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

              return (
                <motion.li
                  key={item.shortCode}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className={styles.item}
                >
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
            </motion.li>
          );
        })}
      </AnimatePresence>
    )}
  </ul>
    </div>
  );
}
