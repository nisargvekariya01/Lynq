import { Classic } from "@theme-toggles/react";
import "@theme-toggles/react/css/Classic.css";
import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <div
      className={styles.toggle}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <Classic duration={750} toggled={isDark} toggle={onToggle} />
    </div>
  );
}
