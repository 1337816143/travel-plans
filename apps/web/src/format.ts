const TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

export function formatTime(timestamp: string | null): string {
  return timestamp ? TIME_FORMAT.format(new Date(timestamp)) : '--:--';
}

export function formatDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T12:00:00+08:00`));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function minuteLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
}
